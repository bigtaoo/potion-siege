// Shared by the balance guard (scripts/guard/*.test.ts, scripts/vitest.guard.config.js): the
// saves the balance suites play, bought the same way, so the guard pins the curves they print.
import { expect } from 'vitest';
import { Battle } from '../../src/sim/battle';
import { TICK_RATE } from '../../src/sim/math/fixed';
import { buyHero, buyWorkshop, heroCost, newMeta, workshopCost, type BattleSetup, type MetaSave, type WorkshopId } from '../../src/sim/meta';
import { LINEUP, type HeroKind } from '../../src/sim/types';

/** Crystals spent when the median player first tries each stage, as in late-game.test.ts and
 *  chapter-curve.test.ts (from 21 on the regular player's, 7.2% more a stage). */
export const ARRIVE = [0, 0, 290, 560, 865, 1195, 1555, 2330, 2830, 3550, 4755, 5545, 6665, 8250, 10095, 12700, 15380, 20305, 24385, 29600, 35500];
while (ARRIVE.length < 52) ARRIVE.push(Math.round((25875 * 1.072 ** (ARRIVE.length - 21)) / 5) * 5);

/** A save that has spent (up to) `budget` crystals on the fielded four and the workshop,
 *  cheapest first (heroes first on a tie), as every balance suite buys. */
export function saveFor(budget: number, lineup: readonly HeroKind[] = LINEUP): MetaSave {
  const m = newMeta();
  m.lineup = [...lineup];
  m.unlocked = lineup.filter((k) => !LINEUP.includes(k));
  m.crystals = budget;
  for (;;) {
    let best: { cost: number; buy: () => boolean } | null = null;
    for (const k of m.lineup) {
      const c = heroCost(m.heroes[k]);
      if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyHero(m, k) };
    }
    for (const id of ['wall', 'startGold', 'crystals'] as WorkshopId[]) {
      const c = workshopCost(id, m.workshop[id]);
      if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyWorkshop(m, id) };
    }
    if (!best || m.crystals < best.cost || !best.buy()) break;
  }
  m.crystals = 0;
  return m;
}

/** Plays one battle with `act` each tick; per wave w (0-based) the wall share left as wave w+2
 *  starts (or at the end). */
export function play(seed: number, setup: BattleSetup, act: (b: Battle) => void, maxSeconds = 1200) {
  const b = new Battle(seed, setup);
  const wall: number[] = [];
  let wave = b.wave;
  for (let t = 0; t < maxSeconds * TICK_RATE && b.result === null; t++) {
    act(b);
    b.step();
    b.drain();
    if (b.wave !== wave || b.result !== null) {
      wall[wave - 1] = Math.max(0, b.wall) / b.wallMax;
      wave = b.wave;
    }
  }
  return { b, wall };
}

export const winRate = (bs: { result: string | null }[]) => bs.filter((b) => b.result === 'won').length / bs.length;
export const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
export const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];

/** Prints `measured` beside `pinned` and fails on every entry more than `tol` away from its pin.
 *  The pins are what the guard measured on a344dc7: when a change moves a curve on purpose,
 *  copy the printed numbers over the pins in the same commit. */
export function expectNear(title: string, measured: Record<string, number>, pinned: Record<string, number>, tol: number): void {
  const round = (x: number) => Math.round(x * 10) / 10;
  console.log(`${title} (±${tol}):\n${Object.keys(measured).map((k) => `  ${k}: ${round(measured[k])} (pin ${pinned[k]})`).join('\n')}`);
  expect(Object.keys(measured)).toEqual(Object.keys(pinned));
  const off = Object.keys(pinned).filter((k) => !(Math.abs(measured[k] - pinned[k]) <= tol)).map((k) => `${k}: ${round(measured[k])}, pinned ${pinned[k]} ±${tol}`);
  expect(off, `${title} moved`).toEqual([]);
}
