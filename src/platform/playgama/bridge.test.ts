import { describe, expect, it } from 'vitest';
import { AD_PLAY_MS, AD_START_MS, BRIDGE_WAIT_MS, PlaygamaBridge } from './bridge';
import { fakeBridge } from './testBridge';

/** Timers a test runs by hand: `run(ms)` fires the one set for `ms`. */
function manualTimers() {
  const set = new Map<number, () => void>();
  let id = 0;
  const ms = new Map<number, number>();
  return {
    timers: {
      set: (fn: () => void, after: number) => (set.set(++id, fn), ms.set(id, after), id),
      clear: (t: unknown) => void set.delete(t as number),
    },
    run(after: number) {
      for (const [k, fn] of [...set]) if (ms.get(k) === after) (set.delete(k), fn());
    },
  };
}

const never = () => new Promise<void>(() => {});

describe('PlaygamaBridge', () => {
  it('is a no-op without the script', async () => {
    const b = new PlaygamaBridge({});
    expect(await b.init()).toBe(false);
    b.send('game_ready');
    b.track('x');
    expect([b.isReady(), b.platformId(), b.rewardedSupported(), await b.rewarded(), (await b.load(['k'])).size]).toEqual([false, null, false, false, 0]);
  });

  it('gives up on an initialize that never answers', async () => {
    const waited: number[] = [];
    const b = new PlaygamaBridge({ bridge: { initialize: never } }, async (ms) => void waited.push(ms));
    expect(await b.init()).toBe(false);
    expect(waited).toEqual([BRIDGE_WAIT_MS]);
  });

  it('reads stored values as strings, objects stringified again', async () => {
    const f = fakeBridge({ stored: { a: 'x', b: { n: 1 } } });
    const b = new PlaygamaBridge(f.global, never);
    await b.init();
    expect([...(await b.load(['a', 'b', 'c']))]).toEqual([['a', 'x'], ['b', '{"n":1}']]);
  });

  it('reports the sound switch now and on every change', async () => {
    const f = fakeBridge({ audio: false });
    const b = new PlaygamaBridge(f.global, never);
    await b.init();
    const muted: boolean[] = [];
    b.onMute((m) => muted.push(m));
    f.emit('audio_state_changed', true);
    expect(muted).toEqual([true, false]);
  });

  it('pays a rewarded ad only once it rewarded and closed', async () => {
    const f = fakeBridge();
    const b = new PlaygamaBridge(f.global, never);
    await b.init();
    let started = 0;
    const paid = b.rewarded(() => started++);
    for (const s of ['loading', 'opened', 'rewarded', 'closed']) f.emit('rewarded_state_changed', s);
    expect([await paid, started]).toEqual([true, 1]);
    const skipped = b.rewarded();
    for (const s of ['opened', 'closed']) f.emit('rewarded_state_changed', s);
    expect(await skipped).toBe(false);
  });

  it('gives up an ad that never opens, or opens and never closes', async () => {
    const t = manualTimers();
    const f = fakeBridge();
    const b = new PlaygamaBridge(f.global, never, t.timers);
    await b.init();
    const unopened = b.rewarded();
    t.run(AD_START_MS);
    expect(await unopened).toBe(false);
    const stuck = b.rewarded();
    f.emit('rewarded_state_changed', 'opened');
    f.emit('rewarded_state_changed', 'rewarded');
    t.run(AD_START_MS);
    t.run(AD_PLAY_MS);
    expect(await stuck).toBe(false);
  });

  it('plays no interstitial where the platform has none, and ends on a failure', async () => {
    const none = fakeBridge({ interstitial: false });
    const b = new PlaygamaBridge(none.global, never);
    await b.init();
    await b.interstitial();
    expect(none.shown).toEqual([]);
    const f = fakeBridge();
    const c = new PlaygamaBridge(f.global, never);
    await c.init();
    const ad = c.interstitial();
    f.emit('interstitial_state_changed', 'failed');
    await ad;
    expect(f.shown).toEqual(['interstitial']);
  });

  it('knows an adblocker from boot', async () => {
    const f = fakeBridge({ adblock: true });
    const b = new PlaygamaBridge(f.global, never);
    await b.init();
    expect(b.hasAdblock()).toBe(true);
  });

  it('counts an initialize that rejects as no Bridge', async () => {
    const b = new PlaygamaBridge({ bridge: { initialize: async () => Promise.reject(new Error('blocked')) } }, never);
    expect(await b.init()).toBe(false);
    expect(b.isReady()).toBe(false);
  });

  it("reads the script's version, null when it gives none", async () => {
    const f = fakeBridge();
    const b = new PlaygamaBridge(f.global, never);
    expect(b.version()).toBeNull();
    await b.init();
    expect(b.version()).toBe('2.9.0');
    (f.global.bridge as { version?: unknown }).version = 3;
    expect(b.version()).toBeNull();
  });

  it('fails an ad whose show call throws, and the next one still plays', async () => {
    const f = fakeBridge();
    f.global.bridge!.advertisement!.showRewarded = () => {
      throw new Error('cooldown');
    };
    const b = new PlaygamaBridge(f.global, never);
    await b.init();
    expect(await b.rewarded()).toBe(false);
    f.global.bridge!.advertisement!.showRewarded = () => void f.shown.push('rewarded');
    const ad = b.rewarded();
    for (const s of ['opened', 'rewarded', 'closed']) f.emit('rewarded_state_changed', s);
    expect(await ad).toBe(true);
  });
});
