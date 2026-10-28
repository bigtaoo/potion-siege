import { afterEach, describe, expect, it, vi } from 'vitest';
import { noise } from './dsp';
import type { RenderDone } from './render.worker';
import { SFX } from './sfx';

afterEach(() => vi.unstubAllGlobals());

describe('the render worker', () => {
  it('renders each job it is sent and posts the samples back, handing over their memory', async () => {
    const post = vi.fn();
    const self = { onmessage: null as ((e: { data: unknown }) => void) | null, postMessage: post };
    vi.stubGlobal('self', self);
    vi.resetModules();
    await import('./render.worker');
    self.onmessage!({ data: { kind: 'sfx', id: 'tap', sr: 8000 } });
    self.onmessage!({ data: { kind: 'music', id: 'battle', sr: 2000 } });
    const [[sfx, sfxMove], [music]] = post.mock.calls as [RenderDone, ArrayBuffer[]][];
    expect(sfx).toMatchObject({ kind: 'sfx', id: 'tap', sr: 8000 });
    expect(sfx.data.length).toBe(Math.ceil(SFX.tap.len * 8000));
    expect(sfxMove).toEqual([sfx.data.buffer]);
    expect(music).toMatchObject({ kind: 'music', id: 'battle', sr: 2000 });
    expect(music.data.length).toBeGreaterThan(30 * 2000);
  });
});

describe('noise', () => {
  it('a burst past the end of a loop wraps round to its start; without wrap it is cut', () => {
    const wrapped = new Float32Array(1000);
    noise(wrapped, 1000, { at: 0.9, dur: 0.3, gain: 1 }, true);
    const cut = new Float32Array(1000);
    noise(cut, 1000, { at: 0.9, dur: 0.3, gain: 1 });
    expect(wrapped.slice(0, 200).some((v) => v !== 0)).toBe(true);
    expect(wrapped.slice(200, 900).every((v) => v === 0)).toBe(true);
    expect(cut.slice(0, 900).every((v) => v === 0)).toBe(true);
    expect(cut.slice(900)).toEqual(wrapped.slice(900));
  });
});
