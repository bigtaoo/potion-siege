// What a merge brews (audit G6): half the time the potion keeps its kind, so a player who
// lines up two fire bottles can count on fire more often than the lineup's plain odds.
import { pick } from './math/pick';
import type { Prng } from './math/prng';
import type { HeroKind } from './types';

/** Chance, out of 100, that a merge keeps the merged potions' kind. */
export const KEEP_KIND = 50;

/** The kind a merge of two `kind` potions brews: one draw to keep it, else one from the lineup. */
export function mergedKind(rng: Prng, kind: HeroKind, lineup: readonly HeroKind[]): HeroKind {
  return rng.chance(KEEP_KIND, 100) ? kind : pick(rng, lineup);
}
