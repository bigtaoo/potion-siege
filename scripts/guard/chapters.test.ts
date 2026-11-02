// Balance guard for stages 9-50 (`npm run check:balance:slow`, a CI step of its own): the
// first-try curve `npm run chapters` (and `npm run late` for 10-20) prints, every other stage,
// pinned per chapter after the horde opener (74fee89), re-pinned after balance-tune (stages 6-8,
// ice, poison, boss hit points, chapter finales).
// Re-pinned for each potion's own pick of target (src/sim/targetPick.ts) and the hero damage cut
// that came with it (ref/design/targeting-prefs.md), then for the lighter tripod and anvil.
// Chapter 1 (stage 9 alone) re-pinned 70 -> 90 for its busier crowd (waves.firstCrowd): these 20
// seeds swing, on 100 seeds stage 9 wins 86% before and 87% after.
// Re-pinned for the player-aimed spells (docs/spells.md): chapters 1-3 are left easier, chapters
// 4-5 put back on their old curve by stageHpScale 31-50 (60 seeds: 51.0% -> 51.0%, 40.3% -> 39.7%).
import { describe, it } from 'vitest';
import { playOut } from '../../src/sim/bot';
import { chapterOf } from '../../src/sim/chapters';
import { battleSetup } from '../../src/sim/meta';
import { ARRIVE, expectNear, mean, saveFor, winRate } from './saves';

describe('chapters', () => {
  it('keeps the bot first-try win rate at the arrival save, per chapter', () => {
    // chapter-curve.test.ts: the starting four bought cheapest first from ARRIVE, seeds 9000+
    const byChapter = new Map<number, number[]>();
    for (let stage = 9; stage <= 50; stage += 2) {
      const setup = battleSetup(saveFor(ARRIVE[stage]), stage);
      const win = winRate(Array.from({ length: 20 }, (_, i) => playOut(9000 + i, 1200, setup)));
      byChapter.set(chapterOf(stage), [...(byChapter.get(chapterOf(stage)) ?? []), win]);
    }
    const won: Record<string, number> = {};
    for (const [ch, wins] of byChapter) won[`chapter ${ch}`] = 100 * mean(wins);
    expectNear('mean win % on the odd stages (20 seeds)', won, { 'chapter 1': 100, 'chapter 2': 46, 'chapter 3': 58, 'chapter 4': 45, 'chapter 5': 47 }, 10);
  }, 300_000);
});
