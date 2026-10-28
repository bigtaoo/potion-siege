// The welcome week and the reminders' answer on the home screen (returnHooks.ts): when the
// welcome panel opens by itself, what a claim pays, and where the reminders' card and switch go.
// The real game over a stand-in Pixi app and a scripted notifier (testNotifier.ts).
import '../view/layout/measure';
import { Container } from 'pixi.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { gameDay } from '../sim/daily';
import { heroUnlocked } from '../sim/meta';
import { WELCOME_GIFTS, WELCOME_POTION } from '../sim/welcome';
import { REMINDERS_KEY } from './keys';
import { home } from './homeScreen';
import { claimWelcomeGift, enterHome, remindAnswer, welcomePops, welcomeVisit } from './returnHooks';
import { Bell, bellWorld } from './testNotifier';
import { flush, play, playToEnd, tap, veteran, world, englishPage, type World } from './testWorld';

beforeAll(englishPage);

/** A player one battle into the welcome week, `gifts` claimed so far. */
function newcomer(gifts = 0) {
  const m = veteran();
  m.welcome.gifts = gifts;
  m.welcome.day = '';
  return m;
}

const today = (w: World) => gameDay(w.game.save, new Date());
const opens = (w: World) => w.events('dialog').filter((e) => e.id === 'welcome' && e.action === 'open');

describe('the welcome panel', () => {
  it('opens by itself on the first home screen while a gift waits, once a day', () => {
    const w = world(newcomer());
    expect(w.game.panel).toBe('welcome');
    expect(welcomeVisit(w.game)).toBe(true);
    expect(opens(w)).toEqual([{ id: 'welcome', action: 'open', auto: true, run: 8 }]);
    expect(welcomePops(w.game, today(w)), 'not twice on one day').toBe(false);
    enterHome(w.game);
    expect(welcomeVisit(w.game), 'a new visit').toBe(false);
    expect(welcomePops(w.game, '2999-01-01'), 'the next day').toBe(true);
    expect(welcomeVisit(w.game)).toBe(true);
  });

  it('stays shut with no gift to claim', () => {
    const w = world();
    expect(w.game.panel).not.toBe('welcome');
    expect(welcomePops(w.game, today(w))).toBe(false);
    expect(welcomeVisit(w.game)).toBe(false);
    expect(opens(w)).toEqual([]);
  });

  it('stays shut under autoplay', () => {
    const w = world(newcomer(), () => {}, 'speed=200&autoplay');
    expect(welcomePops(w.game, today(w))).toBe(false);
  });
});

describe('the welcome gift', () => {
  it('pays its crystals once, kept in the save', () => {
    const w = world(newcomer());
    const day = today(w);
    claimWelcomeGift(w.game, day, new Container());
    expect(w.save().crystals).toBe(100 + WELCOME_GIFTS[0]);
    expect(w.save().welcome).toEqual({ gifts: 1, day });
    expect(w.game.panel, 'the panel closes').toBeNull();
    claimWelcomeGift(w.game, day, new Container());
    expect(w.save().crystals, 'a second claim the same day pays nothing').toBe(100 + WELCOME_GIFTS[0]);
    expect(w.events('dialog').filter((e) => e.action === 'claim')).toEqual([{ id: 'welcome', action: 'claim', item: 1, run: 8 }]);
    expect(w.events('daily_claim')).toEqual([{ item: 'welcome', crystals: WELCOME_GIFTS[0], total: 100 + WELCOME_GIFTS[0] }]);
  });

  it('opens the potion on the last day, and shows its panel', () => {
    const m = newcomer(WELCOME_GIFTS.length - 1);
    m.cleared = 1;
    m.stage = 2;
    const w = world(m);
    expect(heroUnlocked(w.game.save, WELCOME_POTION)).toBe(false);
    claimWelcomeGift(w.game, today(w), new Container());
    expect(heroUnlocked(w.save(), WELCOME_POTION)).toBe(true);
    expect(w.save().crystals).toBe(100);
    expect(w.save().welcome.gifts).toBe(WELCOME_GIFTS.length);
    expect(w.game.panel).toBe(WELCOME_POTION);
    expect(w.events('daily_claim')).toEqual([{ item: `welcome_${WELCOME_POTION}`, crystals: 0, total: 100 }]);
  });
});

describe("the reminders' answer", () => {
  it('does nothing where the host has no notifications', () => {
    const w = world();
    remindAnswer(w.game, true, true);
    expect(w.events('dialog').filter((e) => e.id === 'remind')).toEqual([]);
    expect(w.host.storage.getItem(REMINDERS_KEY)).toBeNull();
  });

  it('comes from the card after a battle: yes closes it and asks the system', async () => {
    const bell = new Bell();
    const w = bellWorld(veteran(), bell);
    play(w);
    playToEnd(w);
    home(w.game);
    expect(w.game.panel).toBe('remind');
    tap(w.stage, t('remind.yes'));
    expect(w.game.panel).toBeNull();
    await flush();
    expect(bell.asks).toBe(1);
    expect(bell.booked.size).toBe(1);
    expect(w.events('dialog').filter((e) => e.id === 'remind')).toEqual([{ id: 'remind', action: 'yes', from: 'card', run: 9 }]);
  });

  it('no thanks on the card closes it without asking', async () => {
    const bell = new Bell();
    const w = bellWorld(veteran(), bell);
    w.game.panel = 'remind';
    remindAnswer(w.game, false, true);
    expect(w.game.panel).toBeNull();
    await flush();
    expect(bell.asks).toBe(0);
    expect(JSON.parse(w.host.storage.getItem(REMINDERS_KEY)!)).toEqual({ on: false, asked: true });
  });

  it('the settings switch redraws the settings once the system answered', async () => {
    const bell = new Bell();
    const w = bellWorld(veteran(), bell);
    home(w.game, 'settings');
    const before = w.game.menu.children[0];
    remindAnswer(w.game, true, false);
    expect(w.game.panel).toBe('settings');
    await flush();
    expect(bell.asks).toBe(1);
    expect(w.game.panel).toBe('settings');
    expect(w.game.menu.children[0], 'drawn again').not.toBe(before);
    expect(w.events('dialog').filter((e) => e.id === 'remind')).toEqual([{ id: 'remind', action: 'yes', from: 'settings', run: 8 }]);
  });

  it('the settings stay shut when the player left them before the system answered', async () => {
    const w = bellWorld(veteran(), new Bell());
    home(w.game, 'settings');
    remindAnswer(w.game, false, false);
    home(w.game);
    await flush();
    expect(w.game.panel).toBeNull();
  });
});
