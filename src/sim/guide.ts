// The guided tour of the first three home screens and the one-time words in battles 2 and 3
// (docs/onboarding-plan.md, sections 3-5), as plain rules over the save: the steps of each
// chapter, which chapter a save is on, and the steps a save marks done or skipped. Where each
// step points, and when it can, is the home screen's (game/homeGuide.ts).
import type { MetaSave } from './meta';

/** The home screen's steps after battles 1, 2 and 3, in order; each chapter ends at the start
 *  button. The upgrade points up to three times while the crystals last. */
export const GUIDE_CHAPTERS = [
  ['gift', 'upgrade', 'upgradeMore', 'upgradeLast', 'toBattle1'],
  ['login', 'tasks', 'workshop', 'toBattle2'],
  ['codex', 'shop', 'challenge', 'toBattle3'],
] as const;

/** One-time words in battles 2 and 3: the first 强化, the stars on the first won result, the
 *  推荐 tag on the first skill pick of battle 3; and stage 1's boss card in the first battle. */
export const GUIDE_ONCE = ['upgrade2', 'stars', 'pickTip', 'bossCard'] as const;

export type GuideStep = (typeof GUIDE_CHAPTERS)[number][number];
export type GuideOnce = (typeof GUIDE_ONCE)[number];
export type GuideId = GuideStep | GuideOnce;

const ALL: readonly string[] = [...GUIDE_CHAPTERS.flat(), ...GUIDE_ONCE];

/** The chapter (1-3) of the home screen a save comes home to: the one after its battles so far,
 *  none before the first battle or after the third. */
export function guideChapter(m: MetaSave): 1 | 2 | 3 | null {
  return m.runs >= 1 && m.runs <= GUIDE_CHAPTERS.length ? (m.runs as 1 | 2 | 3) : null;
}

/** The steps of the chapter a save is on that it has not done or skipped, in order. */
export function guideLeft(m: MetaSave): GuideStep[] {
  const ch = guideChapter(m);
  return ch ? GUIDE_CHAPTERS[ch - 1].filter((id) => !m.guide.includes(id)) : [];
}

/** Marks `id` done or skipped; false when it was already. */
export function markGuide(m: MetaSave, id: GuideId): boolean {
  if (m.guide.includes(id)) return false;
  m.guide.push(id);
  return true;
}

/** The chapter's start step: what the skip on a bubble leaves. */
export function toBattle(ch: 1 | 2 | 3): GuideStep {
  return GUIDE_CHAPTERS[ch - 1][GUIDE_CHAPTERS[ch - 1].length - 1];
}

/** A stored list read back: known ids only, once each. A save from before the guide that has
 *  played already knows the game, so it has done all of it. */
export function parseGuide(raw: unknown, runs: number): string[] {
  if (!Array.isArray(raw)) return runs > 0 ? [...ALL] : [];
  return raw.filter((id, i, a): id is string => typeof id === 'string' && ALL.includes(id) && a.indexOf(id) === i);
}
