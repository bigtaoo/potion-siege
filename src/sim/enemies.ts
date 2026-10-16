// What each clockwork enemy is weak to or shrugs off. Shown in the codex; the battle does not
// apply it yet.

import type { EnemyKind, HeroKind } from './types';

/** Damage taken from each element as a multiplier; an element not listed deals 1×. Machines
 *  do not sicken, so venom does half against all of them. */
export const RESIST: Record<EnemyKind, Partial<Record<HeroKind, number>>> = {
  // tin conducts: lightning arcs right through it
  grunt: { lightning: 1.25, poison: 0.5 },
  // a frozen spring stops the little gears
  runner: { ice: 1.25, poison: 0.5 },
  // a boiler is made to take heat, but cold cracks the hot iron
  brute: { fire: 0.5, ice: 1.25, poison: 0.5 },
  // heavy brass plates ground the sparks and hold the heat; magic goes between them
  boss: { fire: 0.75, lightning: 0.75, arcane: 1.25, poison: 0.5 },
};

export function resist(kind: EnemyKind, element: HeroKind): number {
  return RESIST[kind][element] ?? 1;
}
