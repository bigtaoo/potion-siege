import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application, Renderer } from 'pixi.js';
import { LEVELS } from './quality';
import { gpuName, QualityRuntime, watchDensity } from './qualityRuntime';

const TOP = LEVELS.length - 1;
const RANGE = { start: TOP, min: 0, max: TOP };

/** The few parts of a Pixi app the runtime touches, on a 3x screen. */
function fakeApp(device = 3) {
  const renderer = {
    resolution: device,
    resize: vi.fn((_w: number, _h: number, res: number) => {
      renderer.resolution = res;
    }),
  };
  const ticker = { autoStart: true, stop: vi.fn(), update: vi.fn() };
  const app = { renderer, ticker, screen: { width: 1080, height: 1920 } };
  return { app, renderer, ticker, asApp: app as unknown as Application };
}

let waiting: FrameRequestCallback[] = [];
/** Runs the animation frames asked for so far at `now` ms. */
function frame(now: number): void {
  const due = waiting;
  waiting = [];
  for (const cb of due) cb(now);
}
/** Frames every `gap` ms from `from` for `ms`; returns the time after the last. */
function frames(from: number, gap: number, ms: number): number {
  let t = from;
  for (; t < from + ms; t += gap) frame(t);
  return t;
}

beforeEach(() => {
  waiting = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => waiting.push(cb));
});
afterEach(() => vi.unstubAllGlobals());

/** A window whose pixel ratio `to` moves, telling the query armed on the old ratio. */
function fakeScreen(dpr: number) {
  const armed: { media: string; on: () => void }[] = [];
  const win = {
    devicePixelRatio: dpr,
    matchMedia: (media: string) => ({
      addEventListener: (_: string, on: () => void) => armed.push({ media, on }),
      removeEventListener: (_: string, on: () => void) => armed.splice(armed.findIndex((a) => a.on === on), 1),
    }),
  };
  const to = (next: number) => {
    const old = armed.filter((a) => a.media === `(resolution: ${win.devicePixelRatio}dppx)`);
    win.devicePixelRatio = next;
    for (const a of old) a.on();
  };
  return { win, armed, to };
}

describe('watchDensity', () => {
  it('tells each change of the pixel ratio, one query armed at a time', () => {
    const { win, armed, to } = fakeScreen(1);
    const seen: number[] = [];
    const stop = watchDensity((d) => seen.push(d), win as unknown as Window);
    to(1.5);
    to(2);
    expect(seen).toEqual([1.5, 2]);
    expect(armed.map((a) => a.media)).toEqual(['(resolution: 2dppx)']);
    stop();
    expect(armed).toEqual([]);
  });

  it('does nothing without matchMedia', () => {
    expect(() => watchDensity(() => {}, undefined)()).not.toThrow();
    expect(() => watchDensity(() => {}, {} as Window)()).not.toThrow();
  });
});

describe('gpuName', () => {
  const gl = (ext: object | null, params: Record<number, unknown>) => ({
    RENDERER: 1,
    getExtension: () => ext,
    getParameter: (p: number) => params[p],
  });

  it('reads the unmasked renderer when the browser gives it, else the plain one', () => {
    expect(gpuName({ gl: gl({ UNMASKED_RENDERER_WEBGL: 7 }, { 7: 'Adreno (TM) 740', 1: 'WebKit WebGL' }) } as unknown as Renderer)).toBe('Adreno (TM) 740');
    expect(gpuName({ gl: gl(null, { 1: 'WebKit WebGL' }) } as unknown as Renderer)).toBe('WebKit WebGL');
    expect(gpuName({ gl: gl(null, {}) } as unknown as Renderer)).toBe('');
  });

  it('is empty without WebGL or when asking throws', () => {
    expect(gpuName({} as Renderer)).toBe('');
    const broken = { getExtension: () => { throw new Error('lost context'); } };
    expect(gpuName({ gl: broken } as unknown as Renderer)).toBe('');
  });
});

