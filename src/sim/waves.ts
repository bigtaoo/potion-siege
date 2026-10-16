// The wave plan: which enemies arrive in each wave and how tough they are.

import { FP, ticks } from './math/fixed';
import type { Prng } from './math/prng';
import { BALANCE, type EnemyKind } from './types';

export interface Spawn {
  /** Ticks after the wave starts. */
  at: number;
  kind: EnemyKind;
  /** Hit points in FP units, already scaled for the wave. */
  hp: number;
  /** Permille of the usual kill gold: one of a bigger, weaker early crowd is worth less. */
  gold?: number;
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

/** Base hit points of a grunt in this 1-based wave (multiplied out, not a power: the same bits
 *  on every engine). */
export function waveHp(wave: number): number {
  const w = BALANCE.waves;
  let hp = w.baseHp;
  for (let i = 1; i < wave; i++) hp *= w.hpGrowth;
  return hp;
}

/** The spawns of one wave of `stage`, sorted by time. Boss waves add the boss at the start and
 *  half the crowd. Each spawn of the crowd takes one roll, flyers off its bottom end, so a stage
 *  without flyers plans exactly as before they came; winders come at fixed times on top. */
export function planWave(wave: number, rng: Prng, stage = 1, bossWaves: readonly number[] = BALANCE.waves.bossWaves): Spawn[] {
  const w = BALANCE.waves;
  const hp = waveHp(wave);
  const hpOf = (kind: EnemyKind) => Math.round(hp * BALANCE.enemies[kind].hp * FP);
  const boss = isBossWave(wave, bossWaves);
  // the first waves send a bigger crowd of weaker enemies: the same hit points and gold in all,
  // but more of them on the road (permille)
  const crowd = Math.round((w.earlyCrowd[wave - 1] ?? 1) * 1000);
  const count = Math.round(((w.baseCount + w.countStep * (wave - 1)) * (boss ? 0.5 : 1) * crowd) / 1000);
  // the rolls are in permille
  const fly = wave >= FIRST_WAVE.flyer ? Math.round(flyerShare(stage) * 1000) : 0;
  const span = ticks(w.spawnWindow);
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    let roll = rng.int(1000);
    let kind: EnemyKind;
    if (roll < fly) kind = 'flyer';
    else {
      roll = Math.trunc(((roll - fly) * 1000) / (1000 - fly));
      kind = wave >= FIRST_WAVE.brute && roll < 150 ? 'brute' : wave >= FIRST_WAVE.runner && roll < 400 ? 'runner' : 'grunt';
    }
    const spawn: Spawn = { at: Math.trunc((span * i) / count), kind, hp: hpOf(kind) };
    if (crowd !== 1000) {
      spawn.hp = Math.round((spawn.hp * 1000) / crowd);
      spawn.gold = Math.round(1_000_000 / crowd);
    }
    spawns.push(spawn);
  }
  if (boss) spawns.unshift({ at: 0, kind: 'boss', hp: hpOf('boss') });
  const wd = BALANCE.winder;
  if (onStage('winder', stage) && wave >= wd.wave) {
    const n = stage >= wd.twoFrom ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const at = boss ? ticks(wd.bossAt[i]) : ticks(w.spawnWindow * wd.at[i]);
      spawns.push({ at, kind: 'winder', hp: hpOf('winder') });
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
