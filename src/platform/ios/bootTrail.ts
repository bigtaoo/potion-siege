import type { Props } from '../../analytics/analytics';

// What a launch of the iOS app got through, written to the device as it goes, so that a launch
// that never finished (a throw, the web view killed for memory, a hot update the updater rolled
// back) can be told about by a later one (main.ios.ts), after D:\standing's bootTrail. Each step
// overwrites the record at once: nothing waits on the network, and a web view killed mid-boot
// leaves its last step behind. A launch that finishes (or reloads into a downloaded bundle)
// clears it. An unfinished record moves to a short pending list, which waits there until a
// launch gets as far as the telemetry and takes it, so two failed launches in a row lose nothing.

export const TRAIL_KEY = 'ps.boot';
export const PENDING_KEY = 'ps.boot.pending';
/** Errors kept per launch: the first ones say the most. */
export const TRAIL_ERRORS = 3;
/** Reports waiting at most; the oldest go first. */
export const PENDING_MAX = 5;

export interface Trail {
  /** The bundle that booted (__PS_BUNDLE__) and its build (__PS_BUILD__). */
  bundle: string;
  build: string;
  /** The last step reached. */
  stage: string;
  /** ms from the script's start to that step. */
  ms: number;
  /** What the step said about itself. */
  info?: string;
  errors: string[];
}

type Kv = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** A launch that never finished, as the `boot_fail` anomaly's props; null for a clean one. */
export function unfinished(t: Trail | null): Props | null {
  if (!t) return null;
  const p: Props = { place: 'boot', stage: t.stage, ms: Math.round(t.ms), bundle: t.bundle, build: t.build };
  if (t.info) p.info = t.info;
  if (t.errors.length) p.msg = t.errors[0];
  if (t.errors.length > 1) p.errors = t.errors.length;
  return p;
}

/** A report waiting for the telemetry: the anomaly's kind and its props. */
export interface Pending {
  kind: 'boot_fail' | 'ota_fail';
  props: Props;
}

export class BootTrail {
  private trail: Trail;
  private readonly t0: number;

  /** Starts this launch's record; an unfinished one before it joins the pending reports. */
  constructor(
    private readonly kv: Kv,
    bundle: string,
    build: string,
    private readonly now: () => number,
  ) {
    const last = unfinished(read(kv));
    if (last) this.push({ kind: 'boot_fail', props: last });
    this.trail = { bundle, build, stage: 'script', ms: 0, errors: [] };
    this.t0 = now();
    this.write();
  }

  step(stage: string, info?: string): void {
    this.trail = { ...this.trail, stage, ms: this.now() - this.t0, ...(info ? { info } : {}) };
    this.write();
  }

  error(msg: string): void {
    if (this.trail.errors.length >= TRAIL_ERRORS) return;
    this.trail = { ...this.trail, errors: [...this.trail.errors, msg] };
    this.write();
  }

  /** The launch made it (or hands over to another bundle): nothing for the next one to report. */
  done(): void {
    try {
      this.kv.removeItem(TRAIL_KEY);
    } catch {
      /* storage gone: the next launch reports a false failure at worst */
    }
  }

  /** Adds a report for the telemetry to take. */
  push(p: Pending): void {
    this.save([...this.pending(), p].slice(-PENDING_MAX));
  }

  /** The reports waiting, taken off the device: the caller sends them. */
  take(): Pending[] {
    const out = this.pending();
    try {
      this.kv.removeItem(PENDING_KEY);
    } catch {
      /* sent again next time at worst */
    }
    return out;
  }

  private pending(): Pending[] {
    try {
      const list: unknown = JSON.parse(this.kv.getItem(PENDING_KEY) ?? '[]');
      if (!Array.isArray(list)) return [];
      return list.filter((p): p is Pending => !!p && (p.kind === 'boot_fail' || p.kind === 'ota_fail') && !!p.props && typeof p.props === 'object');
    } catch {
      return [];
    }
  }

  private save(list: Pending[]): void {
    try {
      this.kv.setItem(PENDING_KEY, JSON.stringify(list));
    } catch {
      /* storage full or gone: the report is a diagnosis, never in the way of the game */
    }
  }

  private write(): void {
    try {
      this.kv.setItem(TRAIL_KEY, JSON.stringify(this.trail));
    } catch {
      /* as above */
    }
  }
}

function read(kv: Kv): Trail | null {
  try {
    const t = JSON.parse(kv.getItem(TRAIL_KEY) ?? 'null') as Partial<Trail> | null;
    if (!t || typeof t.stage !== 'string' || typeof t.bundle !== 'string') return null;
    return {
      bundle: t.bundle,
      build: typeof t.build === 'string' ? t.build : '',
      stage: t.stage,
      ms: typeof t.ms === 'number' && Number.isFinite(t.ms) ? t.ms : 0,
      ...(typeof t.info === 'string' ? { info: t.info } : {}),
      errors: Array.isArray(t.errors) ? t.errors.filter((e): e is string => typeof e === 'string') : [],
    };
  } catch {
    return null;
  }
}

/** An error's message, short enough for an anomaly (perfReport's MSG_MAX). */
export function errorText(e: unknown, max = 64): string {
  const s = e instanceof Error ? e.message : String(e);
  return s.length > max ? s.slice(0, max) : s;
}
