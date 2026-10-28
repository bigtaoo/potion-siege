import { afterEach, describe, expect, it, vi } from 'vitest';
import { answer, buses, FakeContext, FakeGain, FakeSource, FakeWorker, last, settle, setupAudio } from './fakeAudio';

afterEach(() => {
  vi.unstubAllGlobals();
  FakeContext.made = [];
  FakeWorker.made = [];
});

/** A game audio past its first tap; the loops are rendered only when `loops` is set. */
function ready(loops = true) {
  const s = setupAudio();
  s.tap();
  const ctx = FakeContext.made[0];
  const worker = FakeWorker.made[0];
  answer(worker, (j) => loops || j.kind === 'sfx');
  return { ...s, ctx, worker, bus: buses(ctx) };
}

/** The loops started so far, oldest first, with the gain each one goes through. */
const loops = (ctx: FakeContext): { src: FakeSource; gain: FakeGain }[] =>
  (ctx.of('source') as FakeSource[]).filter((s) => s.loop).map((src) => ({ src, gain: src.out[0] as FakeGain }));

describe('the music', () => {
  it('fades the first loop in over a short fade, looping into the music bus', () => {
    const { audio, ctx, bus } = ready();
    ctx.currentTime = 2;
    audio.music('workshop');
    const [{ src, gain }] = loops(ctx);
    expect(src.buffer!.length).toBe(4000);
    expect(src.started).toBe(2);
    expect(gain.out).toEqual([bus.music]);
    expect(gain.gain.calls).toEqual([['set', 0, 2], ['ramp', 1, 2.8]]);
    expect(audio.status().playing).toBe('workshop');
  });

  it('a change crossfades: the old loop ramps out and stops, the new one ramps in', () => {
    const { audio, ctx } = ready();
    audio.music('workshop');
    ctx.currentTime = 10;
    audio.music('battle');
    const [old, now] = loops(ctx);
    expect(old.gain.gain.calls.slice(2)).toEqual([['cancel', 10], ['set', 1, 10], ['ramp', 0, 11.6]]);
    expect(old.src.stopped).toBeCloseTo(11.65);
    expect(now.src.buffer!.length).toBe(5000);
    expect(now.gain.gain.calls).toEqual([['set', 0, 10], ['ramp', 1, 11.6]]);
    expect(audio.status().playing).toBe('battle');
  });

  it('asking for the loop already wanted changes nothing', () => {
    const { audio, ctx } = ready();
    audio.music('battle');
    audio.music('battle');
    expect(loops(ctx)).toHaveLength(1);
  });

  it('none fades the loop out and leaves silence', () => {
    const { audio, ctx } = ready();
    audio.music('battle');
    audio.music(null);
    const [only] = loops(ctx);
    expect(last(only.gain.gain)).toBe(0);
    expect(only.src.stopped).not.toBeNull();
    expect(loops(ctx)).toHaveLength(1);
    expect(audio.status().playing).toBeNull();
  });

  it('a loop not rendered yet comes in when it is ready; the other one arriving starts nothing', () => {
    const { audio, ctx, worker } = ready(false);
    audio.music('battle');
    expect(audio.status().playing).toBeNull();
    answer(worker, (j) => j.kind === 'music' && j.id === 'workshop');
    expect(loops(ctx)).toHaveLength(0);
    answer(worker, (j) => j.kind === 'music' && j.id === 'battle');
    expect(audio.status().playing).toBe('battle');
    expect(loops(ctx)[0].src.buffer!.length).toBe(5000);
  });

  it('the loop asked for before the first tap starts once rendered', () => {
    const { audio, tap } = setupAudio();
    audio.music('workshop');
    tap();
    answer(FakeWorker.made[0]);
    expect(audio.status().playing).toBe('workshop');
  });
});

