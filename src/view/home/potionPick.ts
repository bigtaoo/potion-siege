// What the potions tab points out: the next milestone of a potion, and the one level-up worth
// buying first among the fielded four.

import { heroCost, type MetaSave } from '../../sim/meta';
import { MILESTONES, type Milestone } from '../../sim/skills';
import type { HeroKind } from '../../sim/types';

/** The first milestone a potion has not reached, null once it has them all. */
export function nextMilestone(m: MetaSave, kind: HeroKind): Milestone | null {
  return MILESTONES[kind].find((s) => s.level > m.heroes[kind]) ?? null;
}

/** The fielded potion to level next: one a single level short of a milestone (the cheapest of
 *  those), else the cheapest; null when none of the four can be levelled. */
export function recommendedHero(m: MetaSave): HeroKind | null {
  const open = m.lineup.filter((k) => heroCost(m.heroes[k]) !== null);
  if (open.length === 0) return null;
  const cost = (k: HeroKind) => heroCost(m.heroes[k])!;
  const close = open.filter((k) => nextMilestone(m, k)?.level === m.heroes[k] + 1);
  const pool = close.length > 0 ? close : open;
  return pool.reduce((a, b) => (cost(b) < cost(a) ? b : a));
}
