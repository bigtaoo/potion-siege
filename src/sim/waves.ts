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
  /** The gold-trimmed variant of an elite stage: tougher, bigger and worth more. */
  elite?: boolean;
}

/** What a stage (its chapter's theme and twists) or the daily challenge changes in the wave
 *  plan; absent fields plan as on a plain stage. */
export interface WaveMods {
  /** The waves a boss comes in. */
  bossWaves?: readonly number[];
  /** Shares of the walking crowd that are runners and brutes (the rest grunts). */
  mix?: { runner: number; brute: number };
  /** Share of the crowd that flies on top of the stage's own. */
  flyers?: number;
  /** Winders a wave on top of the stage's own. */
  winders?: number;
  /** Share of the crowd (bosses aside) that comes as elites. */
  elite?: number;
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

/** Whether a boss comes in `wave`; the daily challenge can bring more of them, and endless mode
 *  sends one every `endless.bossEvery` waves for as long as it lasts. */
export function isBossWave(wave: number, bossWaves: readonly number[] = BALANCE.waves.bossWaves, endless = false): boolean {
  return endless ? wave % BALANCE.endless.bossEvery === 0 : bossWaves.includes(wave);
}

/** The bosses endless mode takes turns with, one boss wave after another. */
export const ENDLESS_BOSSES: readonly EnemyKind[] = ['boss'];

/** The boss of an endless boss wave. */
export function endlessBoss(wave: number): EnemyKind {
  return ENDLESS_BOSSES[(Math.floor(wave / BALANCE.endless.bossEvery) - 1) % ENDLESS_BOSSES.length];
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

/** The spawns of one wave of `stage`, sorted by time. Boss waves add the boss at the start and
 *  half the crowd. Each spawn of the crowd takes one roll, flyers off its bottom end, so a stage
 *  without flyers plans exactly as before they came; winders come at fixed times on top.
 *  `mods` are a stage's chapter theme and twists (or a challenge's bosses); none plans as before.
 *  `endless`: past the stage's last wave the waves keep coming, `endless.hpGrowth` tougher each,
 *  the crowd capped at `endless.maxCount` (what it would have had over the cap goes into hit
 *  points), more brutes, flyers and winders in the mix, and a boss every `endless.bossEvery`. */
export function planWave(wave: number, rng: Prng, stage = 1, mods: WaveMods = {}, endless = false): Spawn[] {
  const w = BALANCE.waves;
  const E = BALANCE.endless;
  const bossWaves = mods.bossWaves ?? w.bossWaves;
  const extra = endlessExtra(wave, endless);
  let hp = waveHp(wave - extra);
  for (let i = 0; i < extra; i++) hp *= E.hpGrowth;
  let crowdCount = w.baseCount + w.countStep * (wave - 1);
  if (extra > 0 && crowdCount > E.maxCount) {
    hp = (hp * crowdCount) / E.maxCount;
    crowdCount = E.maxCount;
  }
  const hpOf = (kind: EnemyKind) => Math.round(hp * BALANCE.enemies[kind].hp * FP);
  const boss = isBossWave(wave, bossWaves, endless);
  // the first waves send a bigger crowd of weaker enemies: the same hit points and gold in all,
  // but more of them on the road (permille)
  const crowd = Math.round((w.earlyCrowd[wave - 1] ?? 1) * 1000);
  const count = Math.round((crowdCount * (boss ? 0.5 : 1) * crowd) / 1000);
  // the rolls are in permille
  const flyers = flyerShare(stage) + (mods.flyers ?? 0);
  const fly = wave >= FIRST_WAVE.flyer ? Math.round(Math.min(Math.max(flyers, E.flyerMax), flyers + E.flyerStep * extra) * 1000) : 0;
  const mix = mods.mix ?? w.mix;
  const baseBrute = Math.round(mix.brute * 1000);
  const brute = Math.min(Math.max(baseBrute, E.bruteMax), baseBrute + E.bruteStep * extra);
  const runner = brute + Math.round(mix.runner * 1000);
  const elite = Math.round((mods.elite ?? 0) * 1000);
  const EL = BALANCE.elite;
  const span = ticks(w.spawnWindow);
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    let roll = rng.int(1000);
    let kind: EnemyKind;
    if (roll < fly) kind = 'flyer';
    else {
      roll = Math.trunc(((roll - fly) * 1000) / (1000 - fly));
      kind = wave >= FIRST_WAVE.brute && roll < brute ? 'brute' : wave >= FIRST_WAVE.runner && roll < runner ? 'runner' : 'grunt';
    }
    const spawn: Spawn = { at: Math.trunc((span * i) / count), kind, hp: hpOf(kind) };
    if (crowd !== 1000) {
      spawn.hp = Math.round((spawn.hp * 1000) / crowd);
      spawn.gold = Math.round(1_000_000 / crowd);
    }
    // only an elite stage takes this second roll, so the rest plan exactly as before elites
    if (elite > 0 && rng.int(1000) < elite) {
      spawn.elite = true;
      spawn.hp = Math.round(spawn.hp * EL.hp);
      spawn.gold = Math.round((spawn.gold ?? 1000) * EL.gold);
    }
    spawns.push(spawn);
  }
  // boss hook: the chapter bosses' bossForStage(stage) picks the kind here once it lands
  if (boss) {
    const kind = endless ? endlessBoss(wave) : 'boss';
    spawns.unshift({ at: 0, kind, hp: hpOf(kind) });
  }
  const wd = BALANCE.winder;
  if (onStage('winder', stage) && wave >= wd.wave) {
    const base = Math.min(wd.at.length, (stage >= wd.twoFrom ? 2 : 1) + (mods.winders ?? 0));
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
export function waveKinds(wave: number, stage: number, mods: WaveMods = {}, endless = false): EnemyKind[] {
  const bossWaves = mods.bossWaves ?? BALANCE.waves.bossWaves;
  const kinds: EnemyKind[] = ['grunt'];
  if (wave >= FIRST_WAVE.runner) kinds.push('runner');
  if (wave >= FIRST_WAVE.brute) kinds.push('brute');
  if (wave >= FIRST_WAVE.flyer && flyerShare(stage) + (mods.flyers ?? 0) > 0) kinds.push('flyer');
  if (onStage('winder', stage) && wave >= BALANCE.winder.wave) kinds.push('winder');
  if (isBossWave(wave, bossWaves, endless)) kinds.push(endless ? endlessBoss(wave) : 'boss');
  return kinds;
}
