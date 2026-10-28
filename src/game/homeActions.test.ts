// The shop's rewarded ad and the ad-free card as the player meets them on the home screen
// (homeActions.ts): the real game over a stand-in Pixi app and a host whose ads and store
// answer as each test scripts them. An ad can be watched, closed early, fail to load, or break.
import '../view/layout/measure';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getLocale, setLocale, t, type Locale } from '../i18n';
import { dayOf } from '../sim/daily';
import { AD_CRYSTALS, ADS_PER_DAY, adsLeft, benched } from '../sim/meta';
import { LINEUP } from '../sim/types';
import { buy, claimed, hintDone, language, lineup, shopAd } from './homeActions';
import { home } from './homeScreen';
import { LANG_KEY } from './keys';
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

describe('the language switch', () => {
  afterEach(() => void setLocale('en'));
  const page = () => Object.assign(document, { documentElement: {}, title: '' }) as unknown as { documentElement: { lang?: string }; title: string };

  it('loads the language, keeps it for next time and draws the settings again in it', async () => {
    const doc = page();
    const w = world();
    home(w.game, 'settings');
    await language(w.game, 'de');
    expect(getLocale()).toBe('de');
    expect([doc.documentElement.lang, doc.title]).toEqual(['de', t('title')]);
    expect(w.host.storage.getItem(LANG_KEY)).toBe('de');
    expect(w.events('language')).toEqual([{ lang: 'de', from: 'en' }]);
    expect(w.game.panel).toBe('settings');
  });

  it('changes nothing for the language already on, or one that cannot load', async () => {
    page();
    const w = world();
    await language(w.game, 'en');
    await language(w.game, 'xx' as Locale);
    expect(getLocale()).toBe('en');
    expect(w.host.storage.getItem(LANG_KEY)).toBeNull();
    expect(w.events('language')).toEqual([]);
  });
});

describe('the upgrade pointer', () => {
  it('is over for good once, said with whether the player bought', () => {
    const m = veteran();
    m.upgradeHint = false;
    const w = world(m);
    w.game.hintOnButton = true;
    hintDone(w.game, true);
    hintDone(w.game, false);
    expect(w.game.hintOnButton).toBe(false);
    expect(w.save().upgradeHint).toBe(true);
    expect(w.events('hint_upgrade_done')).toEqual([{ bought: true, run: 8 }]);
  });
});

describe('the lineup strip', () => {
  it('picks a reserve potion, then swaps it in for the lineup potion tapped', () => {
    const w = world();
    const g = w.game;
    const [reserve, other] = benched(g.save);
    expect(other, 'two in reserve on stage 20').toBeDefined();
    lineup(g, LINEUP[0]);
    expect([g.picked, w.save().lineup]).toEqual([null, [...LINEUP]]);
    lineup(g, reserve);
    expect(g.picked).toBe(reserve);
    lineup(g, reserve);
    expect(g.picked, 'a second tap unpicks it').toBeNull();
    lineup(g, reserve);
    lineup(g, LINEUP[0]);
    expect(g.picked).toBeNull();
    expect(w.save().lineup).toContain(reserve);
    expect(w.save().lineup).not.toContain(LINEUP[0]);
    expect(w.events('lineup')).toEqual([{ out: LINEUP[0], in: reserve }]);
  });
});

describe('a purchase', () => {
  it('is saved and said with its level, and a refused one is not', () => {
    const w = world();
    buy(w.game, false, 'wall', 2);
    expect(w.events('meta_buy')).toEqual([]);
    w.game.save.crystals = 40;
    buy(w.game, true, 'wall', 2);
    buy(w.game, true, 'unlock');
    expect(w.save().crystals).toBe(40);
    expect(w.events('meta_buy')).toEqual([
      { item: 'wall', level: 2, crystals: 40 },
      { item: 'unlock', level: null, crystals: 40 },
    ]);
  });
});

describe('claimed crystals', () => {
  it('are saved and said, the page rebuilt on the panel asked for', () => {
    const w = world();
    home(w.game);
    w.game.save.crystals += 30;
    const at = buttons(w.stage, t('tabs.shop'))[0];
    claimed(w.game, 'shop_chest', 30, null, at);
    expect(w.save().crystals).toBe(130);
    expect(w.events('daily_claim')).toEqual([{ item: 'shop_chest', crystals: 30, total: 130 }]);
    w.game.save.crystals += 5;
    claimed(w.game, 'gift', 5, 'settings');
    expect(w.game.panel).toBe('settings');
    expect(w.events('daily_claim')[1]).toEqual({ item: 'gift', crystals: 5, total: 135 });
  });
});
