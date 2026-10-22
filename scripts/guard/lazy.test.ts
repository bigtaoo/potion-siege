// Balance guard for chapter 1 (`npm run check:balance:quick`, part of `npm run check`): the idle
// player's wall `npm run lazy` prints, on fewer cells and seeds, pinned after the horde opener (74fee89).
import { describe, it } from 'vitest';
import type { Battle } from '../../src/sim/battle';
import { battleSetup } from '../../src/sim/meta';
import { expectNear, mean, play, saveFor } from './saves';

describe('chapter 1', () => {
  it('makes three idle potions lose the wall by waves 3-4', () => {
    // lazy-curve.test.ts: summon up to three potions, take the first skill card, nothing else
    const lazy = (b: Battle) => {
      if (b.choices) b.choose(b.choices[0]);
      else if (b.slots.filter(Boolean).length < 3) b.summon();
    };
    const wall: Record<string, number> = {};
    for (const [budget, stage] of [[0, 1], [0, 2], [0, 3], [500, 3], [500, 4], [1500, 4]]) {
      const m = saveFor(budget);
      const runs = Array.from({ length: 30 }, (_, i) => play(1000 + i, battleSetup(m, stage), lazy));
      // a lost run counts 0% wall from then on
      for (const w of [3, 4]) wall[`b${budget} s${stage} wave ${w}`] = 100 * mean(runs.map((r) => r.wall[w - 1] ?? (r.b.result === 'lost' ? 0 : 1)));
    }
    expectNear('idle wall % at the end of the wave (30 seeds)', wall, {
      // before e770800 (no earlyHp) stage 1 kept 100% to the boss
      'b0 s1 wave 3': 92, 'b0 s1 wave 4': 32.3,
      'b0 s2 wave 3': 83.1, 'b0 s2 wave 4': 9.6,
      'b0 s3 wave 3': 68.9, 'b0 s3 wave 4': 1.1,
      'b500 s3 wave 3': 88.9, 'b500 s3 wave 4': 27.7,
      'b500 s4 wave 3': 81, 'b500 s4 wave 4': 9.9,
      'b1500 s4 wave 3': 95.3, 'b1500 s4 wave 4': 61,
    }, 20);
  }, 300_000);
});
