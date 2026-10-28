import { beforeAll, describe, expect, it, vi } from 'vitest';
import { psNative, type AdState, type PSNative, type StoreState } from './bridge';
import { IosPlatform } from './IosPlatform';
import { AD_FREE_ID } from './storeKit';

// The iOS host over a stub shell: the ad-free card's perk over AdMob, the key store the shell
// mirrors, and the safe-area box the canvas fills.

beforeAll(() => {
  (globalThis as { location?: unknown }).location ??= { search: '' };
});

const ADS_ON: AdState = { status: 'on', rewarded: true, interstitial: true, privacyOptions: false, error: null };

function fakeDoc() {
  const appended: { id: string; style: { cssText: string } }[] = [];
  const doc = {
    createElement: () => ({ id: '', style: { cssText: '' } }),
    body: { appendChild: (el: (typeof appended)[number]) => appended.push(el) },
  };
  return { doc: doc as unknown as Document, appended };
}

function shell(ads: AdState | null, store: StoreState | null) {
  const shown: string[] = [];
  const saved: [string, string][] = [];
  let storeCb: ((s: StoreState) => void) | null = null;
  const native: Partial<PSNative> = {
    saved: { 'ps.save': '{"crystals":7}' },
    save: (k, v) => saved.push([k, v]),
    languages: ['de-DE', 'en'],
    adState: () => ads,
    onAdState: () => {},
    onAdEvent: () => {},
    showAd: (kind) => shown.push(kind),
    store: () => store,
    onStore: (cb) => (storeCb = cb),
    onStoreResult: () => {},
    buy: () => {},
    restore: () => {},
  };
  const { doc, appended } = fakeDoc();
  const platform = new IosPlatform(native, doc);
  return { platform, shown, saved, appended, pushStore: (s: StoreState) => storeCb?.(s) };
}

const NOT_OWNED: StoreState = { products: [{ id: AD_FREE_ID, price: 'US$3.99' }], owned: [], canPay: true };
const OWNED: StoreState = { ...NOT_OWNED, owned: [AD_FREE_ID] };

describe('IosPlatform', () => {
  it('plays AdMob until the card is owned, then pays at once and plays nothing', async () => {
    const s = shell(ADS_ON, NOT_OWNED);
    expect(s.platform.rewardedAvailable()).toBe(true);
    void s.platform.rewarded(() => {});
    void s.platform.midgame(() => {});
    expect(s.shown).toEqual(['rewarded']);

    const owner = shell({ ...ADS_ON, rewarded: false, interstitial: false }, NOT_OWNED);
    expect(owner.platform.rewardedAvailable()).toBe(false);
    owner.pushStore(OWNED);
    let started = 0;
    expect(owner.platform.rewardedAvailable()).toBe(true);
    expect(await owner.platform.rewarded(() => started++)).toBe(true);
    await owner.platform.midgame(() => started++);
    expect([started, owner.shown]).toEqual([0, []]);
  });

  it('sells the card only through a shell that can, and keeps the answer for an offline launch', () => {
    const s = shell(ADS_ON, OWNED);
    expect(s.platform.store?.price()).toBe('US$3.99');
    expect(s.platform.storage.getItem('ps.adFree')).toBe('1');
    expect(s.saved).toContainEqual(['ps.adFree', '1']);

    const safari = new IosPlatform(null, fakeDoc().doc);
    expect(safari.store).toBeNull();
    expect(safari.rewardedAvailable()).toBe(false);
  });

  it("reads the save the shell kept and the phone's languages", () => {
    const s = shell(null, null);
    expect(s.platform.name).toBe('ios');
    expect(s.platform.storage.getItem('ps.save')).toBe('{"crystals":7}');
    expect(s.platform.languages()).toEqual(['de-DE', 'en']);
  });

  it('opens outside pages through the shell, which hands them to Safari', () => {
    const opened: string[] = [];
    const native: Partial<PSNative> = { openUrl: (url) => opened.push(url) };
    new IosPlatform(native, fakeDoc().doc).openUrl('https://p.gamestao.com/privacy');
    expect(opened).toEqual(['https://p.gamestao.com/privacy']);
  });

  it('gives the canvas the screen inside the safe area', () => {
    const s = shell(null, null);
    expect(s.appended).toHaveLength(1);
    expect(s.platform.mount).toBe(s.appended[0]);
    expect(s.appended[0].id).toBe('game');
    for (const side of ['top', 'right', 'bottom', 'left']) expect(s.appended[0].style.cssText).toContain(`${side}:env(safe-area-inset-${side},0px)`);
  });
});

describe('IosPlatform ads', () => {
  it('counts ads as hosted while the shell has not turned them off, or the card is owned', () => {
    expect(shell({ ...ADS_ON, status: 'pending', rewarded: false }, NOT_OWNED).platform.rewardedHosted()).toBe(true);
    const off = shell({ ...ADS_ON, status: 'off', rewarded: false }, NOT_OWNED);
    expect(off.platform.rewardedHosted()).toBe(false);
    off.pushStore(OWNED);
    expect(off.platform.rewardedHosted()).toBe(true);
  });

  it("says why ads last failed to load, and hands a late ad's mute to the game", () => {
    const s = shell({ ...ADS_ON, error: 'GADErrorDomain 3: no fill' }, null);
    expect(s.platform.adError()).toBe('GADErrorDomain 3: no fill');
    expect(shell(ADS_ON, null).platform.adError()).toBeNull();
    const mute = vi.fn();
    s.platform.onHostMute(mute);
    expect(s.platform.admob.onLate).toBe(mute);
  });

  it('opens a new tab where there is no shell', () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    try {
      new IosPlatform(null, fakeDoc().doc).openUrl('https://p.gamestao.com/privacy');
    } finally {
      vi.unstubAllGlobals();
    }
    expect(open).toHaveBeenCalledWith('https://p.gamestao.com/privacy', '_blank', 'noopener');
  });
});

describe('psNative', () => {
  it('finds the bridge object on the page, and nothing in a browser', () => {
    const n = { languages: ['ja'] };
    expect(psNative({ PSNative: n })).toBe(n);
    expect(psNative({})).toBeNull();
    expect(psNative({ PSNative: 'not an object' })).toBeNull();
    expect(psNative()).toBeNull();
  });
});
