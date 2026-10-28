// The edges of an enemy's tick (enemyTick.ts): whirlwinds and poison wearing off, a frozen one
// standing still, a winder's key, the tripod's jar coming back only when it is down, and the
// anvil's slam at the wall. Pinned by mutation testing (ref/mutation-sim.md).

import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { stepEnemies } from './enemyTick';
import { ticks, toFp } from './math/fixed';
import { BALANCE, type Enemy, type EnemyKind } from './types';

/** An enemy at (500, 600), world units, moving at `speed` world units a tick. */
function enemy(b: Battle, kind: EnemyKind = 'grunt', speed = 0): Enemy {
  const [x, y] = [toFp(500), toFp(600)];
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind, x, y, px: x, py: y, hp: toFp(1e6), maxHp: toFp(1e6), speed: toFp(speed), radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
    markTime: 0, chill: 0, chillTime: 0, brittleTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000, heft: 1000,
  };
  b.enemies.push(e);
  return e;
}

function field(): Battle {
  const b = new Battle(1);
  b.enemies = [];
  return b;
}

describe('enemy tick edges', () => {
  it('lets a whirlwind blow out on its last tick', () => {
    const b = field();
    b.vortices.push({ x: toFp(500), y: toFp(300), time: 2 });
    stepEnemies(b);
    expect(b.vortices).toHaveLength(1);
    stepEnemies(b);
    expect(b.vortices).toHaveLength(0);
  });

  it('wears the poison off on its last tick', () => {
    const b = field();
    const e = enemy(b);
    e.poisonDps = toFp(10);
    e.poisonTime = 2;
    stepEnemies(b);
    expect(e.poisonDps).toBe(toFp(10));
    stepEnemies(b);
    expect(e.poisonDps).toBe(0);
  });

  it('keeps a frozen one where it is while the freeze thaws', () => {
    const b = field();
    const e = enemy(b, 'grunt', 5);
    e.freezeTime = 3;
    stepEnemies(b);
    expect(e.y).toBe(toFp(600));
    expect(e.freezeTime).toBe(2);
  });

  it('turns a winder\'s key one tick a step', () => {
    const b = field();
    const e = enemy(b, 'winder');
    e.windTime = 10;
    stepEnemies(b);
    expect(e.windTime).toBe(9);
  });

  it('leaves the tripod\'s jar alone while it is up', () => {
    const b = field();
    const e = enemy(b, 'tripod');
    e.shield = toFp(5);
    e.shieldMax = toFp(100);
    e.shieldTime = 1;
    stepEnemies(b);
    expect(e.shield).toBe(toFp(5));
    expect(e.shieldTime).toBe(1);
  });

  it('counts the anvil down to its slam at the wall', () => {
    const b = field();
    const e = enemy(b, 'anvil');
    e.y = b.wallFront(e.x) - e.radius;
    e.atWall = true;
    e.hopTime = 5;
    stepEnemies(b);
    expect(e.hopTime).toBe(4);
    e.hopTime = 1;
    stepEnemies(b);
    expect(e.hopTime).toBe(ticks(BALANCE.bosses.anvil.slamEvery));
  });
});
