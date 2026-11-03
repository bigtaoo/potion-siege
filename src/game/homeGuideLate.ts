// The home guide's one-time pointers after its three chapters (docs/onboarding-plan.md, "之后"):
// the first time a chapter's chest or a star chest waits, a new potion sits on the bench, or
// endless or hard mode opens, or the crystal sieve's first level pays once the chapters are
// over, the hand points the way there once. A pointer with nothing to do
// yet just waits; one tap off its path counts it as gone round.

import { CHAPTER_COUNT, chestWaiting } from '../sim/chapters';
import { GUIDE_CHAPTERS, type GuideLater } from '../sim/guide';
import { endlessOpen } from '../sim/endless';
import { benched, workshopCost, type MetaSave } from '../sim/meta';
import { anyStarChestWaiting } from '../sim/starChest';
import { hardOpen } from '../sim/stars';
import { onTab, type Rule, type Where } from './guideRules';

/** A step in the chapters panel: the battle tab, its stage card, then `inner` in the panel. */
const inChapters = (inner: string) => (w: Where) => (w.panel === 'chapters' ? inner : w.panel ? null : w.tab === 'battle' ? 'stageCard' : 'tab_battle');
const chapters = (claim: string) => (act: string, arg: unknown) =>
  act === claim ? 'done' : (act === 'tab' && arg === 'battle') || (act === 'panel' && arg === 'chapters') ? 'path' : undefined;
const onBattle = (done: string) => (act: string, arg: unknown) => (act === done ? 'done' : act === 'tab' && arg === 'battle' ? 'path' : undefined);
const anyChapter = (m: MetaSave, test: (m: MetaSave, ch: number) => boolean) => Array.from({ length: CHAPTER_COUNT }, (_, i) => i + 1).some((ch) => test(m, ch));

export const LATER_RULES: Record<GuideLater, Rule> = {
  chapterChest: {
    can: (m) => anyChapter(m, chestWaiting),
    aim: (_m, w) => inChapters('chapter_chest')(w),
    tap: chapters('claimChapter'),
  },
  starChest: {
    can: (m) => anyStarChestWaiting(m),
    aim: (_m, w) => inChapters('star_chest')(w),
    tap: chapters('claimStarChest'),
  },
  lineup: {
    can: (m) => benched(m).length > 0,
    aim: (_m, w) => onTab('potions', 'bench')(w),
    tap: (act, arg) => (act === 'lineup' ? 'done' : act === 'tab' && arg === 'potions' ? 'path' : undefined),
  },
  sieve: {
    can: (m) => m.runs > GUIDE_CHAPTERS.length && m.workshop.crystals === 0 && (workshopCost('crystals', 0) ?? Infinity) <= m.crystals,
    aim: (_m, w) => onTab('workshop', 'buy_crystals')(w),
    tap: (act, arg) => (act === 'workshop' && arg === 'crystals' ? 'done' : act === 'tab' && arg === 'workshop' ? 'path' : undefined),
  },
  endless: {
    can: (m) => endlessOpen(m),
    aim: (_m, w) => onTab('battle', 'endless')(w),
    tap: onBattle('endless'),
  },
  hard: {
    can: (m) => !m.stars.hardMode && anyChapter(m, hardOpen),
    aim: (_m, w) => onTab('battle', 'hardToggle')(w),
    tap: onBattle('hardMode'),
  },
};
