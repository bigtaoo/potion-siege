import type { Application, Renderer } from 'pixi.js';
import { FrameGate, FrameGovernor, LEVELS, targetFps, type LevelRange, type LevelSettings } from './quality';

// Drives the frame loop and applies quality levels (ported from standing's
// client/src/game/qualityRuntime.ts). Pixi's own ticker.maxFPS cannot be used: it still
// measures each frame's delta from the last skipped animation frame, so a 60 fps cap on a
// 120 Hz screen would run the game at half speed. Instead the ticker is stopped and stepped
// from our own requestAnimationFrame loop behind a FrameGate. Calm screens (no battle moving)
// get a lower cap, and their frames are left out of the governor's measure.

/** The WebGL renderer string, '' when the browser hides it. */
export function gpuName(renderer: Renderer): string {
  const gl = (renderer as Renderer & { gl?: WebGLRenderingContext }).gl;
  if (!gl) return '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  } catch {
    return '';
  }
}

export class QualityRuntime {
  governor: FrameGovernor;
  private readonly gate: FrameGate;
  private readonly maxResolution: number;
  private last = 0;
  /** Stops the loop for good (a newer tab took the game over, game/tabLock.ts). */
  stopped = false;

  constructor(
    private readonly app: Application,
    range: LevelRange,
    /** True while nothing fast is on screen: the menus, or a battle that is not moving. */
    private readonly calm: () => boolean = () => false,
  ) {
    this.governor = new FrameGovernor(range);
    this.maxResolution = app.renderer.resolution;
    this.gate = new FrameGate(LEVELS[range.start].fps);
    // a later ticker.add() would otherwise start the ticker's own loop again
    app.ticker.autoStart = false;
    app.ticker.stop();
    this.apply();
    const loop = (now: number) => {
      if (this.stopped) return;
      requestAnimationFrame(loop);
      const calm = this.calm();
      this.gate.fps = targetFps(this.settings, calm);
      if (!this.gate.pass(now)) return;
      // calm frames come slower on purpose and say nothing about the load
      if (this.last > 0 && !calm && this.governor.sample((now - this.last) / 1000)) this.apply();
      this.last = now;
      app.ticker.update(now);
    };
    requestAnimationFrame(loop);
  }

  get settings(): LevelSettings {
    return LEVELS[this.governor.level];
  }

  private apply(): void {
    const res = Math.min(this.maxResolution, this.settings.resolution);
    const r = this.app.renderer;
    if (r.resolution !== res) r.resize(this.app.screen.width, this.app.screen.height, res);
  }
}
