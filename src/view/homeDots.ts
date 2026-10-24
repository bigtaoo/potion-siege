// Every red dot on the home screen at once: the nav bar's (nudges.navDots), the battle tab's
// chapter chest, the welcome gifts', the daily login's and the tasks'. A new player's first home screens light
// only the one that matters most, so the eye goes one place rather than five.

import { canClaimLogin, tasksClaimable } from '../sim/daily';
import type { MetaSave } from '../sim/meta';
import { canClaimWelcome, welcomeOn } from '../sim/welcome';
import type { HomeTab } from './home/types';
import { navDots } from './nudges';

/** Runs before the home screen shows more than one red dot at a time. */
export const ONE_DOT_UNTIL = 5;

/** The dots, the most important first: the core loop, then what is free to claim, then the rest. */
export const DOT_ORDER = ['potions', 'battle', 'workshop', 'welcome', 'login', 'tasks', 'shop', 'codex'] as const;
export type DotSpot = (typeof DOT_ORDER)[number];

/** The dots with `tab` open: none on that tab's own nav button, but the battle tab's chest dot
 *  sits on its chapter card, so it stays lit there; `pointing` while the upgrade pointer is up. */
export function homeDots(m: MetaSave, today: string, tab: HomeTab, pointing = false): Record<DotSpot, boolean> {
  const all: Record<DotSpot, boolean> = { ...navDots(m, today, pointing), welcome: welcomeOn(m) && canClaimWelcome(m, today), login: canClaimLogin(m, today), tasks: tasksClaimable(m) };
  if (tab !== 'battle') all[tab] = false;
  if (m.runs >= ONE_DOT_UNTIL) return all;
  const first = DOT_ORDER.find((k) => all[k]);
  return Object.fromEntries(DOT_ORDER.map((k) => [k, k === first])) as Record<DotSpot, boolean>;
}
