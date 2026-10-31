// A potion unlocked late does not start at level 1 next to a team in the twenties: it comes in
// at half the average level of the potions already open, so it can be fielded without a long
// climb first.

import type { MetaSave } from './meta';
import { BALANCE, HERO_KINDS, LINEUP, type HeroKind } from './types';

/** The share of the open potions' average level a newly unlocked one starts at. */
export const UNLOCK_LEVEL_SHARE = 0.5;

/** The level a potion unlocked now starts at: half the average of the others open, rounded down,
 *  never below its own level and never above the cap. */
export function unlockLevel(m: MetaSave, kind: HeroKind): number {
  const open = HERO_KINDS.filter((k) => k !== kind && (LINEUP.includes(k) || m.unlocked.includes(k)));
  const own = m.heroes[kind];
  if (open.length === 0) return own;
  const avg = open.reduce((s, k) => s + m.heroes[k], 0) / open.length;
  return Math.min(BALANCE.meta.heroMax, Math.max(own, Math.floor(avg * UNLOCK_LEVEL_SHARE)));
}

/** Raises a newly unlocked potion to its starting level. */
export function liftUnlocked(m: MetaSave, kind: HeroKind): void {
  m.heroes[kind] = unlockLevel(m, kind);
}
