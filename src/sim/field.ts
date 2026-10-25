// The battle's ground, worked out once from the configuration: the grid's slots and where they
// stand, and the distances, speeds and timings the battle steps with, in its own units (FP,
// ticks, permille).

import { perTick, pm, TICK_RATE, toFp } from './math/fixed';
import { BRAD_FULL } from './math/trig';
import { BALANCE, type EnemyKind, type HeroKind } from './types';

const B = BALANCE;
const C = B.commander;
export const SLOT_COUNT = B.grid.cols * B.grid.rows;

/** A slot's centre in world units. */
export function slotCenter(slot: number): { x: number; y: number } {
  const g = B.grid;
  return { x: g.x0 + g.cellW * ((slot % g.cols) + 0.5), y: g.y0 + g.cellH * (Math.floor(slot / g.cols) + 0.5) };
}

/** The bottom row of the grid is the wall itself; the rows above are built onto it. */
export const WALL_ROW = B.grid.rows - 1;

/** Seconds as thousandths of a tick, the unit of the shot cooldowns. */
function cool(seconds: number): number {
  return Math.round(seconds * TICK_RATE * 1000);
}

/** World units to FP of the configuration, worked out once. */
export const K = {
  reach: perTick(B.projectileSpeed),
  left: toFp(B.field.left),
  right: toFp(B.field.right),
  top: toFp(B.field.top),
  x0: toFp(B.grid.x0),
  cellW: toFp(B.grid.cellW),
  summonCooldown: cool(0.2),
  idleCooldown: cool(0.07),
  bombRadius: toFp(C.bomb.radius),
  bombMin: toFp(C.bomb.min),
  /** How far down the road a crowd has to be for the flask to burst on it in plain view (below
   *  the HUD and the lesson's banner), and how far down it lands at most to show itself. */
  bombFloor: toFp(B.field.top + C.bomb.radius * 0.75),
  /** The brew's quickening in permille of the potions' own speed. */
  brew: 1000 + pm(C.brew.speed),
  /** Each hero kind's shot interval at each level. */
  interval: Object.fromEntries(Object.entries(B.heroes).map(([k, h]) => [k, B.starSpeed.map((s) => Math.round((h.interval * TICK_RATE * 1000) / s))])) as Record<HeroKind, number[]>,
  wallDps: Object.fromEntries(Object.entries(B.enemies).map(([k, e]) => [k, perTick(e.wallDps)])) as Record<EnemyKind, number>,
  weave: toFp(B.flyer.weave),
  /** The flyer's swing in brads a second, and the start of it per enemy id (2.399 radians). */
  weaveRate: Math.round((B.flyer.weaveRate * BRAD_FULL) / (2 * Math.PI)),
  weavePhase: Math.round((2.399 * BRAD_FULL) / (2 * Math.PI)),
  vortexPull: perTick(B.skills.vortexPull),
};
