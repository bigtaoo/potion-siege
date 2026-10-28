// The home screen's panels and buttons as homeScreen.ts wires them: each panel opened and closed,
// what the host offers (extras), and the login, stage, shop and upgrade buttons tapped by their
// English captions on the real game.
import '../view/layout/measure';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PrivacyChoice } from '../analytics/privacy';
import { t } from '../i18n';
import { gameDay, loginReward } from '../sim/daily';
import { TRACKS } from '../sim/achievements';
import { heroCost, unlockPrice, workshopCost } from '../sim/meta';
import { BALANCE } from '../sim/types';
import { WELCOME_GIFTS } from '../sim/welcome';
import { setCodexPage } from '../view/codex';
import type { HomePanel } from '../view/Home';
import { PillButton } from '../view/kit';
import { extras, home } from './homeScreen';
import { buttons, Card, englishPage, tap, texts, veteran, world } from './testWorld';

beforeAll(englishPage);

describe('the home panels', () => {
  const panels: HomePanel[] = ['login', 'welcome', 'tasks', 'settings', 'language', 'challenge', 'chapters', 'privacy', 'fire', 'grunt'];

  it.each(panels)('opens %s over the home screen, and its cross closes it', (p) => {
    const w = world();
    home(w.game, p);
    expect(w.game['panel']).toBe(p);
    expect(w.game['menu'].visible).toBe(true);
    tap(w.stage, '✕');
    expect(w.game['panel']).toBeNull();
    expect(buttons(w.stage, '✕')).toHaveLength(0);
  });

  it('opens the login by itself once a day, and a claim pays the day and closes it', () => {
    const w = world();
    expect(w.game['panel']).toBe('login');
    expect(w.events('dialog')).toContainEqual({ id: 'login', action: 'open', auto: true, run: 8 });
    tap(w.stage, t('claim'));
    expect(w.save().crystals).toBe(100 + loginReward(0));
    expect(w.game['panel']).toBeNull();
    expect(w.events('dialog')).toContainEqual({ id: 'login', action: 'claim', run: 8 });
    home(w.game, 'login');
    expect(buttons(w.stage, t('claim'))).toHaveLength(0);
    expect(buttons(w.stage, t('tomorrow'))).toHaveLength(1);
  });

  it('asks about play statistics where the law wants it, and the answer closes the question', () => {
    const w = world();
    Object.assign(w.game, { privacy: new PrivacyChoice(w.host.storage, 'consent') });
    w.game['menu'].visible = false;
    w.game['consentShown'] = false;
    home(w.game);
    expect(w.game['panel']).toBe('privacy');
    tap(w.stage, t('privacy.allow'));
    expect(w.game['privacy'].choice()).toBe('yes');
    expect(w.game['panel']).toBeNull();
    expect(w.events('privacy')).toEqual([{ on: true, from: 'ask', run: 8 }]);
  });
});

describe('what the host offers', () => {
  it('is nothing extra on a bare host', () => {
    const w = world();
    const x = extras(w.game);
    expect(x).toMatchObject({ adFree: undefined, adsHosted: true, privacy: false, policy: false, vibrate: false, remind: undefined });
    expect(x.data).toEqual({ sending: true, id: w.analytics.playerId, copy: false, note: null });
  });

  it('has the ad-free card, the privacy links, vibration, a clipboard and reminders where the host does', () => {
    const card = new Card();
    const notify = { status: () => 'on' as const, ask: async () => 'on' as const, schedule() {}, cancel() {} };
    const w = world(veteran(), (h) =>
      Object.assign(h, { store: card, adPrivacy: { offered: () => true, open() {} }, openUrl() {}, vibrate() {}, copyText: async () => true, notify }),
    );
    const x = extras(w.game);
    expect(x).toMatchObject({ adFree: { price: '$4.99', owned: false, note: null }, privacy: true, policy: true, vibrate: true, remind: 'on' });
    expect(x.data?.copy).toBe(true);
  });

  it('forgets the copy note once the settings are closed', () => {
    const w = world();
    w.game['idNote'] = 'copied';
    w.game['panel'] = 'settings';
    expect(extras(w.game).data?.note).toBe('copied');
    w.game['panel'] = null;
    expect(extras(w.game).data?.note).toBeNull();
  });
});

