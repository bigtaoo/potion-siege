import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AD_PLAY_MS, AD_START_MS, ADBLOCK_WAIT_MS, CrazyGamesSdk, SDK_WAIT_MS, type CgAdCallbacks, type CgGlobal } from './sdk';

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

  it('asks a failing probe again later', async () => {
    let asked = 0;
    const probe = () => {
      if (++asked === 1) throw new Error('probe broke');
      return true;
    };
    const s = await sdk({ hasAdblock: probe }, clock());
    expect(await s.hasAdblock()).toBe(false);
    expect(await s.hasAdblock()).toBe(true);
    expect(asked).toBe(2);
  });
});

/** A clock that moves only as the SDK sleeps, running `onSleep` at each step. */
function steppingClock(onSleep: (t: number) => void = () => {}) {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void onSleep((t += ms)) };
}

type Sdk = NonNullable<NonNullable<CgGlobal['CrazyGames']>['SDK']>;

describe('CrazyGamesSdk.init', () => {
  it('gives up on a missing script at its deadline', async () => {
    const c = steppingClock();
    expect(await new CrazyGamesSdk({}, c.now, c.sleep).init()).toBe('disabled');
    expect(c.now()).toBeGreaterThanOrEqual(SDK_WAIT_MS);
    expect(c.now()).toBeLessThan(SDK_WAIT_MS + 100);
  });

  it('waits for a script that arrives late', async () => {
    const global: CgGlobal = {};
    const c = steppingClock((t) => {
      if (t >= 500) global.CrazyGames = { SDK: { environment: 'crazygames' } };
    });
    const s = new CrazyGamesSdk(global, c.now, c.sleep);
    expect(await s.init()).toBe('crazygames');
    expect([s.environment(), s.isEnabled()]).toEqual(['crazygames', true]);
  });

  it('gets past an init that throws, rejects or never settles', async () => {
    const inits = [
      () => {
        throw new Error('init broke');
      },
      () => Promise.reject(new Error('init rejected')),
      () => new Promise(() => undefined),
    ];
    for (const init of inits) {
      const c = steppingClock();
      expect(await new CrazyGamesSdk({ CrazyGames: { SDK: { environment: 'local', init } } }, c.now, c.sleep).init()).toBe('local');
      expect(c.now()).toBeLessThanOrEqual(SDK_WAIT_MS + 100);
    }
  });

  it("asks v2's getEnvironment, and polls for an environment that appears after init", async () => {
    const c = steppingClock();
    expect(await new CrazyGamesSdk({ CrazyGames: { SDK: { getEnvironment: async () => 'local' } } }, c.now, c.sleep).init()).toBe('local');
    const late: Sdk = {};
    const lc = steppingClock((t) => {
      if (t >= 300) late.environment = 'crazygames';
    });
    expect(await new CrazyGamesSdk({ CrazyGames: { SDK: late } }, lc.now, lc.sleep).init()).toBe('crazygames');
  });

  it('says disabled for an environment it does not know', async () => {
    const c = steppingClock();
    const s = new CrazyGamesSdk({ CrazyGames: { SDK: { environment: 'staging', getEnvironment: () => 'beta' } } }, c.now, c.sleep);
    expect(await s.init()).toBe('disabled');
    expect(s.isEnabled()).toBe(false);
  });
});

