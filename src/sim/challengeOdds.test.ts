// The daily challenge stays winnable under every day it can roll: on the earliest save that can
// open it (two stages cleared), the bot wins some of each modifier and each pair, and no single
// modifier drops below half the plain challenge's wins. Swift at 1.3 fell to a third (30% to
// plain's 85% over twenty seeds); a guard here keeps a new modifier from doing the same.
import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { botAct } from './bot';
import { challengeSetup, type ModifierId } from './challenge';
import { challengeFor, modifierSets, SAVES } from './setupCatalog';

const CAP = 1200 * 30;
const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);
const PAIR_SEEDS = SEEDS.slice(0, 5);

/** How many of the seeds the bot wins under these modifiers. */
function wins(mods: ModifierId[], seeds: number[]): number {
  const m = SAVES.fresh();
  return seeds.filter((seed) => {
    const b = new Battle(seed, challengeSetup(m, challengeFor(m, mods, seed)));
    for (let t = 0; t < CAP && b.result === null; t++) {
      botAct(b);
      b.step();
      b.drain();
    }
    return b.result === 'won';
  }).length;
}

describe('challenge odds', () => {
  it('no single modifier halves the wins', () => {
    const plain = wins([], SEEDS);
    const low = modifierSets(1)
      .map((mods) => ({ mods: mods.join('+'), won: wins(mods, SEEDS) }))
      .filter((r) => r.won * 2 < plain);
    expect(low, `plain wins ${plain}/${SEEDS.length}`).toEqual([]);
  }, 120_000);

  it('every pair is won sometimes', () => {
    const never = modifierSets(2)
      .filter((mods) => wins(mods, PAIR_SEEDS) === 0)
      .map((mods) => mods.join('+'));
    expect(never).toEqual([]);
  }, 120_000);
});
