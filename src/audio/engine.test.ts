import { afterEach, describe, expect, it, vi } from 'vitest';
import { answer, buses, FakeContext, FakeGain, FakeSource, FakeWorker, samplesFor, setupAudio } from './fakeAudio';
import { renderMusic } from './music';
import { renderSfx, SFX, SFX_IDS, type SfxId } from './sfx';

vi.mock('./sfx', async (orig) => {
  const real = await orig<typeof import('./sfx')>();
  return { ...real, renderSfx: vi.fn((id: SfxId) => new Float32Array(100 + real.SFX_IDS.indexOf(id))) };
});
vi.mock('./music', async (orig) => ({
  ...(await orig<typeof import('./music')>()),
  renderMusic: vi.fn((id: string) => new Float32Array(id === 'workshop' ? 4000 : 5000)),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
  FakeContext.made = [];
  FakeWorker.made = [];
});

/** A game audio past its first tap, every sound rendered. */
function ready() {
  const s = setupAudio();
  s.tap();
  const ctx = FakeContext.made[0];
  answer(FakeWorker.made[0]);
  return { ...s, ctx, bus: buses(ctx) };
}

const sources = (ctx: FakeContext): FakeSource[] => ctx.of('source') as FakeSource[];
const idOf = (src: FakeSource): SfxId => SFX_IDS[src.buffer!.length - 100];

describe('the audio context', () => {
  it('is not made before the first gesture, and nothing plays meanwhile', () => {
    const { audio } = setupAudio();
    audio.play('tap');
    audio.music('battle');
    audio.prefs({ music: false, sfx: true });
    audio.battle([{ type: 'summon' } as never]);
    expect(FakeContext.made).toHaveLength(0);
    expect(audio.status()).toEqual({ state: 'none', sfx: 0, tracks: [], playing: null });
  });

  it('the first tap, touch or key makes one context and starts it; later ones make no other', () => {
    for (const type of ['pointerdown', 'touchend', 'keydown']) {
      FakeContext.made = [];
      const { audio, tap } = setupAudio();
      tap(type);
      tap(type);
      tap('pointerdown');
      expect(FakeContext.made).toHaveLength(1);
      expect(FakeContext.made[0].calls).toEqual(['resume']);
      expect(audio.status().state).toBe('running');
    }
  });

  it('routes both buses through a compressor to the speakers, with a little room on the effects', () => {
    const { ctx, bus } = ready();
    const [comp] = ctx.of('compressor') as (FakeContext['nodes'][number] & Record<string, { value: number }>)[];
    expect([comp.threshold.value, comp.knee.value, comp.ratio.value, comp.attack.value, comp.release.value]).toEqual([-12, 8, 4, 0.003, 0.2]);
    expect(comp.out).toEqual([ctx.destination]);
    expect(bus.music.out).toEqual([comp]);
    const [room] = ctx.of('convolver') as (FakeContext['nodes'][number] & { buffer: { getChannelData(c: number): Float32Array; numberOfChannels: number } })[];
    expect(bus.sfx.out).toEqual([comp, room]);
    const wet = room.out[0] as FakeGain;
    expect(wet.gain.value).toBe(0.16);
    expect(wet.out).toEqual([comp]);
    expect(room.buffer.numberOfChannels).toBe(2);
    const d = room.buffer.getChannelData(1);
    expect(d.length).toBe(Math.round(1.1 * ctx.sampleRate));
    expect(Math.abs(d[0])).toBe(0);
    expect(Math.max(...d.map(Math.abs))).toBeLessThanOrEqual(1);
    expect(Math.abs(d[d.length - 1])).toBeLessThan(1e-6);
  });

  it('brings the buses up from silence: effects in full, music under them', () => {
    const { bus } = ready();
    expect(bus.sfx.gain.calls[0]).toEqual(['target', 1, 0, 0.02]);
    expect(bus.music.gain.calls[0]).toEqual(['target', 0.5, 0, 0.15]);
  });

  it('falls back to the prefixed constructor of older Safari', () => {
    const { audio, tap } = setupAudio({ webkitAudioContext: FakeContext });
    tap();
    expect(FakeContext.made).toHaveLength(1);
    expect(audio.status().state).toBe('running');
  });

  it('without Web Audio a tap does nothing and the game stays silent', () => {
    const { audio, tap } = setupAudio({});
    tap();
    audio.play('tap');
    audio.music('workshop');
    expect(FakeWorker.made).toHaveLength(0);
    expect(audio.status()).toEqual({ state: 'none', sfx: 0, tracks: [], playing: null });
  });

  it('a context the browser refuses to make is tried again on the next tap', () => {
    let tries = 0;
    const Refusing = function () {
      tries++;
      throw new Error('too many contexts');
    };
    const { audio, tap } = setupAudio({ AudioContext: Refusing });
    tap();
    tap();
    expect(tries).toBe(2);
    expect(audio.status().state).toBe('none');
  });
});

describe('rendering the sounds', () => {
  it('asks the worker for every effect first, then the wanted loop, then the other', () => {
    const { audio, tap } = setupAudio();
    audio.music('battle');
    tap();
    const w = FakeWorker.made[0];
    expect(w.posted).toEqual([
      ...SFX_IDS.map((id) => ({ kind: 'sfx', id, sr: 44100 })),
      { kind: 'music', id: 'battle', sr: 22050 },
      { kind: 'music', id: 'workshop', sr: 22050 },
    ]);
  });

  it('keeps what the worker sends back and lets it go once all is in', () => {
    const { audio, tap } = setupAudio();
    tap();
    const w = FakeWorker.made[0];
    answer(w, (j) => j.kind === 'sfx');
    expect(audio.status()).toMatchObject({ sfx: SFX_IDS.length, tracks: [] });
    expect(w.terminated).toBe(false);
    answer(w, (j) => j.kind === 'music');
    expect(audio.status().tracks.sort()).toEqual(['battle', 'workshop']);
    expect(w.terminated).toBe(true);
    expect(renderSfx).not.toHaveBeenCalled();
  });

  it('a worker that fails hands the jobs it had not done to this thread, one per task', () => {
    vi.useFakeTimers();
    const { audio, tap } = setupAudio();
    tap();
    const w = FakeWorker.made[0];
    answer(w, (j) => j.kind === 'sfx' && j.id !== 'win');
    w.onerror?.();
    expect(w.terminated).toBe(true);
    vi.advanceTimersByTime(0);
    expect(audio.status().sfx).toBe(SFX_IDS.length);
    vi.runAllTimers();
    expect(renderSfx).toHaveBeenCalledTimes(1);
    expect(renderSfx).toHaveBeenCalledWith('win', 44100);
    expect(vi.mocked(renderMusic).mock.calls).toEqual([['workshop', 22050], ['battle', 22050]]);
    expect(audio.status()).toMatchObject({ sfx: SFX_IDS.length, tracks: ['workshop', 'battle'] });
  });

  it('without workers everything renders on this thread', () => {
    vi.useFakeTimers();
    const NoWorker = function () {
      throw new Error('workers blocked');
    };
    const { audio, tap } = setupAudio(undefined, NoWorker);
    tap();
    expect(audio.status().sfx).toBe(0);
    vi.runAllTimers();
    expect(renderSfx).toHaveBeenCalledTimes(SFX_IDS.length);
    expect(audio.status()).toMatchObject({ sfx: SFX_IDS.length, tracks: ['workshop', 'battle'] });
  });

  it('stores each buffer at its own rate and length', () => {
    const { audio, ctx } = ready();
    audio.play('chest');
    const src = sources(ctx)[0];
    expect(src.buffer!.sampleRate).toBe(44100);
    expect(src.buffer!.length).toBe(samplesFor({ kind: 'sfx', id: 'chest', sr: 44100 }).length);
  });
});

describe('playing a sound', () => {
  it('starts a source of that sound into the effects bus, its pitch within the spread', () => {
    const { audio, ctx, bus } = ready();
    for (const id of ['tap', 'hitFire', 'boss'] as const) {
      ctx.currentTime += 1;
      audio.play(id);
    }
    const srcs = sources(ctx);
    expect(srcs.map(idOf)).toEqual(['tap', 'hitFire', 'boss']);
    for (const s of srcs) {
      expect(s.out).toEqual([bus.sfx]);
      expect(s.started).toBe(0);
      expect(Math.abs(s.playbackRate.value - 1)).toBeLessThanOrEqual(SFX[idOf(s)].vary);
    }
  });

  it('a cue sets the rate, an extra level and the side', () => {
    const { audio, ctx, bus } = ready();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    audio.play('kill', { rate: 0.6, gain: 0.8, pan: -0.4 });
    const [src] = sources(ctx);
    expect(src.playbackRate.value).toBeCloseTo(0.6);
    const g = src.out[0] as FakeGain;
    expect(g.gain.value).toBe(0.8);
    const p = g.out[0] as FakeContext['nodes'][number] & { pan: { value: number } };
    expect(p.pan.value).toBe(-0.4);
    expect(p.out).toEqual([bus.sfx]);
  });

  it('a full level and the centre add no nodes', () => {
    const { audio, ctx, bus } = ready();
    audio.play('tap', { gain: 1, pan: 0 });
    expect(sources(ctx)[0].out).toEqual([bus.sfx]);
    expect(ctx.of('panner')).toHaveLength(0);
  });

  it('a browser without stereo panners still plays the sound, centred', () => {
    const { audio, ctx, bus } = ready();
    (ctx as { createStereoPanner?: unknown }).createStereoPanner = undefined;
    audio.play('hitIce', { pan: 0.5 });
    expect(sources(ctx)[0].out).toEqual([bus.sfx]);
  });

  it('copies of one sound inside its gap are dropped', () => {
    const { audio, ctx } = ready();
    for (let i = 0; i < 10; i++) audio.play('hitFire');
    ctx.currentTime += SFX.hitFire.gap;
    audio.play('hitFire');
    expect(sources(ctx).map(idOf)).toEqual(['hitFire', 'hitFire']);
  });

  it('stays quiet when the effects are off, the context is not running or the sound is not in yet', () => {
    const { audio, tap } = setupAudio();
    tap();
    audio.play('tap');
    const ctx = FakeContext.made[0];
    answer(FakeWorker.made[0]);
    audio.prefs({ music: true, sfx: false });
    audio.play('tap');
    audio.prefs({ music: true, sfx: true });
    ctx.state = 'suspended';
    audio.play('tap');
    expect(sources(ctx)).toHaveLength(0);
  });

  it('a frame of battle plays the cue of each event, nothing for an empty frame', () => {
    const { audio, ctx } = ready();
    audio.battle([]);
    expect(sources(ctx)).toHaveLength(0);
    audio.battle([
      { type: 'hit', kind: 'ice', x: 0, y: 0, radius: 10 },
      { type: 'kill', kind: 'grunt', x: 1080, y: 0, gold: 1, boss: false },
      { type: 'end', won: false },
    ]);
    expect(sources(ctx).map(idOf)).toEqual(['hitIce', 'kill', 'lose']);
  });
});
