// The wave plan: which enemies arrive in each wave and how tough they are.

import { FP, ticks } from './math/fixed';
import type { Prng } from './math/prng';
import { BALANCE, BOSS_KINDS, isBoss, type BossKind, type EnemyKind } from './types';

export interface Spawn {
  /** Ticks after the wave starts. */
  at: number;
  kind: EnemyKind;
  /** Hit points in FP units, already scaled for the wave. */
  hp: number;
  /** Permille of the usual kill gold: one of a bigger, weaker early crowd is worth less. */
  gold?: number;
}

/** The boss of the chapter `stage` is in: the steam tank on stages 1-10, then a new one every
 *  ten stages; past the last of them they come round again. */
export function bossForStage(stage: number): BossKind {
  const chapter = Math.max(1, Math.ceil(stage / BALANCE.bosses.chapter));
  return BOSS_KINDS[(chapter - 1) % BOSS_KINDS.length];
}

/** The first stage of the chapter `kind` leads. */
function bossStage(kind: BossKind): number {
  return BOSS_KINDS.indexOf(kind) * BALANCE.bosses.chapter + 1;
}

/** The first stage each kind can turn up on. */
export const FIRST_STAGE: Record<EnemyKind, number> = {
  grunt: 1,
  runner: 1,
  brute: 1,
  boss: bossStage('boss'),
  flyer: BALANCE.flyer.stage,
  winder: BALANCE.winder.stage,
  clock: bossStage('clock'),
  tripod: bossStage('tripod'),
  anvil: bossStage('anvil'),
  gear: bossStage('gear'),
};

/** The first wave each kind can turn up in, on the stages it is on. */
export const FIRST_WAVE: Record<EnemyKind, number> = {
  grunt: 1,
  runner: 2,
  brute: 4,
  boss: Math.min(...BALANCE.waves.bossWaves),
  flyer: BALANCE.flyer.wave,
  winder: BALANCE.winder.wave,
  clock: Math.min(...BALANCE.waves.bossWaves),
  tripod: Math.min(...BALANCE.waves.bossWaves),
  anvil: Math.min(...BALANCE.waves.bossWaves),
  gear: Math.min(...BALANCE.waves.bossWaves),
};

/** Whether `kind` can turn up on `stage` at all: a boss only in its own chapter. */
export function onStage(kind: EnemyKind, stage: number): boolean {
  return isBoss(kind) ? bossForStage(stage) === kind : stage >= FIRST_STAGE[kind];
}

/** The share of a wave's crowd that flies, on this stage: none before the flyers' stage. */
export function flyerShare(stage: number): number {
  const f = BALANCE.flyer;
  return stage < f.stage ? 0 : Math.min(f.maxShare, f.share + f.shareStep * (stage - f.stage));
}

/** Whether a boss comes in `wave`; the daily challenge can bring more of them, and endless mode
 *  sends one every `endless.bossEvery` waves for as long as it lasts. */
export function isBossWave(wave: number, bossWaves: readonly number[] = BALANCE.waves.bossWaves, endless = false): boolean {
  return endless ? wave % BALANCE.endless.bossEvery === 0 : bossWaves.includes(wave);
}

/** The bosses endless mode takes turns with, in chapter order: the endless stage's own boss on its
 *  boss waves, then past its last wave one chapter's boss after another, round and round. */
export const ENDLESS_BOSSES: readonly BossKind[] = BOSS_KINDS;

/** The boss of an endless boss wave: the first ten waves are the endless stage's own (the tank),
 *  then the clock on wave 15, the tripod on 20, the anvil on 25, the gear king on 30, the tank on 35... */
export function endlessBoss(wave: number): BossKind {
  const E = BALANCE.endless;
  if (wave <= BALANCE.waves.count) return bossForStage(E.stage);
  const turn = Math.floor((wave - BALANCE.waves.count) / E.bossEvery);
  return ENDLESS_BOSSES[(ENDLESS_BOSSES.indexOf(bossForStage(E.stage)) + turn) % ENDLESS_BOSSES.length];
}

/** The bosses an endless run reaching `wave` has met, in the order it met them. */
export function endlessBossesMet(wave: number): BossKind[] {
  const met: BossKind[] = [];
  for (let w = BALANCE.endless.bossEvery; w <= wave && met.length < ENDLESS_BOSSES.length; w += BALANCE.endless.bossEvery) {
    const kind = endlessBoss(w);
    if (!met.includes(kind)) met.push(kind);
  }
  return met;
}

/** Endless waves past the last wave of a stage, 0 up to it: how far the mix has tilted. */
function endlessExtra(wave: number, endless: boolean): number {
  return endless ? Math.max(0, wave - BALANCE.waves.count) : 0;
}

/** Base hit points of a grunt in this 1-based wave (multiplied out, not a power: the same bits
 *  on every engine). */
export function waveHp(wave: number): number {
  const w = BALANCE.waves;
  let hp = w.baseHp;
  for (let i = 1; i < wave; i++) hp *= w.hpGrowth;
  return hp;
}

