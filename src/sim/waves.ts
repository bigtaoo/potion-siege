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

/** The first stage each kind can turn up on. */
export const FIRST_STAGE: Record<EnemyKind, number> = {
  grunt: 1,
  runner: 1,
  brute: 1,
  boss: 1,
  flyer: BALANCE.flyer.stage,
  winder: BALANCE.winder.stage,
};

/** The first wave each kind can turn up in, on the stages it is on. */
export const FIRST_WAVE: Record<EnemyKind, number> = {
  grunt: 1,
  runner: 2,
  brute: 4,
  boss: Math.min(...BALANCE.waves.bossWaves),
  flyer: BALANCE.flyer.wave,
  winder: BALANCE.winder.wave,
};

/** Whether `kind` can turn up on `stage` at all. */
export function onStage(kind: EnemyKind, stage: number): boolean {
  return stage >= FIRST_STAGE[kind];
}

/** The share of a wave's crowd that flies, on this stage: none before the flyers' stage. */
export function flyerShare(stage: number): number {
  const f = BALANCE.flyer;
  return stage < f.stage ? 0 : Math.min(f.maxShare, f.share + f.shareStep * (stage - f.stage));
}

/** Whether a boss comes in `wave`; the daily challenge can bring more of them. */
export function isBossWave(wave: number, bossWaves: readonly number[] = BALANCE.waves.bossWaves): boolean {
  return bossWaves.includes(wave);
}

/** Base hit points of a grunt in this 1-based wave. */
export function waveHp(wave: number): number {
  const w = BALANCE.waves;
  return w.baseHp * w.hpGrowth ** (wave - 1);
}

/** The spawns of one wave of `stage`, sorted by time. Boss waves add the boss at the start and
 *  half the crowd. Each spawn of the crowd takes one roll, flyers off its bottom end, so a stage
 *  without flyers plans exactly as before they came; winders come at fixed times on top. */
export function planWave(wave: number, rng: Rng, stage = 1, bossWaves: readonly number[] = BALANCE.waves.bossWaves): Spawn[] {
  const w = BALANCE.waves;
  const hp = waveHp(wave);
  const boss = isBossWave(wave, bossWaves);
  const count = Math.round((w.baseCount + w.countStep * (wave - 1)) * (boss ? 0.5 : 1));
  const fly = wave >= FIRST_WAVE.flyer ? flyerShare(stage) : 0;
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    let roll = rng.next();
    let kind: EnemyKind;
    if (roll < fly) kind = 'flyer';
    else {
      roll = (roll - fly) / (1 - fly);
      kind = wave >= FIRST_WAVE.brute && roll < 0.15 ? 'brute' : wave >= FIRST_WAVE.runner && roll < 0.4 ? 'runner' : 'grunt';
    }
    spawns.push({ at: (w.spawnWindow * i) / count, kind, hp: hp * BALANCE.enemies[kind].hp });
  }
  if (boss) spawns.unshift({ at: 0, kind: 'boss', hp: hp * BALANCE.enemies.boss.hp });
  const wd = BALANCE.winder;
  if (onStage('winder', stage) && wave >= wd.wave) {
    const n = stage >= wd.twoFrom ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const at = boss ? wd.bossAt[i] : w.spawnWindow * wd.at[i];
      spawns.push({ at, kind: 'winder', hp: hp * BALANCE.enemies.winder.hp });
    }
    spawns.sort((a, b) => a.at - b.at);
  }
  return spawns;
}

/** The kinds that can come in `wave` of `stage`, in the order the codex lists them: what the
 *  wide battle screen forecasts, without rolling the wave itself. */
export function waveKinds(wave: number, stage: number, bossWaves: readonly number[] = BALANCE.waves.bossWaves): EnemyKind[] {
  const kinds: EnemyKind[] = ['grunt'];
  if (wave >= FIRST_WAVE.runner) kinds.push('runner');
  if (wave >= FIRST_WAVE.brute) kinds.push('brute');
  if (wave >= FIRST_WAVE.flyer && flyerShare(stage) > 0) kinds.push('flyer');
  if (onStage('winder', stage) && wave >= BALANCE.winder.wave) kinds.push('winder');
  if (isBossWave(wave, bossWaves)) kinds.push('boss');
  return kinds;
}
