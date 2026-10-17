// The campaign in chapters of ten stages, each with its own field, a theme that bends every one
// of its stages a little (the walking mix, speed, more flyers or winders, a few elites) and
// twists on some stages on top (balance.json `chapters` and `twists`). Stage 10 of a chapter is
// its finale, with an extra boss wave; finishing a chapter opens a one-time crystal chest.

import type { BattleModifiers, MetaSave } from './meta';
import { BALANCE } from './types';
import type { WaveMods } from './waves';

export const CHAPTER_SIZE = 10;
export const CHAPTERS = BALANCE.chapters;
export const CHAPTER_COUNT = CHAPTERS.length;
/** Crystals in a chapter's one-time chest: meta.chapterChest per chapter number. */
export function chapterChest(chapter: number): number {
  return BALANCE.meta.chapterChest * chapter;
}

export type TwistId = keyof typeof BALANCE.twists;
export const TWIST_IDS = Object.keys(BALANCE.twists) as TwistId[];

interface Mods {
  speed?: number;
  mix?: { runner: number; brute: number };
  flyers?: number;
  winders?: number;
  elite?: number;
  bossWaves?: number[];
}

/** The 1-based chapter a stage is in. */
export function chapterOf(stage: number): number {
  return Math.min(CHAPTER_COUNT, Math.max(1, Math.ceil(stage / CHAPTER_SIZE)));
}

/** The first and last stage of a chapter. */
export function chapterStages(chapter: number): [number, number] {
  return [(chapter - 1) * CHAPTER_SIZE + 1, chapter * CHAPTER_SIZE];
}

/** The chapter's table entry: its id (the name key), field and theme. */
export function chapterInfo(chapter: number): (typeof CHAPTERS)[number] {
  return CHAPTERS[chapterOf(chapter * CHAPTER_SIZE) - 1];
}

/** The field texture a stage is fought on. */
export function stageField(stage: number): string {
  return chapterInfo(chapterOf(stage)).bg;
}

/** Whether the stage is its chapter's finale. */
export function isFinale(stage: number): boolean {
  return stage % CHAPTER_SIZE === 0;
}

/** The twists on a stage beyond its chapter's theme, in table order. */
export function stageTwists(stage: number): TwistId[] {
  const twists = chapterInfo(chapterOf(stage)).twists as Record<string, string[] | undefined>;
  return (twists[String(stage - (chapterOf(stage) - 1) * CHAPTER_SIZE)] ?? []) as TwistId[];
}

/** What the chapter's theme and the stage's twists change in its battles, or undefined on a
 *  plain stage (all of chapter 1 but its finale), whose battles play exactly as before chapters.
 *  Speeds multiply; flyers, winders and elites add up; a twist's mix or boss waves win over the
 *  theme's. */
export function stageModifiers(stage: number): BattleModifiers | undefined {
  const parts = [chapterInfo(chapterOf(stage)).theme as Mods, ...stageTwists(stage).map((id) => BALANCE.twists[id] as Mods)];
  if (parts.every((p) => Object.keys(p).length === 0)) return undefined;
  const wave: WaveMods = {};
  let speed = 1;
  let bossWaves: readonly number[] = BALANCE.waves.bossWaves;
  for (const p of parts) {
    if (p.speed) speed *= p.speed;
    if (p.mix) wave.mix = p.mix;
    if (p.flyers) wave.flyers = (wave.flyers ?? 0) + p.flyers;
    if (p.winders) wave.winders = (wave.winders ?? 0) + p.winders;
    if (p.elite) wave.elite = (wave.elite ?? 0) + p.elite;
    if (p.bossWaves) bossWaves = p.bossWaves;
  }
  return { enemySpeed: speed, summonCost: 1, waveGold: 1, killGold: 1, crit: 0, bossWaves, banned: [], ...wave };
}

/** Stages of a chapter the save has cleared, 0 to 10. */
export function chapterProgress(m: MetaSave, chapter: number): number {
  const [first, last] = chapterStages(chapter);
  return Math.max(0, Math.min(last, m.cleared) - first + 1);
}

/** Whether a chapter is open: its first stage is. */
export function chapterOpen(m: MetaSave, chapter: number): boolean {
  return chapterStages(chapter)[0] <= m.cleared + 1;
}

/** The chapter's chest is there to open: every stage cleared, the chest not opened yet. */
export function chestWaiting(m: MetaSave, chapter: number): boolean {
  return chapterProgress(m, chapter) === CHAPTER_SIZE && !m.chapterChests.includes(chapter);
}

/** Opens a finished chapter's chest, once; the crystals it paid, 0 when it is not there. */
export function openChapterChest(m: MetaSave, chapter: number): number {
  if (!chestWaiting(m, chapter)) return 0;
  m.chapterChests.push(chapter);
  m.chapterChests.sort((a, b) => a - b);
  const n = chapterChest(chapter);
  m.crystals += n;
  return n;
}
