// Client performance telemetry (adapted from D:\standing's perfReport): the `perf` event, one
// meter per run fed the battle frames only, snapshotted as the run ends, as the page goes away
// mid-run and as the tab is hidden mid-run. Every PERF_MID_SECS battle seconds it looks at a `mid`
// snapshot too, but sends it only when something looks wrong (perfTrouble), which keeps a healthy
// run to about one small event. The `anomaly` event is one thing gone wrong: an uncaught error or
// rejection, the WebGL context lost, or one battle frame stalled. Nothing here may break the
// frame: every entry point is guarded, and the first failure logs once and turns perf off.

import type { Analytics, Props } from './analytics';
import { gpuClass, perfTrouble, PerfMeter, type PerfSnapshot, type PerfWhy } from './perfMeter';
import type { MemSample } from './memProbe';
import { devPrint } from './devPrint';

/** A battle frame at least this long (ms) is a `stall`; one of STALL_MAX_MS or more is the page
 *  stopped without saying it was hidden (an iframe scrolled out of sight), a pause, not a hitch. */
export const STALL_MS = 1000;
export const STALL_MAX_MS = 5000;
/** At most this many `anomaly` events of each kind, and of all kinds, per session. */
export const ANOMALY_CAP = 3;
export const ANOMALY_TOTAL = 8;
/** Longest `msg` an `error` anomaly carries. */
export const MSG_MAX = 64;

export type AnomalyKind = 'error' | 'rejection' | 'webgl_lost' | 'stall' | 'boot_fail' | 'ota_fail';

/** A `perf` event's props: the snapshot, what the game holds now and since the run's first battle frame. */
export interface PerfProps extends PerfSnapshot {
  /** Runs started since launch, this one included. */
  nth: number;
  /** Long tasks (PerformanceObserver 'longtask') during battle since the last snapshot: total ms and count; absent where unsupported. */
  longMs?: number;
  longN?: number;
  /** Game speed (?speed). */
  speed: number;
  /** JS heap MB and its change since the run started (Chrome only). */
  heap?: number;
  heapUp?: number;
  /** GPU texture sources alive, their change since the run started, and their size in MB. */
  tex: number;
  texUp: number;
  texMB: number;
  /** Display objects on stage, and their change since the run started. */
  nodes: number;
  nodesUp: number;
  /** The run's chapter (sim/chapters.ts chapterOf), 0 for a challenge or endless run. */
  chapter: number;
  /** Ms from the run's start (the player's tap, past any break ad) to its first battle frame: the
   *  scene built and drawn. Absent for runs no tap started (the first battle, autoplay). */
  ready?: number;
}

/** Sums the long tasks seen while `active` (the battle is measured); a no-op where the browser has no 'longtask' entries. */
export class LongTasks {
  readonly supported: boolean;
  active = false;
  private ms = 0;
  private n = 0;

  constructor(observer: typeof PerformanceObserver | undefined = globalThis.PerformanceObserver) {
    this.supported = !!observer?.supportedEntryTypes?.includes('longtask');
    if (!this.supported) return;
    try {
      new observer!((list) => {
        if (!this.active) return;
        for (const e of list.getEntries()) this.add(e.duration);
      }).observe({ type: 'longtask', buffered: false });
    } catch {
      (this as { supported: boolean }).supported = false;
    }
  }

  add(ms: number): void {
    this.ms += ms;
    this.n++;
  }

  /** The long tasks since the last take; nothing where unsupported. */
  take(): { longMs?: number; longN?: number } {
    if (!this.supported) return {};
    const out = { longMs: Math.round(this.ms), longN: this.n };
    this.ms = this.n = 0;
    return out;
  }
}

/** Where the player is, for an anomaly: `run`, `results`, `home` or `title`, with the wave in a run. */
export type Place = () => { place: string; wave?: number };

/** Sends `anomaly` events, at most ANOMALY_CAP of a kind and ANOMALY_TOTAL in all per session. */
export class Anomalies {
  private readonly sent = new Map<AnomalyKind, number>();
  private total = 0;