/** An SDK in `environment` with `parts`, after init. */
async function ready(parts: Sdk, environment = 'crazygames') {
  const s = new CrazyGamesSdk({ CrazyGames: { SDK: { environment, ...parts } } }, undefined, async () => undefined);
  await s.init();
  return s;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('CrazyGamesSdk off the portal', () => {
  it('asks nothing of an SDK that says disabled', async () => {
    const asked: string[] = [];
    const log = (name: string) => () => void asked.push(name);
    const s = await ready(
      {
        ad: { requestAd: log('requestAd') },
        user: { isUserAccountAvailable: true, systemInfo: { locale: 'de-DE', countryCode: 'DE', device: { type: 'mobile' }, applicationType: 'web' } },
        game: { settings: { muteAudio: true }, addSettingsChangeListener: log('settings') },
        data: { getItem: () => 'x', setItem: log('setItem') },
      },
      'disabled',
    );
    const muted: boolean[] = [];
    s.onMuteChange((m) => muted.push(m));
    expect(await s.requestAd('rewarded')).toBe(false);
    expect([s.accountsAvailable(), s.locale(), s.countryCode(), s.deviceType(), s.applicationType(), s.dataStore()]).toEqual([false, null, null, null, null, null]);
    await flush();
    expect([asked, muted]).toEqual([[], []]);
  });

  it('makes every call a no-op without the script', async () => {
    const s = new CrazyGamesSdk({}, undefined, async () => undefined);
    s.loadingStart();
    s.gameplayStart();
    s.gameplayStop();
    s.happytime();
    s.clearBanner('banner');
    s.onAuthChange(() => {});
    await s.requestBanner('banner', 300, 250);
    expect([await s.hasAdblock(), s.adsAllowed(), await s.userName()]).toEqual([false, true, null]);
  });
});

describe('CrazyGamesSdk on the portal', () => {
  it('passes the game hooks on, and keeps their throws and rejections from the game', async () => {
    const asked: string[] = [];
    const boom = (name: string) => () => {
      asked.push(name);
      throw new Error(name);
    };
    const s = await ready({
      game: {
        loadingStart: boom('loadingStart'),
        loadingStop: boom('loadingStop'),
        gameplayStart: async () => void asked.push('gameplayStart'),
        gameplayStop: () => Promise.reject(new Error('stop')),
        happytime: boom('happytime'),
      },
      banner: { requestBanner: (o) => void asked.push(`banner ${o.id} ${o.width}x${o.height}`), clearBanner: boom('clearBanner') },
    });
    s.loadingStart();
    s.loadingStop();
    s.gameplayStart();
    s.gameplayStop();
    s.happytime();
    await s.requestBanner('cg-banner', 728, 90);
    s.clearBanner('cg-banner');
    await flush();
    expect(asked).toEqual(['loadingStart', 'loadingStop', 'gameplayStart', 'happytime', 'banner cg-banner 728x90', 'clearBanner']);
  });

  it("reads the player's locale, country, device and app only when they look right", async () => {
    const good = await ready({ user: { systemInfo: { locale: 'de-DE', countryCode: 'de', device: { type: 'tablet' }, applicationType: 'apple_store' } } });
    expect([good.locale(), good.countryCode(), good.deviceType(), good.applicationType()]).toEqual(['de-DE', 'DE', 'tablet', 'apple_store']);
    const odd = await ready({ user: { systemInfo: { locale: '', countryCode: 'DEU', device: { type: 3 }, applicationType: 'Web' } } });
    expect([odd.locale(), odd.countryCode(), odd.deviceType(), odd.applicationType()]).toEqual([null, null, null, null]);
    const none = await ready({});
    expect([none.locale(), none.countryCode(), none.deviceType(), none.applicationType()]).toEqual([null, null, null, null]);
  });

  it('names a signed-in player, and nobody for a guest or a failing call', async () => {
    const named = async (getUser: () => unknown) => (await ready({ user: { getUser } })).userName();
    expect(await named(async () => ({ username: 'brewer' }))).toBe('brewer');
    expect(await named(async () => null)).toBeNull();
    expect(await named(() => ({ username: '' }))).toBeNull();
    expect(await named(() => ({ username: 42 }))).toBeNull();
    const broken = () => {
      throw new Error('no user module');
    };
    expect(await named(broken)).toBeNull();
  });

  it('offers accounts only where the portal says it has them', async () => {
    expect((await ready({ user: { isUserAccountAvailable: true } })).accountsAvailable()).toBe(true);
    expect((await ready({ user: { isUserAccountAvailable: 'yes' } })).accountsAvailable()).toBe(false);
    expect((await ready({})).accountsAvailable()).toBe(false);
  });

  it("tells the game of a sign-in, without the game's throw reaching the SDK", async () => {
    let auth: ((user: unknown) => void) | undefined;
    const s = await ready({ user: { addAuthListener: (l) => void (auth = l) } });
    let calls = 0;
    s.onAuthChange(() => {
      calls++;
      throw new Error('game broke');
    });
    await flush();
    expect(() => auth?.({ username: 'brewer' })).not.toThrow();
    expect(calls).toBe(1);
  });

  it('reads odd settings as not muted', async () => {
    let change: ((settings: unknown) => void) | undefined;
    const s = await ready({ game: { addSettingsChangeListener: (l) => void (change = l) } });
    const muted: boolean[] = [];
    s.onMuteChange((m) => muted.push(m));
    await flush();
    change?.(null);
    change?.({ muteAudio: 'yes' });
    expect(muted).toEqual([false, false, false]);
  });
});

describe('CrazyGamesSdk.dataStore', () => {
  it('passes reads and writes to the data module, a non-string read as null', async () => {
    const map = new Map<string, unknown>([['n', 7]]);
    const store = (await ready({ data: { getItem: (k) => map.get(k), setItem: (k, v) => void map.set(k, v) } })).dataStore();
    store?.setItem('mb.save', '{}');
    expect([store?.getItem('mb.save'), store?.getItem('n'), store?.getItem('none')]).toEqual(['{}', null, null]);
  });

  it('has none where the module or one of its calls is missing', async () => {
    expect((await ready({})).dataStore()).toBeNull();
    expect((await ready({ data: { getItem: () => null } })).dataStore()).toBeNull();
  });
});

describe('CrazyGamesSdk ads', () => {
  it("finishes an ad whose game hooks throw, and hands an unfilled ad's error to the game", async () => {
    let cb: CgAdCallbacks = {};
    const s = await ready({ ad: { requestAd: (_t, c) => void (cb = c) } });
    const boom = () => {
      throw new Error('game hook');
    };
    const finished = s.requestAd('rewarded', { adStarted: boom, adFinished: boom });
    cb.adStarted?.();
    cb.adFinished?.();
    expect(await finished).toBe(true);
    const errors: unknown[] = [];
    const unfilled = s.requestAd('midgame', { adError: (e) => errors.push(e) });
    cb.adError?.({ code: 'unfilled' });
    expect([await unfilled, errors]).toEqual([false, [{ code: 'unfilled' }]]);
  });

  it('tells the game of a request that threw', async () => {
    const broken = () => {
      throw new Error('sdk broke');
    };
    const s = await ready({ ad: { requestAd: broken } });
    const errors: unknown[] = [];
    expect(await s.requestAd('rewarded', { adError: (e) => errors.push(e) })).toBe(false);
    expect(errors).toEqual([new Error('requestAd threw')]);
  });

  it('allows ads unless prefetch says Basic Launch, and asks only once', async () => {
    let asked = 0;
    const network = () => {
      asked++;
      throw new Error('network');
    };
    const other = await ready({ ad: { prefetchAd: network } });
    expect([other.adsAllowed(), other.adsAllowed(), asked]).toEqual([true, true, 1]);
    const basicLaunch = () => {
      throw Object.assign(new Error('basic'), { code: 'adsDisabledBasicLaunch' });
    };
    expect((await ready({ ad: { prefetchAd: basicLaunch } })).adsAllowed()).toBe(false);
  });
});
