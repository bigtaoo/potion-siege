import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { ticks } from './math/fixed';
import { BALANCE } from './types';

const W = BALANCE.waves;

/** Plays `n` ticks, `clear` taking every enemy off the field before each; the kinds that came in
 *  order and the tick each wave started on. */
function run(n: number, clear: boolean) {
  const b = new Battle(7);
  const kinds: string[] = [];
  const starts: number[] = [];
  const seen = new Set<number>();
  for (let t = 0; t < n && b.result === null; t++) {
    if (clear) b.enemies.length = 0;
    const wave = b.wave;
    b.step();
    b.drain();
    if (b.wave !== wave) starts.push(b.time);
    for (const e of b.enemies) if (!seen.has(e.id) && seen.add(e.id)) kinds.push(e.kind);
  }
  return { b, kinds, starts };
}

describe('waves keep the field busy', () => {
  it('waits out the spawn window and the gap while the field is full', () => {
    const { starts } = run(ticks(W.spawnWindow + W.gap) + 2, false);
    expect(starts).toEqual([ticks(W.spawnWindow + W.gap)]);
  });

  it(`brings the next rush and the next wave in once ${W.callAt} or fewer are left`, () => {
    const { b, starts } = run(ticks(W.spawnWindow), true);
    // every wave's spawns come one after the other, and the next wave right after its last
    expect(b.wave).toBeGreaterThan(3);
    expect(starts[0]).toBeLessThan(ticks(W.horde.rushes[W.horde.rushes.length - 1]));
  });

  it('sends the same enemies in the same order, only sooner', () => {
    const slow = run(ticks(4 * (W.spawnWindow + W.gap)), false).kinds;
    const fast = run(ticks(4 * (W.spawnWindow + W.gap)), true).kinds;
    expect(fast.slice(0, slow.length)).toEqual(slow);
  });
});