describe('mute and levels', () => {
  it('the music toggle mutes its bus only, and back', () => {
    const { audio, ctx, bus } = ready();
    audio.prefs({ music: false, sfx: true });
    expect([last(bus.music.gain), last(bus.sfx.gain)]).toEqual([0, 1]);
    expect(ctx.state).toBe('running');
    audio.prefs({ music: true, sfx: true });
    expect([last(bus.music.gain), last(bus.sfx.gain)]).toEqual([0.5, 1]);
  });

  it('with both toggles off the context is suspended, and resumed when one comes back', () => {
    const { audio, ctx, bus } = ready();
    audio.prefs({ music: false, sfx: false });
    expect([last(bus.music.gain), last(bus.sfx.gain)]).toEqual([0, 0]);
    expect(ctx.state).toBe('suspended');
    audio.prefs({ music: false, sfx: true });
    expect(ctx.state).toBe('running');
    expect(ctx.calls).toEqual(['resume', 'suspend', 'resume']);
  });

  it('an ad and the portal mute silence everything until they end', () => {
    for (const set of [(a: ReturnType<typeof ready>['audio'], on: boolean) => a.ad(on), (a: ReturnType<typeof ready>['audio'], on: boolean) => a.host(on)]) {
      const { audio, ctx, bus } = ready();
      set(audio, true);
      expect([last(bus.music.gain), last(bus.sfx.gain), ctx.state]).toEqual([0, 0, 'suspended']);
      expect(audio.mix.open).toBe(false);
      set(audio, false);
      expect([last(bus.music.gain), last(bus.sfx.gain), ctx.state]).toEqual([0.5, 1, 'running']);
      FakeContext.made = [];
      FakeWorker.made = [];
    }
  });

  it('the toggles alone touch nothing before the context exists', () => {
    const { audio } = setupAudio();
    audio.prefs({ music: false, sfx: false });
    audio.ad(true);
    audio.host(true);
    expect(audio.mix.running).toBe(false);
    expect(audio.status().state).toBe('none');
  });
});

describe('a hidden tab', () => {
  it('suspends the context while hidden and resumes it when shown', () => {
    const { audio, ctx, doc, bus } = ready();
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    expect(audio.mix.hidden).toBe(true);
    expect([last(bus.music.gain), last(bus.sfx.gain), ctx.state]).toEqual([0, 0, 'suspended']);
    doc.visibilityState = 'visible';
    doc.fire('visibilitychange');
    expect(audio.mix.hidden).toBe(false);
    expect(ctx.state).toBe('running');
  });

  it('a tap while everything is muted does not wake the context', () => {
    const { audio, ctx, tap } = ready();
    audio.prefs({ music: false, sfx: false });
    tap('keydown');
    expect(ctx.state).toBe('suspended');
    expect(ctx.calls).toEqual(['resume', 'suspend']);
  });

  it('a tap wakes a context the browser suspended on its own', () => {
    const { ctx, tap } = ready();
    ctx.state = 'suspended';
    tap();
    expect(ctx.state).toBe('running');
    expect(ctx.calls).toEqual(['resume', 'resume']);
  });

  it('the browser interrupting the context is answered with a resume when sound is wanted', () => {
    const { audio, ctx } = ready();
    ctx.become('suspended');
    expect(ctx.state).toBe('running');
    audio.prefs({ music: false, sfx: false });
    ctx.become('running');
    expect(ctx.state).toBe('suspended');
    expect(ctx.calls).toEqual(['resume', 'resume', 'suspend', 'suspend']);
  });
});

describe('refusals', () => {
  it('a resume the browser refuses is swallowed and tried again on the next tap', async () => {
    // an unhandled rejection would fail the run
    const s = setupAudio();
    s.tap();
    const ctx = FakeContext.made[0];
    ctx.state = 'suspended';
    ctx.failNext = true;
    s.tap();
    await settle();
    expect(ctx.state).toBe('suspended');
    expect(ctx.calls).toEqual(['resume', 'resume']);
    s.tap();
    expect(ctx.state).toBe('running');
  });

  it('a suspend the browser refuses leaves the context running and the buses silent', async () => {
    const { audio, ctx, bus } = ready();
    ctx.failNext = true;
    audio.ad(true);
    await settle();
    expect(ctx.state).toBe('running');
    expect([last(bus.music.gain), last(bus.sfx.gain)]).toEqual([0, 0]);
    audio.play('tap');
    expect(ctx.of('source')).toHaveLength(0);
  });

  it('a refused resume while the context is made is tried again by the same gesture', async () => {
    const { audio, tap } = setupAudio();
    const Shy = class extends FakeContext {
      constructor() {
        super();
        this.failNext = true;
      }
    };
    vi.stubGlobal('window', { AudioContext: Shy });
    tap();
    await settle();
    expect(audio.status().state).toBe('running');
    expect(FakeContext.made[0].calls).toEqual(['resume', 'resume']);
  });
});
