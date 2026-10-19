// Adaptive render quality (ported from standing's client/src/game/quality.ts). A device starts
// on a level picked from what the browser reports (desktop or phone, cores, memory, GPU name),
// then a governor moves it with the measured frame rate: down quickly when frames run slow for
// a few seconds, up slowly after a long stable stretch. The browser does not expose the
// phone's temperature, but a hot phone throttles its CPU and GPU and its frames slow down, so
// frame rate stands in for heat. Auto never climbs above the start level.
//
// Levels only change looks, never the battle: it runs at its own fixed rate (FixedStep).

export type QualityMode = 'auto' | 'high' | 'saver';
export const QUALITY_MODES: readonly QualityMode[] = ['auto', 'high', 'saver'];

export interface LevelSettings {
  name: string;
  /** Render resolution cap; the device pixel ratio caps it too. */
  resolution: number;
  fps: number;
}

// Each step down gives up resolution first and the frame rate last.
export const LEVELS: readonly LevelSettings[] = [
  { name: 'saver', resolution: 1.5, fps: 30 },
  { name: 'low', resolution: 1.5, fps: 60 },
  { name: 'high', resolution: 2, fps: 60 },
  // a 3x screen (every iPhone since the X) at its own pixels: at 2 the 1080-wide board is
  // drawn on ~790 pixels of a ~1180 wide screen and looks soft
  { name: 'max', resolution: 3, fps: 60 },
];
/** The top level on screens of 2x and under, where `max` would draw nothing sharper. */
const HIGH = 2;
const MAX = 3;

/** Frame rate cap off the battlefield (home, title, results, skill picks): those screens
 *  barely move, and a phone that never gets hot never steps its level down for the battery. */
export const CALM_FPS = 30;

export function targetFps(s: LevelSettings, calm: boolean): number {
  return calm ? Math.min(CALM_FPS, s.fps) : s.fps;
}

export interface DeviceInfo {
  mobile: boolean;
  /** Logical CPU cores and memory in GB, 0 when the browser does not say. */
  cores: number;
  memoryGB: number;
  /** WebGL renderer string, '' when hidden. */
  gpu: string;
  /** window.devicePixelRatio. */
  dpr: number;
}

export interface LevelRange {
  start: number;
  min: number;
  max: number;
}

/** GPU names that mean a software renderer, and known weak phone GPUs. */
export const SOFTWARE_GPU = /swiftshader|llvmpipe|software|basic render/i;
export const WEAK_GPU = /mali-[t4]|mali-g(31|51|52|57)\b|adreno\D*[2-5]\d\d\b|powervr|sgx/i;

/** WebKit (Safari, the iOS app's web view) reports this for every Apple GPU. It also hides the
 *  memory and gives no more than a few cores, so on an iPhone those say nothing. */
export const APPLE_GPU = /apple/i;

/** The best level a device's screen and GPU get: `max` only on a screen sharper than 2x, and
 *  of phones only iPhones for now (Android phones at 3x keep the 2x they always had). */
function topLevel(d: DeviceInfo): number {
  return d.dpr > 2 && (!d.mobile || APPLE_GPU.test(d.gpu)) ? MAX : HIGH;
}

/** Level a device starts on in auto mode: the top one unless it looks weak. */
export function startLevel(d: DeviceInfo): number {
  const top = topLevel(d);
  if (!d.mobile) return SOFTWARE_GPU.test(d.gpu) ? HIGH - 1 : top;
  const apple = APPLE_GPU.test(d.gpu);
  const hints = [d.memoryGB > 0 && d.memoryGB <= 3, !apple && d.cores > 0 && d.cores <= 4, WEAK_GPU.test(d.gpu) || SOFTWARE_GPU.test(d.gpu)].filter(Boolean).length;
  return hints ? Math.max(0, HIGH - hints) : top;
}

export function levelRange(mode: QualityMode, d: DeviceInfo): LevelRange {
  if (mode === 'high') {
    const top = topLevel(d);
    return { start: top, min: top, max: top };
  }
  if (mode === 'saver') return { start: 0, min: 0, max: 0 };
  const start = startLevel(d);
  return { start, min: 0, max: start };
}

/**
 * Frame limiter for a requestAnimationFrame loop: on a 120 Hz screen a 60 fps cap runs every
 * other frame. Keeps a fixed schedule with a quarter-interval tolerance for timer jitter,
 * and resyncs after a stall instead of bursting to catch up.
 */
export class FrameGate {
  private next = -Infinity;

  constructor(public fps: number) {}

  pass(nowMs: number): boolean {
    const interval = 1000 / this.fps;
    if (nowMs < this.next - interval * 0.25) return false;
    this.next = nowMs - this.next > interval ? nowMs + interval : this.next + interval;
    return true;
  }
}

export interface GovernorOptions {
  /** Seconds per measuring window. */
  window: number;
  /** Slow windows in a row before stepping down. */
  slowWindows: number;
  /** Stable seconds before trying a level up; doubles when a try fails, up to maxUpAfter. */
  upAfter: number;
  maxUpAfter: number;
  /** A drop this soon (s) after stepping up counts as a failed try. */
  probe: number;
}

export const GOVERNOR: GovernorOptions = { window: 2, slowWindows: 2, upAfter: 30, maxUpAfter: 240, probe: 10 };
/** Under this share of the level's frame rate a window is slow; over the second, stable. */
const SLOW = 0.8;
const STABLE = 0.9;

export class FrameGovernor {
  level: number;
  private frames = 0;
  private time = 0;
  private slow = 0;
  private stable = 0;
  private upAfter: number;
  private sinceUp = Infinity;

  constructor(
    private readonly range: LevelRange,
    private readonly opts: GovernorOptions = GOVERNOR,
  ) {
    this.level = range.start;
    this.upAfter = opts.upAfter;
  }

  /** Feeds one frame's length in seconds; true when the level changed. */
  sample(dt: number): boolean {
    // pauses (hidden tab, app in background) and single hitches say nothing about load
    if (!(dt > 0 && dt < 0.25)) return false;
    this.frames++;
    this.time += dt;
    this.sinceUp += dt;
    if (this.time < this.opts.window) return false;
    const fps = this.frames / this.time;
    const span = this.time;
    this.frames = this.time = 0;
    const target = LEVELS[this.level].fps;
    if (fps < target * SLOW) {
      this.stable = 0;
      if (++this.slow < this.opts.slowWindows || this.level <= this.range.min) return false;
      if (this.sinceUp < this.opts.probe) this.upAfter = Math.min(this.upAfter * 2, this.opts.maxUpAfter);
      this.slow = 0;
      this.level--;
      return true;
    }
    this.slow = 0;
    this.stable = fps >= target * STABLE ? this.stable + span : 0;
    if (this.stable < this.upAfter || this.level >= this.range.max) return false;
    this.stable = 0;
    this.sinceUp = 0;
    this.level++;
    return true;
  }
}