  constructor(
    private readonly a: Pick<Analytics, 'track'>,
    private readonly where: Place,
    private readonly probe?: () => MemSample,
  ) {}

  report(kind: AnomalyKind, props: Props = {}): void {
    const n = this.sent.get(kind) ?? 0;
    const at = this.where();
    const out: Props = { kind, place: at.place, ...props };
    // a report that names its own place (a launch report) is not about the wave on screen
    if (at.wave !== undefined && props.place === undefined) out.wave = at.wave;
    // a development build prints every one, past the cap too
    devPrint('anomaly', out);
    if (n >= ANOMALY_CAP || this.total >= ANOMALY_TOTAL) return;
    this.sent.set(kind, n + 1);
    this.total++;
    if (kind === 'webgl_lost' && this.probe) {
      const m = this.probe();
      Object.assign(out, { tex: m.tex, texMB: m.texMB, nodes: m.nodes }, m.heap !== undefined ? { heap: m.heap } : {});
    }
    this.a.track('anomaly', out);
  }

  /** A frame threw (game/faultRecover.ts): an `error` with `frame: 1`, its source from the stack. */
  error(err: unknown): void {
    this.safe(() => {
      const e = err instanceof Error ? err : null;
      const at = stackTop(e?.stack ?? '');
      this.report('error', { ...errorProps(e ? e.message : String(err), at?.file, at?.line, at?.col), frame: 1 });
    });
  }

  /** Listens for uncaught errors and rejections on `win` and a lost context on `canvas`. */
  listen(win: Pick<Window, 'addEventListener'>, canvas?: Pick<HTMLCanvasElement, 'addEventListener'>): void {
    win.addEventListener('error', (e) => {
      const ev = e as ErrorEvent;
      this.safe(() => this.report('error', errorProps(ev.message || String(ev.error ?? ''), ev.filename, ev.lineno, ev.colno)));
    });
    win.addEventListener('unhandledrejection', (e) => {
      const r = (e as PromiseRejectionEvent).reason;
      this.safe(() => this.report('rejection', { msg: cut(r instanceof Error ? r.message : String(r)) }));
    });
    canvas?.addEventListener('webglcontextlost', () => this.safe(() => this.report('webgl_lost')));
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch {
      /* telemetry must never break the game */
    }
  }
}

/** The first frame of a stack that names a script position (`at f (https://h/a/index-abc.js:1:2345)`, or Safari's `f@https://h/a/index-abc.js:1:2345`). */
export function stackTop(stack: string): { file: string; line: number; col: number } | null {
  for (const l of stack.split('\n')) {
    const m = /(?:\(|@|\s|^)([^\s()@]+):(\d+):(\d+)\)?\s*$/.exec(l);
    if (m) return { file: m[1], line: Number(m[2]), col: Number(m[3]) };
  }
  return null;
}

function cut(s: string): string {
  return s.length > MSG_MAX ? s.slice(0, MSG_MAX) : s;
}

