// Balance guard for stages 9-50 (`npm run check:balance:slow`, a CI step of its own): the
// first-try curve `npm run chapters` (and `npm run late` for 10-20) prints, every other stage,
// pinned per chapter after the horde opener (74fee89), re-pinned after balance-tune (stages 6-8,
// ice, poison, boss hit points, chapter finales).
// Re-pinned for each potion's own pick of target (src/sim/targetPick.ts) and the hero damage cut
// that came with it (ref/design/targeting-prefs.md).
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
    expectNear('mean win % on the odd stages (20 seeds)', won, { 'chapter 1': 70, 'chapter 2': 36, 'chapter 3': 37, 'chapter 4': 38, 'chapter 5': 28 }, 10);
  }, 300_000);
});
