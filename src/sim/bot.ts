// A simple player for balance runs and ?autoplay: buys an upgrade when the grid is full or
// gold piles up, otherwise summons, merges the highest pair it finds and takes the first skill.

import { Battle, SLOT_COUNT } from './battle';
import { TICK_RATE } from './math/fixed';
import type { BattleSetup } from './meta';

export function botAct(b: Battle): void {
  if (b.choices) {
    b.choose(b.choices[0]);
    return;
  }
  if (b.canUpgrade() && (b.freeSlots().length === 0 || b.gold >= b.upgradeCost() + b.summonCost())) {
    b.upgrade();
    return;
  }
  while (b.summon()) {
    /* spend all the gold */
  }
  let best: [number, number] | null = null;
  for (let i = 0; i < SLOT_COUNT; i++) {
    for (let j = i + 1; j < SLOT_COUNT; j++) {
      if (b.canMerge(i, j) && (!best || b.slots[i]!.star > b.slots[best[0]]!.star)) best = [i, j];
    }
  }
  if (best && b.freeSlots().length === 0) b.move(best[0], best[1]);
  else if (best && b.slots[best[0]]!.star >= 2) b.move(best[0], best[1]);
}

/** Plays a whole battle headless, the bot acting once a tick; returns the battle at its end. */
export function playOut(seed: number, maxSeconds = 1200, setup?: BattleSetup): Battle {
  const b = new Battle(seed, setup);
  for (let t = 0; t < maxSeconds * TICK_RATE && b.result === null; t++) {
    botAct(b);
    b.step();
    b.drain();
  }
  return b;
}
