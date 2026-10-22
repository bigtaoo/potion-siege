// Balance guard for chapter 1 (`npm run check:balance:slow`, a CI step of its own): the win
// rates `npm run early` prints, on fewer cells and seeds, pinned to what they were on a344dc7 and
// re-pinned for the wave-1 horde: its rushes reroll every seed's enemies, so these thirty seeds
// play other battles, while the curve on 150-200 seeds (`npm run early`, `npm run lazy`) held.
// Re-pinned again for the stage 6-8 stall point (balance-tune, fd6cf2c): stages 6-8 are meant to
// be lost on a first try about a third of the time.
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
      'b0 s1': 83.3, 'b0 s2': 73.3, 'b0 s3': 70, 'b0 s4': 26.7, 'b0 s5': 16.7,
      'b500 s3': 86.7, 'b500 s4': 70, 'b500 s5': 50, 'b500 s6': 13.3,
      'b1000 s5': 80, 'b1000 s6': 30, 'b1000 s7': 20, 'b1000 s8': 10,
    }, 15);
  }, 300_000);
});
