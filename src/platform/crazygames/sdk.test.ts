import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AD_PLAY_MS, AD_START_MS, ADBLOCK_WAIT_MS, CrazyGamesSdk, type CgAdCallbacks, type CgGlobal } from './sdk';

// The SDK's calls that can hang: an ad that never calls back, and an adblock probe that never
// answers. Neither may hold the game.

/** An enabled SDK whose ads hand their callbacks to the test. */
async function sdk(ad: NonNullable<NonNullable<NonNullable<CgGlobal['CrazyGames']>['SDK']>['ad']>, clock?: { now: () => number; sleep: (ms: number) => Promise<void> }) {
  const global: CgGlobal = { CrazyGames: { SDK: { environment: 'crazygames', ad } } };
  // init polls on its own sleep, which fake timers would hold
  const s = new CrazyGamesSdk(global, clock?.now, clock?.sleep ?? (async () => undefined));
  await s.init();
  return s;
}

describe('CrazyGamesSdk.requestAd watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives up an ad that never starts', async () => {
    const s = await sdk({ requestAd: () => undefined });
    let result: boolean | undefined;
    void s.requestAd('rewarded').then((ok) => (result = ok));
    await vi.advanceTimersByTimeAsync(AD_START_MS - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBe(false);
  });

  it('lets a started ad play, but not forever', async () => {
    let cb: CgAdCallbacks = {};
    const s = await sdk({ requestAd: (_t, c) => void (cb = c) });
    let result: boolean | undefined;
    void s.requestAd('midgame').then((ok) => (result = ok));
    await vi.advanceTimersByTimeAsync(AD_START_MS - 100);
    cb.adStarted?.();
    await vi.advanceTimersByTimeAsync(AD_PLAY_MS - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBe(false);
    // a late finish changes nothing
    cb.adFinished?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toBe(false);
  });

  it('settles a finished ad once and leaves no timer behind', async () => {
    let cb: CgAdCallbacks = {};
    const s = await sdk({ requestAd: (_t, c) => void (cb = c) });
    const p = s.requestAd('rewarded');
    cb.adStarted?.();
    cb.adFinished?.();
    expect(await p).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('CrazyGamesSdk.hasAdblock', () => {
  /** A clock that moves only as the SDK sleeps. */
  function clock() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => void (t += ms) };
  }

  it('says false when the probe never answers, within its deadline', async () => {
    const c = clock();
    const s = await sdk({ hasAdblock: () => new Promise(() => undefined) }, c);
    const start = c.now();
    expect(await s.hasAdblock()).toBe(false);
    expect(c.now() - start).toBeGreaterThanOrEqual(ADBLOCK_WAIT_MS);
    expect(c.now() - start).toBeLessThan(ADBLOCK_WAIT_MS + 200);
  });

  it('reads and keeps a timely answer', async () => {
    let asked = 0;
    const s = await sdk({ hasAdblock: async () => (asked++, true) }, clock());
    expect(await s.hasAdblock()).toBe(true);
    expect(await s.hasAdblock()).toBe(true);
    expect(asked).toBe(1);
  });
});
