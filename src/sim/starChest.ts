// Star chests: each chapter pays crystals once at 10, 20 and 30 stars on its normal stages, on
// top of the chest for clearing it (chapters.ts). The home screen's chapters panel shows how far
// each chapter is and opens the ones waiting.

import { CHAPTER_COUNT } from './chapters';
import type { MetaSave } from './meta';
import { chapterStars } from './stars';

/** The tiers a chapter pays at, by stars (of 30) and crystals; tuned with `npm run economy`. */
export const STAR_CHESTS = [
  { stars: 10, reward: 80 },
  { stars: 20, reward: 150 },
  { stars: 30, reward: 250 },
] as const;

/** Tiers opened per chapter (index chapter - 1), 0 to 3, for a fresh save. */
export function newStarChests(): number[] {
  return new Array<number>(CHAPTER_COUNT).fill(0);
}

/** Reads the stored part; anything broken counts as nothing opened. */
export function parseStarChests(v: unknown): number[] {
  const out = newStarChests();
  if (!Array.isArray(v)) return out;
  for (let i = 0; i < out.length; i++) out[i] = Math.min(STAR_CHESTS.length, Math.max(0, Math.floor(Number(v[i])) || 0));
  return out;
}

/** Tiers of a chapter already opened. */
export function starChestsOpened(m: MetaSave, chapter: number): number {
  return m.starChests[chapter - 1] ?? 0;
}

/** The next tier of a chapter not opened yet, null once all three are. */
export function nextStarChest(m: MetaSave, chapter: number): (typeof STAR_CHESTS)[number] | null {
  return STAR_CHESTS[starChestsOpened(m, chapter)] ?? null;
}

/** Tiers a chapter's stars have reached but not opened. */
export function starChestsWaiting(m: MetaSave, chapter: number): number {
  const stars = chapterStars(m, chapter);
  const reached = STAR_CHESTS.filter((c) => stars >= c.stars).length;
  return Math.max(0, reached - starChestsOpened(m, chapter));
}

/** Whether any chapter has a star chest waiting. */
export function anyStarChestWaiting(m: MetaSave): boolean {
  for (let ch = 1; ch <= CHAPTER_COUNT; ch++) if (starChestsWaiting(m, ch) > 0) return true;
  return false;
}

/** Opens every star chest a chapter has waiting; the crystals they paid, 0 when none was. */
export function openStarChests(m: MetaSave, chapter: number): number {
  if (chapter < 1 || chapter > CHAPTER_COUNT) return 0;
  let n = 0;
  while (starChestsWaiting(m, chapter) > 0) {
    n += STAR_CHESTS[starChestsOpened(m, chapter)].reward;
    m.starChests[chapter - 1] = starChestsOpened(m, chapter) + 1;
  }
  m.crystals += n;
  return n;
}
