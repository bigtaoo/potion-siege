// A field for the reaction tests: a battle with nothing on it but the enemies the test puts there.

import { Battle } from './battle';
import { toFp } from './math/fixed';
import { battleSetup, newMeta } from './meta';
import type { BattleSetup } from './meta';
import type { Enemy } from './types';

/** A battle with no enemies and no waves: only the test's own. */
export function still(setup: BattleSetup = battleSetup(newMeta())): Battle {
  const b = new Battle(1, setup);
  b.enemies = [];
  b['pending'] = [];
  return b;
}

/** An enemy at (x, y) with `hp` hit points, all in world units. */
export function enemy(b: Battle, x: number, y: number, hp = 1000): Enemy {
  [x, y, hp] = [toFp(x), toFp(y), toFp(hp)];
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind: 'grunt', x, y, px: x, py: y, hp, maxHp: hp, speed: 0, radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
      markTime: 0, chill: 0, chillTime: 0, brittleTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000, heft: 1000,
  };
  b.enemies.push(e);
  return e;
}

