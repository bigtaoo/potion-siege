import { describe, expect, it } from 'vitest';
import { master, noise, pluck, tone } from './dsp';

const SR = 8000;
const peak = (a: Float32Array): number => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('dsp defaults and edges', () => {
  it('tone falls back to gain 0.5 and a 4 ms attack', () => {
    const plain = new Float32Array(SR / 10);
    tone(plain, SR, { at: 0, dur: 0.1, freq: 440 });
    const explicit = new Float32Array(SR / 10);
    tone(explicit, SR, { at: 0, dur: 0.1, freq: 440, gain: 0.5, attack: 0.004 });
    expect(peak(plain)).toBeGreaterThan(0);
    expect(Array.from(plain)).toEqual(Array.from(explicit));
  });

  it('noise falls back to gain 0.5', () => {
    const plain = new Float32Array(SR / 10);
    noise(plain, SR, { at: 0, dur: 0.1 });
    const explicit = new Float32Array(SR / 10);
    noise(explicit, SR, { at: 0, dur: 0.1, gain: 0.5 });
    expect(peak(plain)).toBeGreaterThan(0);
    expect(Array.from(plain)).toEqual(Array.from(explicit));
  });

  it('pluck stops at the end, or wraps to the start when asked', () => {
    const cut = new Float32Array(SR / 10);
    pluck(cut, SR, 0.08, 220, 0.1, 0.5);
    expect(peak(cut.subarray(0, SR / 20))).toBe(0);
    const wrapped = new Float32Array(SR / 10);
    pluck(wrapped, SR, 0.08, 220, 0.1, 0.5, 0.6, 1, true);
    expect(peak(wrapped.subarray(0, SR / 20))).toBeGreaterThan(0);
  });

  it('master leaves a silent buffer silent', () => {
    const out = master(new Float32Array(16));
    expect(Array.from(out).every((v) => v === 0)).toBe(true);
  });
});
