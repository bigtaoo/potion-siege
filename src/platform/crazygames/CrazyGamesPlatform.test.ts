import { beforeAll, describe, expect, it } from 'vitest';
import { CrazyGamesPlatform } from './CrazyGamesPlatform';
import { CrazyGamesSdk, type CgGlobal } from './sdk';

beforeAll(() => {
  (globalThis as { location?: unknown }).location ??= { search: '' };
});

/** A platform over a stub SDK in `environment`, logging the game hooks it receives. */
async function platform(environment: string, ad?: NonNullable<NonNullable<CgGlobal['CrazyGames']>['SDK']>['ad']): Promise<{ p: CrazyGamesPlatform; calls: string[] }> {
  const calls: string[] = [];
  const hook = (name: string) => () => void calls.push(name);
  const global: CgGlobal = {
    CrazyGames: {
      SDK: {
        environment,
        game: { loadingStart: hook('loadingStart'), loadingStop: hook('loadingStop'), gameplayStart: hook('gameplayStart'), gameplayStop: hook('gameplayStop') },
        ad,
      },
    },
  };
  const p = await CrazyGamesPlatform.create(new CrazyGamesSdk(global));
  await Promise.resolve();
  return { p, calls };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('CrazyGamesPlatform', () => {
  it('never sends gameplayStart before loadingStop', async () => {
    const { p, calls } = await platform('crazygames');
    p.gameplayStart();
    await flush();
    expect(calls).toEqual(['loadingStart']);
    p.loaded();
    p.loaded();
    p.gameplayStart();
    await flush();
    expect(calls).toEqual(['loadingStart', 'loadingStop', 'gameplayStart']);
  });

  it('drops a waiting start that was stopped before loading ended', async () => {
    const { p, calls } = await platform('crazygames');
    p.gameplayStart();
    p.gameplayStop();
    p.loaded();
    await flush();
    expect(calls).toEqual(['loadingStart', 'loadingStop']);
  });

  it('follows the portal mute: the current state at once, then every change', async () => {
    let change: ((settings: unknown) => void) | undefined;
    const global: CgGlobal = {
      CrazyGames: {
        SDK: {
          environment: 'crazygames',
          game: { settings: { muteAudio: true }, addSettingsChangeListener: (l) => void (change = l) },
        },
      },
    };
    const p = await CrazyGamesPlatform.create(new CrazyGamesSdk(global));
    const muted: boolean[] = [];
    p.onHostMute((m) => muted.push(m));
    await flush();
    change?.({ muteAudio: false });
    change?.({ muteAudio: true });
    expect(muted).toEqual([true, false, true]);
  });

  it('reports a local SDK as the web, the portal as crazygames', async () => {
    expect((await platform('local')).p.name).toBe('web');
    expect((await platform('crazygames')).p.name).toBe('crazygames');
  });

  it('offers no links out of the game, as the portal requires', async () => {
    expect((await platform('crazygames')).p.openUrl).toBeUndefined();
  });
});

/** An ad module that answers every request the way `answer` says, logging what was asked. */
function ads(answer: 'finished' | 'error' | 'throws', opts: { adblock?: boolean; basicLaunch?: boolean } = {}) {
  const asked: string[] = [];
  return {
    asked,
    ad: {
      requestAd: (type: string, cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }) => {
        asked.push(type);
        if (answer === 'throws') throw new Error('sdk broke');
        if (answer === 'error') return void cb.adError?.({ code: 'unfilled' });
        cb.adStarted?.();
        cb.adFinished?.();
      },
      hasAdblock: async () => opts.adblock === true,
      prefetchAd: () => {
        if (opts.basicLaunch) throw Object.assign(new Error('basic launch'), { code: 'adsDisabledBasicLaunch' });
      },
    },
  };
}

describe('CrazyGamesPlatform ads', () => {
  it('pays a rewarded ad that finished, after telling the game it started', async () => {
    const { ad, asked } = ads('finished');
    const { p } = await platform('crazygames', ad);
    let started = 0;
    expect(p.rewardedAvailable()).toBe(true);
    expect(await p.rewarded(() => started++)).toBe(true);
    expect(started).toBe(1);
    expect(asked).toEqual(['rewarded']);
  });

  it('pays nothing for an unfilled ad or an SDK that threw', async () => {
    for (const answer of ['error', 'throws'] as const) {
      const { p } = await platform('crazygames', ads(answer).ad);
      let started = 0;
      expect(await p.rewarded(() => started++), answer).toBe(false);
      expect(started, answer).toBe(0);
    }
  });

  it('grants the reward without an ad in Basic Launch, and plays no midgame there', async () => {
    const { ad, asked } = ads('error', { basicLaunch: true });
    const { p } = await platform('crazygames', ad);
    expect(await p.rewarded(() => {})).toBe(true);
    await p.midgame(() => {});
    expect(asked).toEqual([]);
  });

  it('hides rewarded ads under an adblocker, saying so, and off the portal', async () => {
    const blocked = (await platform('crazygames', ads('finished', { adblock: true }).ad)).p;
    expect([blocked.rewardedAvailable(), blocked.adBlocked()]).toEqual([false, true]);
    const off = (await platform('disabled', ads('finished').ad)).p;
    expect([off.rewardedAvailable(), off.adBlocked()]).toEqual([false, false]);
  });

  it('tells the session where the portal runs the game and whether it is in Basic Launch', async () => {
    const global: CgGlobal = { CrazyGames: { SDK: { environment: 'crazygames', user: { systemInfo: { applicationType: 'google_play_store' } }, ad: ads('error', { basicLaunch: true }).ad } } };
    expect((await CrazyGamesPlatform.create(new CrazyGamesSdk(global))).sessionProps()).toEqual({ app: 'google_play_store', basic: true });
    const odd: CgGlobal = { CrazyGames: { SDK: { environment: 'crazygames', user: { systemInfo: { applicationType: 'Web App!' } } } } };
    expect((await CrazyGamesPlatform.create(new CrazyGamesSdk(odd))).sessionProps()).toEqual({ basic: false });
    expect((await platform('disabled')).p.sessionProps()).toEqual({});
  });

  it('keeps the rewards under an adblocker in Basic Launch, where they come without an ad', async () => {
    const { p } = await platform('crazygames', ads('error', { adblock: true, basicLaunch: true }).ad);
    expect([p.rewardedAvailable(), p.adBlocked(), await p.rewarded(() => {})]).toEqual([true, false, true]);
  });

  it('plays a midgame ad on the portal', async () => {
    const { ad, asked } = ads('finished');
    const { p } = await platform('crazygames', ad);
    let started = 0;
    await p.midgame(() => started++);
    expect(started).toBe(1);
    expect(asked).toEqual(['midgame']);
  });
});
