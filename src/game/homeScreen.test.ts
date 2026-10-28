// The home screen's panels and buttons as homeScreen.ts wires them: each panel opened and closed,
// what the host offers (extras), and the login, stage, shop and upgrade buttons tapped by their
// English captions on the real game.
import '../view/layout/measure';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PrivacyChoice } from '../analytics/privacy';
import { t } from '../i18n';
import { gameDay, loginReward } from '../sim/daily';
import { heroCost, workshopCost } from '../sim/meta';
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
