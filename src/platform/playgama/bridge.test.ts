import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADBLOCK_WAIT_MS, AD_PLAY_MS, AD_START_MS, BRIDGE_WAIT_MS, PlaygamaBridge } from './bridge';
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

  it('waits on real timers by default, and boots without a Bridge that never answers', async () => {
    vi.useFakeTimers();
    const b = new PlaygamaBridge({ bridge: { initialize: never } });
    const ready = b.init();
    await vi.advanceTimersByTimeAsync(BRIDGE_WAIT_MS);
    expect(await ready).toBe(false);
    expect(b.isReady()).toBe(false);
  });

  it('counts an adblock probe that never answers as no adblocker', async () => {
    const waited: number[] = [];
    const f = fakeBridge();
    f.global.bridge!.advertisement!.checkAdBlock = never;
    const b = new PlaygamaBridge(f.global, async (ms) => {
      waited.push(ms);
      if (ms === BRIDGE_WAIT_MS) await never();
    });
    expect(await b.init()).toBe(true);
    expect([b.hasAdblock(), waited]).toEqual([false, [BRIDGE_WAIT_MS, ADBLOCK_WAIT_MS]]);
  });

  it('reads language and device only when the platform names them', async () => {
    const f = fakeBridge({ language: 'de' });
    const b = new PlaygamaBridge(f.global, never);
    expect([b.language(), b.deviceType()]).toEqual([null, null]);
    await b.init();
    expect([b.language(), b.deviceType()]).toEqual(['de', 'desktop']);
    f.global.bridge!.platform!.language = '';
    f.global.bridge!.device = { type: '' };
    expect([b.language(), b.deviceType()]).toEqual([null, null]);
    delete f.global.bridge!.device;
    expect(b.deviceType()).toBeNull();
  });

  it("names the player's account only while they are signed in", async () => {
    const f = fakeBridge({ player: { id: 'u1', isAuthorized: true } });
    const b = new PlaygamaBridge(f.global, never);
    expect(b.accountId()).toBeNull();
    await b.init();
    expect(b.accountId()).toBe('u1');
    f.global.bridge!.player = { id: 'u1', isAuthorized: false };
    expect(b.accountId()).toBeNull();
    f.global.bridge!.player = { id: '', isAuthorized: true };
    expect(b.accountId()).toBeNull();
    delete f.global.bridge!.player;
    expect(b.accountId()).toBeNull();
  });

  it('swallows every SDK call that throws or rejects, and every game callback that throws', async () => {
    const f = fakeBridge();
    const sdk = f.global.bridge!;
    const boom = () => {
      throw new Error('sdk');
    };
    sdk.platform!.sendMessage = boom;
    sdk.analytics!.send = async () => Promise.reject(new Error('sdk'));
    sdk.storage!.get = async () => Promise.reject(new Error('quota'));
    sdk.storage!.set = boom;
    const b = new PlaygamaBridge(f.global, never);
    await b.init();
    b.send('game_ready');
    b.track('x', { a: 1 });
    b.save(new Map([['k', 'v']]));
    expect((await b.load(['k'])).size).toBe(0);
    b.onPause(() => boom());
    b.onMute(() => boom());
    expect(() => f.emit('pause_state_changed', true)).not.toThrow();
    expect(() => f.emit('audio_state_changed', false)).not.toThrow();
    sdk.platform!.on = boom;
    expect(() => b.onPause(() => {})).not.toThrow();
  });

  it('passes the pause on, and reads a storage answer that is not a list as nothing stored', async () => {
    const f = fakeBridge();
    f.global.bridge!.storage!.get = async () => ({ k: 'v' });
    const b = new PlaygamaBridge(f.global, never);
    const paused: boolean[] = [];
    b.onMute(() => paused.push(true));
    expect(paused).toEqual([]);
    await b.init();
    b.onPause((p) => paused.push(p));
    f.emit('pause_state_changed', true);
    f.emit('pause_state_changed', 'nope');
    expect(paused).toEqual([true, false]);
    expect((await b.load(['k'])).size).toBe(0);
  });

  it('plays no ad where the advertisement module cannot report states', async () => {
    const f = fakeBridge();
    delete f.global.bridge!.advertisement!.on;
    const b = new PlaygamaBridge(f.global, never);
    await b.init();
    expect(await b.rewarded()).toBe(false);
    await b.interstitial();
    expect(f.shown).toEqual([]);
  });

  it('gives up an earlier ad still waiting when the next one is asked for', async () => {
    const f = fakeBridge();
    const b = new PlaygamaBridge(f.global, never);
    await b.init();
    const first = b.rewarded();
    f.emit('rewarded_state_changed', 'opened');
    f.emit('rewarded_state_changed', 'rewarded');
    const second = b.rewarded();
    expect(await first).toBe(false);
    // an interstitial's states never reach a rewarded ad
    f.emit('interstitial_state_changed', 'closed');
    for (const s of ['opened', 'rewarded', 'closed']) f.emit('rewarded_state_changed', s);
    expect(await second).toBe(true);
  });

  it('ignores the late failure of an ad that already ended', async () => {
    const f = fakeBridge();
    f.global.bridge!.advertisement!.showRewarded = () => {
      // a cooldown reported as a state, then thrown as well
      f.emit('rewarded_state_changed', 'failed');
      throw new Error('cooldown');
    };
    const b = new PlaygamaBridge(f.global, never);
    await b.init();
    expect(await b.rewarded()).toBe(false);
  });

  it('keeps the game going when the ad-started callback throws', async () => {
    const f = fakeBridge();
    const b = new PlaygamaBridge(f.global, never);
    await b.init();
    const ad = b.interstitial(() => {
      throw new Error('game');
    });
    for (const s of ['opened', 'closed']) f.emit('interstitial_state_changed', s);
    await expect(ad).resolves.toBeUndefined();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
