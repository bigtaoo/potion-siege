// Stage stars and hard mode. A won stage earns one to three stars by the wall left standing at
// the end (a revived win only one); a stage keeps its best. Enough stars on a chapter open its
// hard mode: the same ten stages and waves, the enemies as tough as `hard.shift` stages further on
// and a little faster, played in order, paying crystals as that stage would, plus a one-time sum
// for each hard stage's first win.
// Called `stageStars` / `hardStars` where it reads better, as "star" is a potion's merge level.

import { CHAPTER_COUNT, CHAPTER_SIZE, chapterOf, chapterProgress, chapterStages } from './chapters';
import { battleSetup, stageHp, workshopValue, type BattleSetup, type MetaSave, type Reward, type RunResult } from './meta';
import { EXTRA_SUMMONS } from './tutorial';
import { BALANCE } from './types';

/** The stars rule and hard mode, picked with the bot (scripts/stars-probe.test.ts). */
export const STARS = {
  /** The share of the wall left at a win for two and for three stars. */
  two: 0.5,
  three: 0.8,
  /** Stars a chapter's normal stages need (of 30), every stage cleared too, to open its hard mode. */
  unlock: 24,
  hard: {
    /** A hard stage's enemies have the hit points, and it pays the crystals, of a normal stage
     *  this much further on (the hit point curve's growth only: the stage keeps its own scale). */
    shift: 6,
    /** Multiplier on enemy speed. */
    speed: 1.1,
    /** The share of that stage's first clear bonus a hard stage's first win pays. */
    firstClear: 0.5,
  },
} as const;

const STAGES = BALANCE.meta.stageCount;

export interface StarSave {
  /** Best stars on each stage, normal and hard (index stage - 1), 0 while never won. */
  normal: number[];
  hard: number[];
  /** The battle tab's normal / hard switch. */
  hardMode: boolean;
}

export function newStars(): StarSave {
  return { normal: new Array<number>(STAGES).fill(0), hard: new Array<number>(STAGES).fill(0), hardMode: false };
}

/** Reads the stored part; a save from before stars gets one star on every stage it cleared. */
export function parseStars(v: unknown, cleared: number): StarSave {
  const out = newStars();
  const d = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const read = (x: unknown, into: number[]) => {
    if (!Array.isArray(x)) return;
    for (let i = 0; i < STAGES; i++) into[i] = Math.min(3, Math.max(0, Math.floor(Number(x[i])) || 0));
  };
  read(d.normal, out.normal);
  read(d.hard, out.hard);
  // a cleared stage has at least one star, and a stage not cleared none
  for (let i = 0; i < STAGES; i++) out.normal[i] = i < cleared ? Math.max(1, out.normal[i]) : 0;
  out.hardMode = d.hardMode === true;
  return out;
}

/** Stars for a battle's end: none for a loss, one for a revived win, else by the wall left. */
export function runStars(won: boolean, revived: boolean, wallLeft: number): number {
  if (!won) return 0;
  if (revived) return 1;
  return wallLeft >= STARS.three ? 3 : wallLeft >= STARS.two ? 2 : 1;
}

/** Best stars on a stage, in normal or hard mode. */
export function stageStars(m: MetaSave, stage: number, hard = false): number {
  return (hard ? m.stars.hard : m.stars.normal)[stage - 1] ?? 0;
}

/** Stars on a chapter's stages, in normal or hard mode. */
export function chapterStars(m: MetaSave, chapter: number, hard = false): number {
  const [first, last] = chapterStages(chapter);
  let n = 0;
  for (let s = first; s <= last; s++) n += stageStars(m, s, hard);
  return n;
}

/** Stars over every stage, normal and hard. */
export function totalStars(m: MetaSave): number {
  let n = 0;
  for (let i = 0; i < STAGES; i++) n += m.stars.normal[i] + m.stars.hard[i];
  return n;
}

/** Hard stages won at least once. */
export function hardCleared(m: MetaSave): number {
  return m.stars.hard.filter((s) => s > 0).length;
}

/** A chapter's hard mode is open: all its stages cleared with `unlock` stars or more. */
export function hardOpen(m: MetaSave, chapter: number): boolean {
  return chapterProgress(m, chapter) === CHAPTER_SIZE && chapterStars(m, chapter) >= STARS.unlock;
}

/** A hard stage can be played: its chapter's hard mode is open and the hard stage before it in
 *  the chapter is won (the first one needs nothing more). */
export function hardPlayable(m: MetaSave, stage: number): boolean {
  if (stage < 1 || stage > STAGES) return false;
  const ch = chapterOf(stage);
  return hardOpen(m, ch) && (stage === chapterStages(ch)[0] || stageStars(m, stage - 1, true) > 0);
}

