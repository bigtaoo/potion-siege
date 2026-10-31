// Every red dot on the home screen at once: the nav bar's (nudges.navDots), the battle tab's
// chapter chest, the welcome gifts', the daily login's and the tasks'. A new player's first home screens light
// only the one that matters most, so the eye goes one place rather than five; after that at most
// MAX_DOTS, so a red dot still means "look here".

import { canClaimLogin, tasksClaimable } from '../sim/daily';
import type { MetaSave } from '../sim/meta';
import { canClaimWelcome, welcomeOn } from '../sim/welcome';
import type { HomeTab } from './home/types';
import { navDots } from './nudges';

/** Runs before the home screen shows more than one red dot at a time. */
export const ONE_DOT_UNTIL = 5;

/** Dots lit at once once the first runs are past. */
export const MAX_DOTS = 2;

/** The dots, the most important first: the next battle (its chests), the core loop, then what is
 *  free to claim, then the rest. */
export const DOT_ORDER = ['battle', 'potions', 'login', 'welcome', 'tasks', 'workshop', 'shop', 'codex'] as const;
export type DotSpot = (typeof DOT_ORDER)[number];

/** The dots with `tab` open: none on that tab's own nav button, but the battle tab's chest dot
 *  sits on its chapter card, so it stays lit there; `pointing` while the upgrade pointer is up. */
export function homeDots(m: MetaSave, today: string, tab: HomeTab, pointing = false): Record<DotSpot, boolean> {
  const all: Record<DotSpot, boolean> = { ...navDots(m, today, pointing), welcome: welcomeOn(m) && canClaimWelcome(m, today), login: canClaimLogin(m, today), tasks: tasksClaimable(m) };
  if (tab !== 'battle') all[tab] = false;
  const keep = new Set(DOT_ORDER.filter((k) => all[k]).slice(0, m.runs >= ONE_DOT_UNTIL ? MAX_DOTS : 1));
  return Object.fromEntries(DOT_ORDER.map((k) => [k, keep.has(k)])) as Record<DotSpot, boolean>;
}