describe('the home buttons', () => {
  /** A veteran on `tab`, the login put away. */
  const on = (tab: 'battle' | 'potions' | 'workshop' | 'shop', crystals = 100) => {
    const m = veteran();
    m.crystals = crystals;
    m.daily.lastClaim = gameDay(m, new Date());
    const w = world(m);
    w.game['tab'] = tab;
    home(w.game);
    return w;
  };

  it('steps the stage with the arrows, as far as the stages open', () => {
    const w = on('battle');
    tap(w.stage, '◀');
    expect(w.save().stage).toBe(19);
    tap(w.stage, '▶');
    tap(w.stage, '▶');
    expect(w.save().stage).toBe(20);
  });

  it('picks an open stage from the chapters, not a locked one', () => {
    const w = on('battle');
    w.game.save.cleared = 15;
    home(w.game, 'chapters');
    tap(w.stage, '18');
    expect(w.save().stage).toBe(20);
    tap(w.stage, '14');
    expect(w.save().stage).toBe(14);
  });

  it('buys a workshop level it can pay for', () => {
    const w = on('workshop', 1000);
    const cost = workshopCost('wall', 0)!;
    tap(w.stage, String(cost));
    expect(w.save().workshop.wall).toBe(1);
    expect(w.save().crystals).toBe(1000 - cost);
    expect(w.events('meta_buy')).toEqual([{ item: 'shop_wall', level: 1, crystals: 1000 - cost }]);
  });

  it('upgrades a potion it can pay for', () => {
    const w = on('potions', 1000);
    const lv = w.game.save.heroes.fire;
    const cost = heroCost(lv)!;
    // the price button, not the potion's card around it
    const found = buttons(w.stage, String(cost)).filter((b) => b instanceof PillButton);
    expect(found.length).toBeGreaterThan(0);
    found[0].emit('pointertap', { stopPropagation() {} } as never);
    expect(w.save().crystals).toBe(1000 - cost);
    expect(w.events('meta_buy')).toHaveLength(1);
  });

  it('opens the free chest once a day', () => {
    const w = on('shop');
    tap(w.stage, t('store.open'));
    expect(w.save().crystals).toBeGreaterThan(100);
    expect(w.events('daily_claim')).toEqual([expect.objectContaining({ item: 'shop_chest' })]);
    expect(buttons(w.stage, t('store.open'))).toHaveLength(0);
  });

  it('starts a battle from the play button and puts the menu away', () => {
    const w = on('battle');
    const start = vi.spyOn(w.host, 'gameplayStart');
    tap(w.stage, t('start'));
    expect(w.game['menu'].visible).toBe(false);
    expect(start).toHaveBeenCalledOnce();
    expect(w.events('battle_start_tap')).toEqual([{ stage: 20, from: 'home', run: 9 }]);
    expect(texts(w.game['menu'])).toEqual([]);
  });
});

