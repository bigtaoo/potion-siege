// The shop's rewarded ad and the ad-free card as the player meets them on the home screen
// (homeActions.ts): the real game over a stand-in Pixi app and a host whose ads and store
// answer as each test scripts them. An ad can be watched, closed early, fail to load, or break.
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { dayOf } from '../sim/daily';
import { AD_CRYSTALS, ADS_PER_DAY, adsLeft } from '../sim/meta';
import { shopAd } from './homeActions';
import { home } from './homeScreen';
import { buttons, Card, englishPage, flush, tap, texts, veteran, world, type World } from './testWorld';

beforeAll(englishPage);

describe('the shop ad', () => {
  const today = dayOf(new Date());
  const open = (w: World) => {
    w.game['tab'] = 'shop';
    home(w.game);
  };

  it('pays its crystals when watched, and counts against the day', async () => {
    const w = world();
    open(w);
    w.host.answers = ['watched'];
    tap(w.stage, t('store.watch'));
    expect(w.game['menu'].interactiveChildren, 'no second tap while it plays').toBe(false);
    await flush();
    expect(w.save().crystals).toBe(100 + AD_CRYSTALS);
    expect(adsLeft(w.save(), today)).toBe(ADS_PER_DAY - 1);
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(w.events('ad_shop')).toEqual([{ ok: true }]);
  });

  it.each(['closed', 'failed', 'broke'] as const)('pays nothing when the ad was %s, and gives the menu back', async (answer) => {
    const w = world();
    open(w);
    w.host.answers = [answer];
    tap(w.stage, t('store.watch'));
    await flush();
    expect(w.save().crystals).toBe(100);
    expect(adsLeft(w.save(), today)).toBe(ADS_PER_DAY);
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(w.game['menu'].visible).toBe(true);
    expect(w.events('ad_shop')).toEqual([{ ok: false }]);
  });

  it('stops at the daily cap: the button turns off and a stray tap plays nothing', async () => {
    const w = world();
    open(w);
    for (let i = 0; i < ADS_PER_DAY; i++) {
      w.host.answers = ['watched'];
      tap(w.stage, t('store.watch'));
      await flush();
    }
    expect(w.save().crystals).toBe(100 + ADS_PER_DAY * AD_CRYSTALS);
    expect(buttons(w.stage, t('store.watch'))).toHaveLength(0);
    expect(buttons(w.stage, t('tomorrow')).length).toBeGreaterThan(0);
    // the action itself guards the cap too, whatever calls it
    await shopAd(w.game);
    expect(w.host.rewardedCalls).toBe(ADS_PER_DAY);
    expect(w.save().crystals).toBe(100 + ADS_PER_DAY * AD_CRYSTALS);
  });

  it('drops the ad card where the host has none, the free chest left on its own', () => {
    const w = world(veteran(), (h) => (h.available = false));
    open(w);
    expect(buttons(w.stage, t('store.watch'))).toHaveLength(0);
    expect(texts(w.stage)).not.toContain(t('store.ad.name'));
    expect(texts(w.stage)).toContain(t('store.chest.name'));
  });
});

describe('the ad-free card', () => {
  const shop = (setup: (c: Card) => void = () => {}) => {
    const card = new Card();
    setup(card);
    const w = world(veteran(), (h) => (h.store = card));
    w.game['tab'] = 'shop';
    home(w.game);
    return { w, card };
  };

  it('is not in the shop where nothing is sold', () => {
    const w = world();
    w.game['tab'] = 'shop';
    home(w.game);
    expect(buttons(w.stage, t('store.adFree.restore'))).toHaveLength(0);
  });

  it('sells at its price, then shows owned and celebrates', async () => {
    const { w, card } = shop((c) => (c.buys = ['owned']));
    tap(w.stage, '$4.99');
    await flush();
    expect(card.isOwned).toBe(true);
    expect(w.host.celebrated).toBe(1);
    expect(buttons(w.stage, '$4.99')).toHaveLength(0);
    expect(buttons(w.stage, t('store.adFree.restore'))).toHaveLength(0);
    expect(w.events('iap')).toEqual([{ op: 'buy', outcome: 'owned', run: 8 }]);
  });

  it('cannot be bought before the store has a price', () => {
    const { w, card } = shop((c) => (c.cost = null));
    tap(w.stage, '…');
    expect(card.buys).toEqual([]);
    expect(w.events('iap')).toEqual([]);
  });

  it.each([
    ['pending', 'store.adFree.pending'],
    ['failed', 'store.adFree.failed'],
  ] as const)('says so on its strip when the purchase is %s', async (outcome, note) => {
    const { w } = shop((c) => (c.buys = [outcome]));
    tap(w.stage, '$4.99');
    await flush();
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(buttons(w.stage, '$4.99')).toHaveLength(1);
    expect(texts(w.stage)).toContain(t(note));
    expect(w.host.celebrated).toBe(0);
  });

  it('says nothing for a purchase sheet the player cancelled', async () => {
    const { w } = shop((c) => (c.buys = ['cancelled']));
    tap(w.stage, '$4.99');
    await flush();
    expect(texts(w.stage)).toContain(t('store.adFree.desc'));
  });

  it('counts a store that broke as a failed purchase', async () => {
    const { w } = shop((c) => (c.buys = ['broke']));
    tap(w.stage, '$4.99');
    await flush();
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(texts(w.stage)).toContain(t('store.adFree.failed'));
    expect(w.events('iap')).toEqual([{ op: 'buy', outcome: 'failed', run: 8 }]);
  });

  it.each([
    ['owned', 'store.adFree.restored'],
    ['none', 'store.adFree.nothing'],
    ['failed', 'store.adFree.failed'],
    ['broke', 'store.adFree.failed'],
  ] as const)('restores: %s', async (outcome, note) => {
    const { w } = shop((c) => (c.restores = [outcome]));
    tap(w.stage, t('store.adFree.restore'));
    await flush();
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(texts(w.stage)).toContain(t(note));
  });

  it("the strip's note goes when the tab changes", async () => {
    const { w } = shop((c) => (c.buys = ['failed']));
    tap(w.stage, '$4.99');
    await flush();
    home(w.game);
    expect(texts(w.stage)).toContain(t('store.adFree.failed'));
    tap(w.stage, t('tabs.battle'));
    tap(w.stage, t('tabs.shop'));
    expect(texts(w.stage)).not.toContain(t('store.adFree.failed'));
  });
});