/** An `error` anomaly's props: the message cut to MSG_MAX, and the script's file name with line and column (`index-abc.js:1:2345`). */
export function errorProps(msg: string, file?: string, line?: number, col?: number): Props {
  const out: Props = { msg: cut(msg) };
  const name = (file ?? '').split(/[?#]/)[0].split('/').pop();
  if (name) out.src = `${name}:${line ?? 0}:${col ?? 0}`;
  return out;
}

/** The device fields `session_start` carries once per launch, so no `perf` repeats them. */
export function deviceProps(renderer: unknown, nav: Partial<Navigator> & { deviceMemory?: number } = navigator, dpr = globalThis.devicePixelRatio): Props {
  const r = renderer as { name?: string; gl?: WebGLRenderingContext };
  return {
    mem: nav.deviceMemory || 0,
    cores: nav.hardwareConcurrency || 0,
    gpu: gpuClass(glRenderer(r.gl)),
    dpr: Math.round((dpr || 1) * 100) / 100,
    renderer: r.name ?? 'unknown',
  };
}

/** The unmasked WebGL renderer string, '' when the browser hides it or there is no WebGL. */
function glRenderer(gl: WebGLRenderingContext | undefined): string {
  if (!gl) return '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  } catch {
    return '';
  }
}

export class PerfReport {
  private meter: PerfMeter | null = null;
  /** Runs started since launch. */
  private nth = 0;
  /** What the game held at the run's first battle frame, once its scene is built. */
  private base: MemSample | null = null;
  private chapter = 0;
  /** When the run started from a tap, and the ms from then to its first battle frame. */
  private startAt: number | null = null;
  private ready: number | null = null;
  /** The tab was hidden since the last frame: the next frame's length is the gap, not the load. */
  private gap = false;
  private off = false;
  readonly anomalies: Anomalies;

  constructor(
    private readonly a: Pick<Analytics, 'track'>,
    private readonly probe: () => MemSample,
    where: Place,
    private readonly speed = 1,
    private readonly longTasks = new LongTasks(),
  ) {
    this.anomalies = new Anomalies(a, where, probe);
  }

  /** A run of `chapter` starts; `tapAt` (a performance.now() time) when the player's tap started it. */
  start(chapter = 0, tapAt: number | null = null): void {
    this.guard(() => {
      this.nth++;
      this.meter = new PerfMeter();
      this.base = null;
      this.chapter = chapter;
      this.startAt = tapAt;
      this.ready = null;
      this.longTasks.take();
    });
  }

  /** Every frame: its raw length, whether it is a measured battle frame, and the enemies alive. */
  tick(ms: number, battle: boolean, mobs: number): void {
    this.guard(() => {
      const gap = this.gap;
      this.gap = false;
      this.longTasks.active = battle && !!this.meter;
      if (!battle || !this.meter || gap) return;
      if (ms >= STALL_MS && ms < STALL_MAX_MS) this.anomalies.report('stall', { ms: Math.round(ms) });
      if (!this.base) {
        this.base = this.probe();
        if (this.startAt !== null) this.ready = Math.round(performance.now() - this.startAt);
        this.startAt = null;
      }
      this.meter.frame(ms, mobs);
      if (!this.meter.midDue()) return;
      const snap = this.meter.snapshot('mid', true);
      if (!snap || !this.base) return;
      // looked at without taking the long tasks, so a healthy stretch folds them into the next snapshot too
      const props = this.props(snap, false);
      if (perfTrouble(props)) {
        this.meter.reset();
        this.track({ ...props, ...this.longTasks.take() });
      }
    });
  }

  /** The tab is hidden: a mid-run snapshot, and the frame on coming back is left out. */
  hidden(): void {
    this.gap = true;
    this.longTasks.active = false;
    this.send('leave');
  }

  /** The run ended: its last snapshot. The meter stays for a revive, whose rest sends on its own end. */
  end(): void {
    this.send('end');
  }

  /** The page goes away mid-run. */
  quit(): void {
    this.send('quit');
    this.meter = null;
  }

  private send(why: PerfWhy): void {
    this.guard(() => {
      const snap = this.meter?.snapshot(why) ?? null;
      if (!snap || !this.base) return;
      this.track(this.props(snap, true));
    });
  }

  private props(snap: PerfSnapshot, takeLong: boolean): PerfProps {
    const now = this.probe();
    const base = this.base!;
    const props: PerfProps = {
      ...snap, nth: this.nth, ...(takeLong ? this.longTasks.take() : {}), speed: this.speed,
      tex: now.tex, texUp: now.tex - base.tex, texMB: now.texMB, nodes: now.nodes, nodesUp: now.nodes - base.nodes, chapter: this.chapter,
    };
    if (this.ready !== null) props.ready = this.ready;
    if (now.heap !== undefined) {
      props.heap = now.heap;
      if (base.heap !== undefined) props.heapUp = now.heap - base.heap;
    }
    return props;
  }

  private track(props: PerfProps): void {
    devPrint('perf', props as unknown as Props);
    this.a.track('perf', props as unknown as Props);
  }

  private guard(fn: () => void): void {
    if (this.off) return;
    try {
      fn();
    } catch (e) {
      this.off = true;
      this.longTasks.active = false;
      console.warn('[perf] telemetry turned off after an error', e);
    }
  }
}
