import { describe, expect, it } from 'vitest';
import { CALM_FPS, FrameGate, FrameGovernor, frameResolution, LEVELS, levelRange, refreshCap, startLevel, targetFps, type DeviceInfo } from './quality';

const PC: DeviceInfo = { mobile: false, cores: 8, memoryGB: 8, gpu: 'ANGLE (Intel, Intel(R) Arc(TM) Graphics)' };
const PHONE: DeviceInfo = { mobile: true, cores: 8, memoryGB: 8, gpu: 'Adreno (TM) 740' };
/** What WebKit tells the iOS app's web view on an iPhone 15: no memory, few cores, a masked GPU. */
const IPHONE: DeviceInfo = { mobile: true, cores: 4, memoryGB: 0, gpu: 'Apple GPU' };
const TOP = LEVELS.length - 1;
const HIGH = LEVELS.findIndex((l) => l.name === 'high');

/** Feeds `seconds` of frames at `fps`; returns the levels the governor passed through. */
function run(g: FrameGovernor, fps: number, seconds: number, cap = Infinity): number[] {
  const seen: number[] = [];
  for (let t = 0; t < seconds; t += 1 / fps) if (g.sample(1 / fps, cap)) seen.push(g.level);
  return seen;
}

describe('startLevel', () => {
  it('puts desktops and strong phones on high, the resolution the game always had', () => {
    expect(LEVELS[startLevel(PC)]).toMatchObject({ name: 'high', resolution: 2, fps: 60 });
    expect(startLevel(PHONE)).toBe(HIGH);
    expect(HIGH).toBe(TOP);
  });

  it('puts an iPhone on high whatever cores WebKit admits to: a battle never draws at 3', () => {
    expect(startLevel(IPHONE)).toBe(TOP);
    expect(startLevel({ ...IPHONE, cores: 2 })).toBe(TOP);
    for (const l of LEVELS) expect(l.resolution).toBeLessThanOrEqual(2);
  });

  it('starts weak devices lower', () => {
    expect(startLevel({ ...PC, gpu: 'Google SwiftShader' })).toBeLessThan(startLevel(PC));
    const weak = startLevel({ ...PHONE, gpu: 'Mali-G52' });
    expect(weak).toBe(HIGH - 1);
    expect(startLevel({ ...PHONE, gpu: 'Mali-G52', memoryGB: 3 })).toBe(weak - 1);
    expect(startLevel({ ...PHONE, gpu: 'Mali-G52', memoryGB: 3, cores: 4 })).toBe(0);
  });
});

describe('levelRange', () => {
  it('locks forced modes and lets auto range below the start', () => {
    expect(levelRange('saver', PC)).toEqual({ start: 0, min: 0, max: 0 });
    expect(levelRange('high', PHONE)).toEqual({ start: HIGH, min: HIGH, max: HIGH });
    expect(levelRange('high', { ...IPHONE, memoryGB: 2 })).toEqual({ start: TOP, min: TOP, max: TOP });
    expect(levelRange('auto', IPHONE)).toEqual({ start: TOP, min: 0, max: TOP });
    expect(levelRange('auto', PHONE)).toEqual({ start: startLevel(PHONE), min: 0, max: startLevel(PHONE) });
  });
});

describe('frameResolution', () => {
  it('draws screens with no battle at the full density the canvas has', () => {
    expect(frameResolution(true, LEVELS[0], 3)).toBe(3);
    expect(frameResolution(true, LEVELS[TOP], 1)).toBe(1);
  });

  it('draws a battle at its level, never over 2 nor over the canvas', () => {
    expect(frameResolution(false, LEVELS[TOP], 3)).toBe(2);
    expect(frameResolution(false, LEVELS[0], 3)).toBe(1.5);
    expect(frameResolution(false, LEVELS[TOP], 1.25)).toBe(1.25);
    for (const l of LEVELS) expect(frameResolution(false, l, 3)).toBeLessThanOrEqual(2);
  });
});

/** Runs `gate` over `n` refreshes `ms` apart (plus `jitter(i)`); returns the gaps between passed frames. */
function gaps(gate: FrameGate, n: number, ms: number, jitter = (_i: number) => 0, from = 0): number[] {
  const out: number[] = [];
  let last = NaN;
  for (let i = 0; i < n; i++) {
    const t = from + i * ms + jitter(i);
    if (!gate.pass(t)) continue;
    if (!Number.isNaN(last)) out.push(Math.round((t - last) * 10) / 10);
    last = t;
  }
  return out;
}

