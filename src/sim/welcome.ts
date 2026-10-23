// The welcome week: seven gifts for a new install, one for each day the game is opened, the first
// once the first battle is over. A missed day costs nothing; the next visit gives the next gift.
// The seventh is a potion (BALANCE.welcome.potion), or its crystals when it is owned already.
// Days are local calendar dates, as in `daily`. A save from before the welcome week that has
// played already counts as done, so only new players see it.

import { heroUnlocked, unlockHero, type MetaSave } from './meta';
import { int } from './parse';
import { BALANCE, HERO_KINDS, type HeroKind } from './types';

const W = BALANCE.welcome;

/** The gifts, in order: crystals each, and the potion on the last day. */
export const WELCOME_GIFTS: readonly number[] = W.gifts;
export const WELCOME_POTION = W.potion as HeroKind;

export interface WelcomeSave {
  /** Gifts claimed, 0 to WELCOME_GIFTS.length. */
  gifts: number;
  /** The day of the last claim. */
  day: string;
}

export function newWelcome(): WelcomeSave {
  return { gifts: 0, day: '' };
}

/** Reads the stored welcome part; a save without one that has played (`runs`) is past it. */
export function parseWelcome(v: unknown, runs: number): WelcomeSave {
  const out = newWelcome();
  if (!v || typeof v !== 'object') {
    if (runs > 0) out.gifts = WELCOME_GIFTS.length;
    return out;
  }
  const d = v as Record<string, unknown>;
  out.gifts = int(d.gifts, 0, WELCOME_GIFTS.length, WELCOME_GIFTS.length);
  if (typeof d.day === 'string') out.day = d.day;
  return out;
}

/** The welcome week is still running: gifts left to claim. */
export function welcomeOn(m: MetaSave): boolean {
  return m.welcome.gifts < WELCOME_GIFTS.length;
}

/** Today's gift can be claimed: one left, the first battle played, none claimed today. */
export function canClaimWelcome(m: MetaSave, today: string): boolean {
  return welcomeOn(m) && m.runs >= 1 && today > m.welcome.day;
}

/** What gift `i` (0-based) gives this save: the potion on the last day unless it is owned. */
export function welcomeGift(m: MetaSave, i: number): { crystals: number; potion: HeroKind | null } {
  const last = i === WELCOME_GIFTS.length - 1;
  if (last && HERO_KINDS.includes(WELCOME_POTION) && !heroUnlocked(m, WELCOME_POTION)) return { crystals: 0, potion: WELCOME_POTION };
  return { crystals: WELCOME_GIFTS[i] ?? 0, potion: null };
}

/** Claims today's gift; null when there is none to claim. */
export function claimWelcome(m: MetaSave, today: string): { crystals: number; potion: HeroKind | null } | null {
  if (!canClaimWelcome(m, today)) return null;
  const gift = welcomeGift(m, m.welcome.gifts);
  m.welcome.gifts++;
  m.welcome.day = today;
  m.crystals += gift.crystals;
  if (gift.potion) unlockHero(m, gift.potion);
  return gift;
}
