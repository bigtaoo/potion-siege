// A simple player for balance runs and ?autoplay: buys an upgrade when the grid is full or
// gold piles up, otherwise summons, merges the highest pair it finds and takes the first skill.

import { Battle, SLOT_COUNT } from './battle';
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

/** Plays a whole battle headless at a fixed step; returns the battle at its end. */
export function playOut(seed: number, dt = 1 / 30, maxSeconds = 1200, setup?: BattleSetup): Battle {
  const b = new Battle(seed, setup);
  for (let t = 0; t < maxSeconds && b.result === null; t += dt) {
    botAct(b);
    b.step(dt);
    b.drain();
  }
  return b;
}
