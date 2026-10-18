import { beforeAll, describe, expect, it } from 'vitest';
import type { AdState, PSNative, StoreState } from './bridge';
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

  it('gives the canvas the screen inside the safe area', () => {
    const s = shell(null, null);
    expect(s.appended).toHaveLength(1);
    expect(s.platform.mount).toBe(s.appended[0]);
    expect(s.appended[0].id).toBe('game');
    for (const side of ['top', 'right', 'bottom', 'left']) expect(s.appended[0].style.cssText).toContain(`${side}:env(safe-area-inset-${side},0px)`);
  });
});
