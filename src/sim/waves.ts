// The wave plan: which enemies arrive in each wave and how tough they are.

import type { Rng } from './rng';
import { BALANCE, type EnemyKind } from './types';

export interface Spawn {
  /** Seconds after the wave starts. */
  at: number;
  kind: EnemyKind;
  /** Hit points, already scaled for the wave. */
  hp: number;
}

/** The first wave each kind can turn up in. */
export const FIRST_WAVE: Record<EnemyKind, number> = {
  grunt: 1,
  runner: 2,
  brute: 4,
  boss: Math.min(...BALANCE.waves.bossWaves),
};

export function isBossWave(wave: number): boolean {
  return BALANCE.waves.bossWaves.includes(wave);
}

/** Base hit points of a grunt in this 1-based wave. */
export function waveHp(wave: number): number {
  const w = BALANCE.waves;
  return w.baseHp * w.hpGrowth ** (wave - 1);
}

/** The spawns of one wave, sorted by time. Boss waves add the boss at the start and half the crowd. */
export function planWave(wave: number, rng: Rng): Spawn[] {
  const w = BALANCE.waves;
  const hp = waveHp(wave);
  const boss = isBossWave(wave);
  const count = Math.round((w.baseCount + w.countStep * (wave - 1)) * (boss ? 0.5 : 1));
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    const kind: EnemyKind = wave >= FIRST_WAVE.brute && roll < 0.15 ? 'brute' : wave >= FIRST_WAVE.runner && roll < 0.4 ? 'runner' : 'grunt';
    spawns.push({ at: (w.spawnWindow * i) / count, kind, hp: hp * BALANCE.enemies[kind].hp });
  }
  if (boss) spawns.unshift({ at: 0, kind: 'boss', hp: hp * BALANCE.enemies.boss.hp });
  return spawns;
}
