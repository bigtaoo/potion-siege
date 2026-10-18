import { beforeAll, describe, expect, it } from 'vitest';
import { CrazyGamesPlatform } from './CrazyGamesPlatform';
import { CrazyGamesSdk, type CgGlobal } from './sdk';

beforeAll(() => {
  (globalThis as { location?: unknown }).location ??= { search: '' };
});

/** A platform over a stub SDK in `environment`, logging the game hooks it receives. */
async function platform(environment: string): Promise<{ p: CrazyGamesPlatform; calls: string[] }> {
  const calls: string[] = [];
  const hook = (name: string) => () => void calls.push(name);
  const global: CgGlobal = {
    CrazyGames: {
      SDK: {
        environment,
        game: { loadingStart: hook('loadingStart'), loadingStop: hook('loadingStop'), gameplayStart: hook('gameplayStart'), gameplayStop: hook('gameplayStop') },
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
});
