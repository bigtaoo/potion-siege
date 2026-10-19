// Balance guard for chapter 1 (`npm run check:balance:slow`, a CI step of its own): the win
// rates `npm run early` prints, on fewer cells and seeds, pinned to what they were on a344dc7.
import { describe, it } from 'vitest';
import { playOut } from '../../src/sim/bot';
import { battleSetup } from '../../src/sim/meta';
import { expectNear, saveFor, winRate } from './saves';

describe('chapter 1', () => {
  it('keeps the bot win rate on stages 1-8 for saves that spent 0 / 500 / 1000 crystals', () => {
    // early-curve.test.ts map mode without the revive, seeds 1000+; each budget on the stages
    // where its win rate falls from near 100% towards 0
    const cells: [number, number[]][] = [
      [0, [1, 2, 3, 4, 5]],
      [500, [3, 4, 5, 6]],
      [1000, [5, 6, 7, 8]],
    ];
    const won: Record<string, number> = {};
    for (const [budget, stages] of cells) {
      const m = saveFor(budget);
      for (const stage of stages) won[`b${budget} s${stage}`] = 100 * winRate(Array.from({ length: 30 }, (_, i) => playOut(1000 + i, 1200, battleSetup(m, stage))));
    }
    expectNear('bot win % (30 seeds)', won, {
      'b0 s1': 96.7, 'b0 s2': 76.7, 'b0 s3': 50, 'b0 s4': 33.3, 'b0 s5': 16.7,
      'b500 s3': 90, 'b500 s4': 66.7, 'b500 s5': 53.3, 'b500 s6': 36.7,
      'b1000 s5': 90, 'b1000 s6': 60, 'b1000 s7': 33.3, 'b1000 s8': 13.3,
    }, 15);
  }, 300_000);
});
