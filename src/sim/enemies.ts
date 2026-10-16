// What each clockwork enemy is weak to or shrugs off, and its numbers on a stage. Shown in the
// codex; the battle does not apply the resistances yet.

import { stageHp } from './meta';
import { BALANCE, HERO_KINDS, type EnemyKind, type HeroKind } from './types';
import { FIRST_WAVE, waveHp } from './waves';

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

/** Every element with its multiplier against `kind`, in hero order: the codex shows all of
 *  them, locked potions too. */
export function resists(kind: EnemyKind): { element: HeroKind; value: number }[] {
  return HERO_KINDS.map((element) => ({ element, value: resist(kind, element) }));
}

/** A multiplier as the codex writes it: 0.5 is "-50%", 1.25 "+25%", 1 a dash. */
export function resistLabel(v: number): string {
  const pct = Math.round((v - 1) * 100);
  return pct === 0 ? '—' : `${pct > 0 ? '+' : '-'}${Math.abs(pct)}%`;
}

export interface EnemyStats {
  /** The first wave of a stage it turns up in. */
  wave: number;
  /** Hit points on that wave of `stage`, scaled as the battle scales its spawns. */
  hp: number;
  speed: number;
  wallDps: number;
}

export function enemyStats(kind: EnemyKind, stage: number): EnemyStats {
  const e = BALANCE.enemies[kind];
  const wave = FIRST_WAVE[kind];
  return { wave, hp: waveHp(wave) * e.hp * stageHp(stage), speed: e.speed, wallDps: e.wallDps };
}
