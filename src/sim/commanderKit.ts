// What the commander's tests build on (commander, castPoint and spells tests): a still grunt where
// it is put, a battle with no waves and a full charge, and a potion on the wall to size the spells.

import { Battle, WALL_ROW } from './battle';
import { toFp } from './math/fixed';
import { BALANCE, type Enemy } from './types';
import type { Spawn } from './waves';

/** The first cell of the wall row, open from the start. */
export const W = WALL_ROW * BALANCE.grid.cols;

/** A grunt standing still at (x, y) with `hp` hit points, all in world units. */
export function grunt(id: number, x: number, y: number, hp: number): Enemy {
  [x, y, hp] = [toFp(x), toFp(y), toFp(hp)];
  return {
    id, kind: 'grunt', x, y, px: x, py: y, hp, maxHp: hp, speed: 0, radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
    markTime: 0, chill: 0, chillTime: 0, brittleTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000, heft: 1000,
  };
}

/** No waves, a full charge, and an arcane 2-star on the wall that never throws (so only the
 *  spells hurt anything). */
export function charged(): Battle {
  const b = new Battle(5);
  (b as unknown as { pending: Spawn[] }).pending = [];
  b.enemies = [];
  b.charge = BALANCE.commander.charge;
  b.slots[W] = { id: 100, kind: 'arcane', star: 2, slot: W, cooldown: 1e9 };
  return b;
}

/** What that arcane 2-star deals a second, in world units. */
export function arcaneDps(): number {
  const H = BALANCE.heroes.arcane;
  return (H.damage * BALANCE.starDamage[1] * BALANCE.starSpeed[1]) / H.interval;
}