/** A grunt's base hit points in `wave` and how many the wave's crowd counts. In endless mode past the
 *  stage's last wave the hit points grow `endless.hpGrowth` a wave instead, and the crowd stops at
 *  `endless.maxCount`, what it would have had over the cap going into hit points. Whatever else
 *  the wave brings on (the clock's mice) is as tough as its crowd. */
export function crowdOf(wave: number, endless = false): { hp: number; count: number } {
  const w = BALANCE.waves;
  const E = BALANCE.endless;
  const extra = endlessExtra(wave, endless);
  let hp = waveHp(wave - extra);
  for (let i = 0; i < extra; i++) hp *= E.hpGrowth;
  let count = w.baseCount + w.countStep * (wave - 1);
  if (extra > 0 && count > E.maxCount) {
    hp = (hp * count) / E.maxCount;
    count = E.maxCount;
  }
  return { hp, count };
}

/** The spawns of one wave of `stage`, sorted by time. Boss waves add the chapter's boss at the start and
 *  half the crowd. Each spawn of the crowd takes one roll, flyers off its bottom end, so a stage
 *  without flyers plans exactly as before they came; winders come at fixed times on top.
 *  `endless`: past the stage's last wave the waves keep coming, `endless.hpGrowth` tougher each,
 *  the crowd capped at `endless.maxCount` (what it would have had over the cap goes into hit
 *  points), more brutes, flyers and winders in the mix, and a boss every `endless.bossEvery`. */
export function planWave(wave: number, rng: Prng, stage = 1, bossWaves: readonly number[] = BALANCE.waves.bossWaves, endless = false): Spawn[] {
  const w = BALANCE.waves;
  const E = BALANCE.endless;
  const extra = endlessExtra(wave, endless);
  const { hp, count: crowdCount } = crowdOf(wave, endless);
  const hpOf = (kind: EnemyKind) => Math.round(hp * BALANCE.enemies[kind].hp * FP);
  const boss = isBossWave(wave, bossWaves, endless);
  // the first waves send a bigger crowd of weaker enemies: the same hit points and gold in all,
  // but more of them on the road (permille)
  const crowd = Math.round((w.earlyCrowd[wave - 1] ?? 1) * 1000);
  const count = Math.round((crowdCount * (boss ? 0.5 : 1) * crowd) / 1000);
  // the rolls are in permille
  const fly = wave >= FIRST_WAVE.flyer ? Math.round(Math.min(Math.max(flyerShare(stage), E.flyerMax), flyerShare(stage) + E.flyerStep * extra) * 1000) : 0;
  const brute = Math.min(Math.max(150, E.bruteMax), 150 + E.bruteStep * extra);
  const span = ticks(w.spawnWindow);
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    let roll = rng.int(1000);
    let kind: EnemyKind;
    if (roll < fly) kind = 'flyer';
    else {
      roll = Math.trunc(((roll - fly) * 1000) / (1000 - fly));
      kind = wave >= FIRST_WAVE.brute && roll < brute ? 'brute' : wave >= FIRST_WAVE.runner && roll < brute + 250 ? 'runner' : 'grunt';
    }
    const spawn: Spawn = { at: Math.trunc((span * i) / count), kind, hp: hpOf(kind) };
    if (crowd !== 1000) {
      spawn.hp = Math.round((spawn.hp * 1000) / crowd);
      spawn.gold = Math.round(1_000_000 / crowd);
    }
    spawns.push(spawn);
  }
  if (boss) {
    const kind = endless ? endlessBoss(wave) : bossForStage(stage);
    spawns.unshift({ at: 0, kind, hp: hpOf(kind) });
  }
  const wd = BALANCE.winder;
  if (onStage('winder', stage) && wave >= wd.wave) {
    const base = stage >= wd.twoFrom ? 2 : 1;
    const n = Math.max(base, Math.min(E.winderMax, base + Math.floor(extra / E.winderEvery)));
    for (let i = 0; i < n; i++) {
      // more winders than the fixed times: spread evenly over the window instead
      const at = n > wd.at.length ? Math.trunc((span * (i + 1)) / (n + 1)) : boss ? ticks(wd.bossAt[i]) : ticks(w.spawnWindow * wd.at[i]);
      spawns.push({ at, kind: 'winder', hp: hpOf('winder') });
    }
    spawns.sort((a, b) => a.at - b.at);
  }
  return spawns;
}

/** The kinds that can come in `wave` of `stage`, in the order the codex lists them: what the
 *  wide battle screen forecasts, without rolling the wave itself. */
export function waveKinds(wave: number, stage: number, bossWaves: readonly number[] = BALANCE.waves.bossWaves, endless = false): EnemyKind[] {
  const kinds: EnemyKind[] = ['grunt'];
  if (wave >= FIRST_WAVE.runner) kinds.push('runner');
  if (wave >= FIRST_WAVE.brute) kinds.push('brute');
  if (wave >= FIRST_WAVE.flyer && flyerShare(stage) > 0) kinds.push('flyer');
  if (onStage('winder', stage) && wave >= BALANCE.winder.wave) kinds.push('winder');
  if (isBossWave(wave, bossWaves, endless)) kinds.push(endless ? endlessBoss(wave) : bossForStage(stage));
  return kinds;
}
