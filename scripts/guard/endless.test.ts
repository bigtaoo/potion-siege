// Balance guard for endless (`npm run check:balance:quick`, part of `npm run check`): the median
// wave `npm run endless` prints for the starting four, pinned after the horde opener (74fee89).
// Re-pinned for each potion's own pick of target (src/sim/targetPick.ts) and the hero damage cut
// that came with it (ref/design/targeting-prefs.md).
import { describe, it } from 'vitest';
import { playOut } from '../../src/sim/bot';
import { endlessSetup } from '../../src/sim/endless';
import { BALANCE } from '../../src/sim/types';
import { expectNear, median, saveFor } from './saves';

describe('endless', () => {
  it('keeps the median wave at a stage-10 clear, 56k crystals spent and maxed', () => {
    // endless.test.ts: seeds 1001+, runs of up to 7200 s
    const waves: Record<string, number> = {};
    for (const [name, budget] of [['stage 10 clear', 4755], ['56k spent', 56_000], ['maxed', 1e9]] as const) {
      const m = saveFor(budget);
      m.cleared = BALANCE.endless.unlock;
      waves[name] = median(Array.from({ length: 15 }, (_, i) => playOut(1001 + i, 7200, endlessSetup(m)).wave));
    }
    expectNear('median endless wave (15 seeds)', waves, { 'stage 10 clear': 14, '56k spent': 34, maxed: 44 }, 4);
  }, 300_000);
});
