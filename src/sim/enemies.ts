// What each clockwork enemy is weak to or shrugs off, and its numbers on a stage. The battle
// multiplies every potion's damage by these; the codex shows them.

import { stageHp } from './meta';
import { BALANCE, HERO_KINDS, type EnemyKind, type HeroKind } from './types';
import { FIRST_STAGE, FIRST_WAVE, waveHp } from './waves';

/** Damage taken from each element as a multiplier; an element not listed deals 1×. Corrosion
 *  eats into tin, springs and brass alike; only the boiler, built to hold acid-hot water,
 *  shrugs it off. */
export const RESIST: Record<EnemyKind, Partial<Record<HeroKind, number>>> = {
  // tin conducts: lightning arcs right through it
  grunt: { lightning: 1.25 },
  // a frozen spring stops the little gears, and the light mouse is blown about
  runner: { ice: 1.25, wind: 1.25 },
  // a boiler is made to take heat and acid, but cold cracks the hot iron; it is heavy to blow
  brute: { fire: 0.5, ice: 1.25, poison: 0.5, wind: 0.75 },
  // heavy brass plates ground the sparks, hold the heat and stand in the wind; magic goes between them
  boss: { fire: 0.75, lightning: 0.75, arcane: 1.25, wind: 0.75 },
  // canvas wings catch fire and the brass ball draws the sparks; frost just slides off the wings,
  // and a gale tears at them
  flyer: { fire: 1.25, lightning: 1.25, ice: 0.75, wind: 1.5 },
  // acid gums the mainspring and magic unwinds it; its own gears turn back the cold; wind
  // catches the big key and spins it the wrong way
  winder: { poison: 1.5, arcane: 1.25, ice: 0.5, wind: 1.5 },
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
  /** The first stage it turns up on. */
  stage: number;
  /** Hit points on that wave of `stage` (of its first stage, before that), scaled as the
   *  battle scales its spawns. */
  hp: number;
  speed: number;
  wallDps: number;
}

export function enemyStats(kind: EnemyKind, stage: number): EnemyStats {
  const e = BALANCE.enemies[kind];
  const wave = FIRST_WAVE[kind];
  const first = FIRST_STAGE[kind];
  return { wave, stage: first, hp: waveHp(wave) * e.hp * stageHp(Math.max(stage, first)), speed: e.speed, wallDps: e.wallDps };
}
