// Measures a run's battle frames for the `perf` event (adapted from D:\standing's perfMeter).
// Frame rates go into whole-fps buckets rather than a list of frames, so an hour's run costs the
// same 121 counters as a minute's, and the median and 5th percentile still come out to the frame.

/** Highest fps bucket; faster frames (a 144 Hz screen) count as this. */
const TOP_FPS = 120;
/** A frame this long says nothing about the load (a hidden tab, one hitch): counted long, left out of the rates. */
export const PAUSE_MS = 250;
/** A frame at least this long counts as `long`. */
export const LONG_MS = 50;
/** Fewer battle seconds than this make no snapshot. */
export const PERF_MIN_SECS = 5;
/** Battle seconds between two looks at a `mid` snapshot, and the most one run looks at. */
export const PERF_MID_SECS = 180;
export const PERF_MID_MAX = 5;

/** When a snapshot is taken: the run ended, the page went away mid-run (`quit`), the tab was
 *  hidden mid-run (`leave`), or every PERF_MID_SECS while something looks wrong (`mid`). */
export type PerfWhy = 'end' | 'quit' | 'leave' | 'mid';

/** The frame-rate half of a `perf` event; the memory half, long tasks and `nth` come from PerfReport. */
export interface PerfSnapshot {
  why: PerfWhy;
  /** Battle seconds measured in this snapshot. */
  secs: number;
  /** Median and 5th-percentile frame rate. */
  fps: number;
  p5: number;
  /** Frames of LONG_MS or longer. */
  long: number;
  /** Most enemies alive at once. */
  mobs: number;
}

export class PerfMeter {
  private readonly hist = new Uint32Array(TOP_FPS + 1);
  private frames = 0;
  private long = 0;
  private ms = 0;
  /** Battle ms of the whole run, for the `mid` schedule. */
  private runMs = 0;
  private mids = 0;
  private mobs = 0;

  /** One battle frame: its length and the enemies alive. */
  frame(ms: number, mobs: number): void {
    this.mobs = Math.max(this.mobs, mobs);
    if (ms >= LONG_MS) this.long++;
    if (!(ms > 0 && ms < PAUSE_MS)) return;
    this.hist[Math.min(TOP_FPS, Math.round(1000 / ms))]++;
    this.frames++;
    this.ms += ms;
    this.runMs += ms;
  }

  /** Battle seconds measured since the last snapshot. */
  get secs(): number {
    return this.ms / 1000;
  }

  /** A `mid` snapshot is due: every PERF_MID_SECS battle seconds of the run, at most PERF_MID_MAX. */
  midDue(): boolean {
    return this.mids < PERF_MID_MAX && this.runMs >= (this.mids + 1) * PERF_MID_SECS * 1000;
  }

  /**
   * The measure since the last snapshot, then a fresh start for the next (peak mobs run on); null
   * under PERF_MIN_SECS. `keep` leaves the measure running, for a `mid` looked at and not sent:
   * its frames then count in the next snapshot.
   */
  snapshot(why: PerfWhy, keep = false): PerfSnapshot | null {
    if (why === 'mid') this.mids++;
    if (this.secs < PERF_MIN_SECS) return null;
    const snap: PerfSnapshot = { why, secs: Math.round(this.secs), fps: this.rate(0.5), p5: this.rate(0.05), long: this.long, mobs: this.mobs };
    if (!keep) this.reset();
    return snap;
  }

  /** Starts the next snapshot's measure afresh. */
  reset(): void {
    this.hist.fill(0);
    this.frames = this.long = this.ms = 0;
  }

  /** The fps the slowest `share` of frames are at or under. */
  private rate(share: number): number {
    const want = Math.max(1, Math.ceil(this.frames * share));
    let seen = 0;
    for (let fps = 0; fps <= TOP_FPS; fps++) if ((seen += this.hist[fps]) >= want) return fps;
    return TOP_FPS;
  }
}

/**
 * Whether a `mid` snapshot is worth sending: a healthy stretch is not, it is folded into the next
 * one. Trouble is a slow 5th percentile, many long frames a minute, or memory, textures or display
 * objects grown well past what the run started with.
 */
export const PERF_TROUBLE = { p5: 40, longPerMin: 6, heapUp: 50, texUp: 30, nodesUp: 3000 } as const;
export function perfTrouble(p: { secs: number; p5: number; long: number; heapUp?: number; texUp: number; nodesUp: number }): boolean {
  const t = PERF_TROUBLE;
  return p.p5 < t.p5 || (p.secs > 0 && (p.long * 60) / p.secs > t.longPerMin) || (p.heapUp ?? 0) >= t.heapUp || p.texUp >= t.texUp || p.nodesUp >= t.nodesUp;
}

export type GpuClass = 'software' | 'weak' | 'other' | 'hidden';
const SOFTWARE_GPU = /swiftshader|llvmpipe|software|basic render/i;
const WEAK_GPU = /mali-[t4]|mali-g(31|51|52|57)\b|adreno\D*[2-5]\d\d\b|powervr|sgx/i;

/** The GPU's coarse class from its WebGL renderer string ('' when the browser hides it). */
export function gpuClass(renderer: string): GpuClass {
  if (!renderer) return 'hidden';
  if (SOFTWARE_GPU.test(renderer)) return 'software';
  return WEAK_GPU.test(renderer) ? 'weak' : 'other';
}