describe('the claims and switches on the home screen', () => {
  const at = (tab: 'battle' | 'potions' | 'codex' | 'shop', edit: (m: ReturnType<typeof veteran>) => void = () => {}) => {
    const m = veteran();
    m.daily.lastClaim = gameDay(m, new Date());
    edit(m);
    const w = world(m);
    w.game['tab'] = tab;
    home(w.game);
    return w;
  };

  it("claims the welcome week's gift of the day", () => {
    const w = at('battle', (m) => {
      m.welcome.gifts = 0;
      m.welcome.day = '';
    });
    home(w.game, 'welcome');
    tap(w.stage, t('claim'));
    expect(w.save().welcome.gifts).toBe(1);
    expect(w.save().crystals).toBe(100 + WELCOME_GIFTS[0]);
    expect(w.events('daily_claim')).toEqual([expect.objectContaining({ item: 'welcome', crystals: WELCOME_GIFTS[0] })]);
  });

  it('claims a feat tier from the codex', () => {
    setCodexPage('feats');
    try {
      const w = at('codex', (m) => (m.achievements.stats.merges = 100));
      const reward = TRACKS.merges[0].reward;
      const found = buttons(w.stage, String(reward)).filter((b) => b instanceof PillButton);
      found[0].emit('pointertap', { stopPropagation() {} } as never);
      expect(w.save().achievements.claimed.merges).toBe(1);
      expect(w.events('daily_claim')).toEqual([expect.objectContaining({ item: 'ach_merges', crystals: reward })]);
    } finally {
      setCodexPage('potions');
    }
  });

  it('turns hard mode on only once a chapter has the stars, and back off', () => {
    const w = at('battle');
    tap(w.stage, t('stars.hard'));
    expect(w.save().stars.hardMode).toBe(false);
    w.game.save.stars.normal.fill(3, 0, 10);
    home(w.game);
    tap(w.stage, t('stars.hard'));
    expect(w.save().stars.hardMode).toBe(true);
    expect(w.save().stage).toBe(1);
    tap(w.stage, t('stars.normal'));
    expect(w.save().stars.hardMode).toBe(false);
  });

  it("opens a finished chapter's chest once", () => {
    const w = at('battle');
    home(w.game, 'chapters');
    tap(w.stage, t('chapter.chestOpen'));
    expect(w.save().chapterChests).toEqual([1]);
    expect(w.events('daily_claim')).toEqual([expect.objectContaining({ item: 'chapter_1' })]);
    expect(buttons(w.stage, t('chapter.chestOpen'))).toHaveLength(0);
  });

  it('picks a benched potion for the lineup, and says when a potion is maxed', () => {
    const w = at('potions', (m) => (m.heroes.fire = BALANCE.meta.heroMax));
    expect(texts(w.stage)).toContain(t('maxed'));
    const bench = buttons(w.stage, t('bench'));
    expect(bench).toHaveLength(2); // poison and wind, earned by stage 19
    bench[0].emit('pointertap', { stopPropagation() {} } as never);
    expect(w.game.picked).toBe('poison');
  });

  it("buys a level from a potion's panel and keeps it open, and says maxed once there is none", () => {
    const w = at('battle', (m) => (m.crystals = 1000));
    home(w.game, 'fire');
    const lv = w.game.save.heroes.fire;
    const [buy] = buttons(w.stage, String(heroCost(lv))).filter((b) => b instanceof PillButton);
    buy.emit('pointertap', { stopPropagation() {} } as never);
    expect(w.save().heroes.fire).toBe(lv + 1);
    expect(w.game['panel']).toBe('fire');
    w.game.save.heroes.fire = BALANCE.meta.heroMax;
    home(w.game, 'fire');
    expect(texts(w.stage)).toContain(t('maxed'));
  });

  it('says maxed for a workshop item with no level left', () => {
    let top = 0;
    while (workshopCost('wall', top) !== null) top++;
    const w = at('battle', (m) => (m.workshop.wall = top));
    w.game['tab'] = 'workshop';
    home(w.game);
    expect(texts(w.stage)).toContain(t('maxed'));
  });

  it('buys a locked potion in the shop', () => {
    const w = at('shop', (m) => {
      m.crystals = 2000;
      m.cleared = 3;
      m.stage = 4;
    });
    const price = unlockPrice('poison')!;
    tap(w.stage, String(price));
    expect(w.save().unlocked).toContain('poison');
    expect(w.save().crystals).toBe(2000 - price);
    expect(w.events('meta_buy')).toEqual([{ item: 'unlock_poison', level: null, crystals: 2000 - price }]);
  });
});
