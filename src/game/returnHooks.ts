// The welcome week on the home screen: when its panel opens by itself, and the claim. What it
// keeps per game (the day it last opened by itself, and whether it did on this visit) lives here
// beside the Game rather than on it. And the reminders' answer (game/reminderBook.ts).

import type { Container } from 'pixi.js';
import type { Game } from '../app';
import { canClaimWelcome, claimWelcome } from '../sim/welcome';
import { claimed } from './homeActions';
import { home } from './homeScreen';
import { reminderBook } from './reminderBook';

interface WelcomeState {
  /** The day the panel last opened by itself. */
  shown: string;
  /** It opened by itself on this visit to the home screen: the login waits for the next one. */
  visit: boolean;
}

const states = new WeakMap<Game, WelcomeState>();

function state(g: Game): WelcomeState {
  let s = states.get(g);
  if (!s) states.set(g, (s = { shown: '', visit: false }));
  return s;
}

/** A new visit to the home screen starts. */
export function enterHome(g: Game): void {
  state(g).visit = false;
}

/** The welcome panel opens by itself: a gift waits, from the first home screen after a battle,
 *  once a day. True when it does (and it is then marked as shown). */
export function welcomePops(g: Game, today: string): boolean {
  const s = state(g);
  if (g.autoplay || s.shown === today || !canClaimWelcome(g.save, today)) return false;
  s.shown = today;
  s.visit = true;
  g.analytics.track('dialog', { id: 'welcome', action: 'open', auto: true, run: g.save.runs });
  return true;
}

/** The welcome panel opened by itself on this visit. */
export function welcomeVisit(g: Game): boolean {
  return state(g).visit;
}

/** Claims today's gift: crystals fly into the purse; the potion opens its own panel. */
export function claimWelcomeGift(g: Game, today: string, at: Container): void {
  const gift = claimWelcome(g.save, today);
  if (!gift) return;
  g.analytics.track('dialog', { id: 'welcome', action: 'claim', item: g.save.welcome.gifts, run: g.save.runs });
  if (!gift.potion) {
    claimed(g, 'welcome', gift.crystals, null, at);
    return;
  }
  g.audio.play('levelup');
  g.store();
  g.analytics.track('daily_claim', { item: `welcome_${gift.potion}`, crystals: 0, total: g.save.crystals });
  home(g, gift.potion);
}

/** The reminders' card answered (`card`) or their settings switch flipped: the card closes at
 *  once; the settings show the switch again once the system's sheet is answered. */
export function remindAnswer(g: Game, on: boolean, card: boolean): void {
  const book = reminderBook(g);
  if (!book) return;
  g.analytics.track('dialog', { id: 'remind', action: on ? 'yes' : 'no', from: card ? 'card' : 'settings', run: g.save.runs });
  if (card) home(g, null);
  void (card ? book.answer(on) : book.set(on)).then(() => {
    if (g.menu.visible && g.panel === 'settings') home(g, 'settings');
  });
}