describe('FrameGate', () => {
  it('runs every other frame of a 120 Hz screen at 60 fps, evenly', () => {
    const g = gaps(new FrameGate(60), 240, 1000 / 120, (i) => (i % 3) * 0.4);
    expect(g.length).toBe(119);
    expect(Math.max(...g)).toBeLessThanOrEqual(17.5);
    expect(Math.min(...g)).toBeGreaterThanOrEqual(15.8);
  });

  it('never skips a refresh of a 60 Hz screen running a little fast or jittery', () => {
    expect(gaps(new FrameGate(60), 600, 1000 / 60.1).length).toBe(599);
    const jittery = gaps(new FrameGate(60), 600, 1000 / 60, (i) => (i % 2 ? 1.5 : -1.5));
    expect(jittery.length).toBe(599);
  });

  it('locks to the display: every frame of 90 Hz, every other of 144 Hz, never a mix', () => {
    expect(gaps(new FrameGate(60), 270, 1000 / 90).length).toBe(269);
    const g = new FrameGate(60);
    const at144 = gaps(g, 288, 1000 / 144);
    expect(new Set(at144.map((x) => Math.round(x)))).toEqual(new Set([14]));
    expect(g.frameMs).toBeCloseTo(2000 / 144, 1);
  });

  it('runs the next frame on time after a late one, no short catch-up frame', () => {
    const gate = new FrameGate(60);
    gaps(gate, 60, 1000 / 60);
    // a refresh is missed: the frame lands at 2 vsyncs, then the next ones are a vsync apart again
    const g = gaps(gate, 30, 1000 / 60, () => 0, 61 * (1000 / 60));
    expect(g.every((x) => Math.abs(x - 16.7) < 0.1)).toBe(true);
    expect(gate.pass(91 * (1000 / 60) + 3)).toBe(true);
  });

  it('passes every frame of a slower screen and resyncs after a stall', () => {
    const gate = new FrameGate(60);
    expect(gaps(gate, 60, 1000 / 50).length).toBe(59);
    expect(gate.frameMs).toBeCloseTo(20, 1);
    const at60 = new FrameGate(60);
    gaps(at60, 60, 1000 / 60);
    expect(at60.pass(5000)).toBe(true);
    expect(at60.pass(5000 + 5)).toBe(false);
    expect(at60.pass(5000 + 1000 / 60)).toBe(true);
  });

  it('reads a 60 Hz screen through iOS callback jitter: a late callback, then an early one', () => {
    const gate = new FrameGate(60);
    // every 4th callback runs 8 ms late, so its gap is 25 ms and the next one's 8.7
    const g = gaps(gate, 1800, 1000 / 60, (i) => (i % 4 === 1 ? 8 : 0) + ((i * 7) % 5) * 0.6 - 1.2);
    expect(g.length).toBe(1799);
    expect(Math.abs(1000 / gate.vsync - 60)).toBeLessThan(2);
    expect(gate.frameMs).toBeCloseTo(1000 / 60, 0);
  });

  it('follows a screen that drops from 60 to 30 Hz within about a second, and back', () => {
    const gate = new FrameGate(60);
    gaps(gate, 120, 1000 / 60);
    gaps(gate, 36, 1000 / 30, () => 0, 2000);
    expect(gate.vsync).toBeCloseTo(1000 / 30, 1);
    gaps(gate, 36, 1000 / 60, () => 0, 3200);
    expect(gate.vsync).toBeCloseTo(1000 / 60, 1);
  });
});

describe('targetFps', () => {
  it('caps calm screens below the battle rate, never above the level', () => {
    expect(targetFps(LEVELS[TOP], false)).toBe(60);
    expect(targetFps(LEVELS[TOP], true)).toBe(CALM_FPS);
    expect(targetFps(LEVELS[0], true)).toBe(Math.min(CALM_FPS, LEVELS[0].fps));
  });

  it('halves a 60 Hz screen once the gate drops to the calm rate', () => {
    const gate = new FrameGate(60);
    gaps(gate, 60, 1000 / 60);
    gate.fps = CALM_FPS;
    const g = gaps(gate, 60, 1000 / 60, () => 0, 60 * (1000 / 60));
    expect(g.length).toBe(29);
    expect(gate.frameMs).toBeCloseTo(2000 / 60, 1);
  });
});

describe('FrameGovernor', () => {
  it('steps down after a few slow seconds, not after a short dip', () => {
    const g = new FrameGovernor({ start: 2, min: 0, max: 2 });
    expect(run(g, 40, 2)).toEqual([]);
    expect(run(g, 60, 4)).toEqual([]);
    expect(run(g, 40, 6)).toEqual([1]);
  });

  it('ignores pauses and stops at the bottom', () => {
    const g = new FrameGovernor({ start: 1, min: 0, max: 1 });
    expect(g.sample(3)).toBe(false);
    run(g, 20, 30);
    expect(g.level).toBe(0);
  });

  it('climbs back slowly and backs off after a failed try', () => {
    const g = new FrameGovernor({ start: 2, min: 0, max: 2 });
    run(g, 40, 4.5);
    expect(g.level).toBe(1);
    expect(run(g, 60, 25)).toEqual([]);
    expect(run(g, 60, 6.5)).toEqual([2]);
    // the phone is still hot: the new level fails right away, so the next try waits longer
    expect(run(g, 40, 6)).toEqual([1]);
    expect(run(g, 60, 40)).toEqual([]);
    expect(run(g, 60, 25)).toEqual([2]);
  });

  it('holds an iPhone in Low Power Mode (30 Hz frames) on its level, not down to fewer pixels', () => {
    const g = new FrameGovernor({ start: 2, min: 0, max: 2 });
    expect(run(g, 30, 120, refreshCap(1000 / 30))).toEqual([]);
    // still too slow for that 30: down as usual
    expect(run(g, 20, 6, refreshCap(1000 / 30))).toEqual([1]);
  });

  it('reads only a refresh of about 30 Hz as a cap', () => {
    expect(refreshCap(1000 / 30.6)).toBe(30);
    expect(refreshCap(1000 / 32)).toBe(30);
    expect(refreshCap(1000 / 60)).toBe(Infinity);
    // a device too slow for its level, frames of one and two refreshes
    expect(refreshCap(25)).toBe(Infinity);
  });

  it('never climbs above its range', () => {
    const g = new FrameGovernor({ start: 1, min: 0, max: 1 });
    expect(run(g, 60, 120)).toEqual([]);
  });
});