describe('QualityRuntime', () => {
  it('takes the ticker over and draws a battle at its level\'s resolution from the start', () => {
    const { renderer, ticker, asApp } = fakeApp();
    const q = new QualityRuntime(asApp, RANGE);
    expect(ticker.autoStart).toBe(false);
    expect(ticker.stop).toHaveBeenCalled();
    expect(renderer.resize).toHaveBeenCalledWith(1080, 1920, LEVELS[TOP].resolution);
    expect(q.settings).toBe(LEVELS[TOP]);
    expect(waiting).toHaveLength(1);
  });

  it('steps the ticker once a frame on a steady clock', () => {
    const { ticker, asApp } = fakeApp();
    new QualityRuntime(asApp, RANGE);
    frames(1000, 1000 / 60, 500);
    expect(ticker.update.mock.calls.length).toBeGreaterThanOrEqual(29);
    const times = ticker.update.mock.calls.map((c) => c[0] as number);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  });

  it('draws calm screens at half the rate on a 60 Hz display', () => {
    const { ticker, asApp } = fakeApp();
    new QualityRuntime(asApp, RANGE, () => true);
    frames(1000, 1000 / 60, 1000);
    const n = ticker.update.mock.calls.length;
    expect(n).toBeGreaterThanOrEqual(28);
    expect(n).toBeLessThanOrEqual(32);
  });

  it('gives a screen with no battle the full density and takes it back when a battle comes', () => {
    const { renderer, asApp } = fakeApp();
    let home = true;
    new QualityRuntime(asApp, RANGE, () => home, () => home);
    expect(renderer.resolution).toBe(3);
    home = false;
    frame(1000);
    expect(renderer.resolution).toBe(LEVELS[TOP].resolution);
    const resizes = renderer.resize.mock.calls.length;
    frames(1017, 1000 / 60, 200);
    expect(renderer.resize.mock.calls.length).toBe(resizes);
  });

  it("follows the screen's density on a screen with no battle, up to the cap", () => {
    const screen = fakeScreen(1);
    vi.stubGlobal('window', screen.win);
    const { asApp, renderer } = fakeApp(1);
    new QualityRuntime(asApp, RANGE, () => true, () => true, 2);
    frame(0);
    expect(renderer.resolution).toBe(1);
    screen.to(1.5);
    frame(100);
    expect(renderer.resolution).toBe(1.5);
    expect(renderer.resize).toHaveBeenLastCalledWith(1080, 1920, 1.5);
    screen.to(3);
    frame(200);
    expect(renderer.resolution).toBe(2);
  });

  it('steps down a level when battle frames come too slow, and draws at the lower resolution', () => {
    const { renderer, asApp } = fakeApp();
    const q = new QualityRuntime(asApp, RANGE);
    frames(1000, 50, 6000);
    expect(q.governor.level).toBe(TOP - 1);
    expect(renderer.resolution).toBe(LEVELS[TOP - 1].resolution);
  });

  it('never steps down for calm frames, however slow', () => {
    const { asApp } = fakeApp();
    const q = new QualityRuntime(asApp, RANGE, () => true);
    frames(1000, 50, 6000);
    expect(q.governor.level).toBe(TOP);
  });

  it('hands a frame that throws to onFault and keeps going', () => {
    const { ticker, asApp } = fakeApp();
    const q = new QualityRuntime(asApp, RANGE);
    const faults: unknown[] = [];
    q.onFault = (err) => faults.push(err);
    const boom = new Error('boom');
    ticker.update.mockImplementationOnce(() => {
      throw boom;
    });
    frame(1000);
    frame(1017);
    expect(faults).toEqual([boom]);
    expect(ticker.update).toHaveBeenCalledTimes(2);
  });

  it('logs a fault by default', () => {
    const { ticker, asApp } = fakeApp();
    new QualityRuntime(asApp, RANGE);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    ticker.update.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    frame(1000);
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it('stops for good once stopped', () => {
    const { ticker, asApp } = fakeApp();
    const q = new QualityRuntime(asApp, RANGE);
    frame(1000);
    q.stopped = true;
    frame(1017);
    expect(waiting).toHaveLength(0);
    expect(ticker.update).toHaveBeenCalledTimes(1);
  });
});