/** Any chapter's hard mode is open. */
export function anyHardOpen(m: MetaSave): boolean {
  for (let ch = 1; ch <= CHAPTER_COUNT; ch++) if (hardOpen(m, ch)) return true;
  return false;
}

/** The battle about to be fought is on hard mode. */
export function playingHard(m: MetaSave): boolean {
  return m.stars.hardMode && hardPlayable(m, m.stage);
}

/** Whether the stage could be picked in the mode the switch is on. */
export function stageOpen(m: MetaSave, stage: number): boolean {
  return m.stars.hardMode ? hardPlayable(m, stage) : stage >= 1 && stage <= Math.min(STAGES, m.cleared + 1);
}

/** The next stage open in the switch's mode from `stage` in direction `dir` (±1), or null. */
export function stepStage(m: MetaSave, stage: number, dir: number): number | null {
  for (let s = stage + dir; s >= 1 && s <= STAGES; s += dir) if (stageOpen(m, s)) return s;
  return null;
}

/** The furthest hard stage open, or null while no chapter's hard mode is. */
export function furthestHard(m: MetaSave): number | null {
  for (let s = STAGES; s >= 1; s--) if (hardPlayable(m, s)) return s;
  return null;
}

/** Flips the battle tab's switch; false (nothing changes) when hard mode is not open anywhere.
 *  Turning it on moves to the furthest open hard stage unless the chosen one is open; turning
 *  it off moves back onto an open stage if needed. */
export function setHardMode(m: MetaSave, on: boolean): boolean {
  if (on && !anyHardOpen(m)) return false;
  m.stars.hardMode = on;
  if (on && !hardPlayable(m, m.stage)) m.stage = furthestHard(m) ?? m.stage;
  if (!on) m.stage = Math.min(m.stage, Math.min(STAGES, m.cleared + 1));
  return true;
}

/** The battle setup of the chosen stage in the switch's mode: on hard mode the enemies are as
 *  tough as `hard.shift` stages on and `hard.speed` as fast. */
export function stageSetup(m: MetaSave): BattleSetup {
  const setup = battleSetup(m);
  if (playingHard(m)) return hardSetup(setup);
  // the tutorial's 召唤 twice more while 强化's gold comes in, free so 强化 comes no later
  return m.tutorial || setup.stage !== 1 ? setup : { ...setup, giftSummons: EXTRA_SUMMONS };
}

export function hardSetup(setup: BattleSetup): BattleSetup {
  const H = STARS.hard;
  const scale = (s: number) => (BALANCE.meta.stageHpScale as Record<string, number | undefined>)[s] ?? 1;
  const growth = stageHp(setup.stage + H.shift) / scale(setup.stage + H.shift) / (stageHp(setup.stage) / scale(setup.stage));
  const mods = setup.modifiers ?? { enemySpeed: 1, summonCost: 1, waveGold: 1, killGold: 1, crit: 0, bossWaves: BALANCE.waves.bossWaves, banned: [] };
  return { ...setup, enemyHp: setup.enemyHp * growth, modifiers: { ...mods, enemySpeed: mods.enemySpeed * H.speed }, hard: true };
}

/** What a hard battle pays: a normal battle's crystals as if on stage `stage + hard.shift`, and
 *  on its first win `hard.firstClear` of that stage's first clear bonus. Never a first clear of
 *  the campaign: no stage opens and no potion unlocks. */
export function hardReward(m: MetaSave, r: RunResult): Reward {
  const R = BALANCE.meta.reward;
  const at = r.stage + STARS.hard.shift;
  let base = R.perWave * r.wave + Math.floor(r.kills / R.perKills) + (r.won ? R.winBonus : 0);
  base *= 1 + R.stageStep * (at - 1);
  const first = r.won && stageStars(m, r.stage, true) === 0;
  if (first) base += STARS.hard.firstClear * R.firstClear * at;
  return { crystals: Math.round(base * (1 + workshopValue('crystals', m.workshop.crystals))), firstClear: false, unlocked: [] };
}

/** What a battle's stars booked: the stars it earned, the stage's best before it, and the
 *  chapter whose hard mode they opened (0 when none). */
export interface StarsResult {
  stars: number;
  before: number;
  hard: boolean;
  opened: number;
}

/** Keeps a finished battle's stars as the stage's best. */
export function bookStars(m: MetaSave, stage: number, hard: boolean, stars: number): StarsResult {
  const list = hard ? m.stars.hard : m.stars.normal;
  const before = list[stage - 1] ?? 0;
  const ch = chapterOf(stage);
  // a stage won for the first time was not cleared before this battle, so its chapter was not
  // all cleared either (the save's `cleared` has moved on already)
  const was = hard || (before > 0 && hardOpen(m, ch));
  if (stage >= 1 && stage <= STAGES) list[stage - 1] = Math.max(before, stars);
  return { stars, before, hard, opened: !was && hardOpen(m, ch) ? ch : 0 };
}
