// Each potion's pick of target (targetPick.ts): its preference, the fall back to the front one,
// the enemy at the wall first, and stable picks on ties.

import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { FP, toFp } from './math/fixed';
import { stepHeroes } from './shots';
import { TargetPick } from './targetPick';
import { BALANCE, type Enemy, type EnemyKind, type HeroKind } from './types';

/** An enemy at (x, y), world units, of `kind`, moving at `speed` world units a tick. */
function enemy(b: Battle, x: number, y: number, kind: EnemyKind = 'grunt', speed = 1): Enemy {
  [x, y] = [toFp(x), toFp(y)];
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind, x, y, px: x, py: y, hp: toFp(100), maxHp: toFp(100), speed: toFp(speed), radius: toFp(30),
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

const pick = (b: Battle, kind: HeroKind) => new TargetPick(b).pick(kind);
/** A y well clear of the wall and of the top edge. */
const MID = 700;

describe('target picks', () => {
  it('sends arcane at the front and wind at what flies or winds', () => {
    const b = field();
    const front = enemy(b, 500, MID + 100);
    const flyer = enemy(b, 300, MID, 'flyer');
    expect(pick(b, 'arcane')).toBe(front);
    expect(pick(b, 'wind')).toBe(flyer);
  });

  it('sends fire at the thickest crowd, not the lone front one', () => {
    const b = field();
    const lone = enemy(b, 200, MID + 200);
    enemy(b, 700, MID);
    const middle = enemy(b, 740, MID + 10);
    enemy(b, 780, MID);
    expect(pick(b, 'fire')).toBe(middle);
    b.enemies = [lone];
    expect(pick(b, 'fire')).toBe(lone);
  });

  it('sends ice at the fastest one not slowed yet, then the next potion elsewhere', () => {
    const b = field();
    const front = enemy(b, 500, MID + 100, 'grunt', 1);
    const runner = enemy(b, 300, MID, 'runner', 3);
    const p = new TargetPick(b);
    expect(p.pick('ice')).toBe(runner);
    expect(p.pick('ice')).toBe(front);
    runner.slowTime = 5;
    front.freezeTime = 5;
    expect(pick(b, 'ice')).toBe(front);
  });

  it('sends poison at the front-most one not poisoned yet', () => {
    const b = field();
    const front = enemy(b, 500, MID + 100);
    const behind = enemy(b, 300, MID);
    expect(pick(b, 'poison')).toBe(front);
    front.poisonTime = 10;
    expect(pick(b, 'poison')).toBe(behind);
    behind.poisonTime = 10;
    expect(pick(b, 'poison')).toBe(front);
  });

  it('sends lightning where the chain jumps on the furthest', () => {
    const b = field();
    enemy(b, 100, MID + 200);
    const pack = enemy(b, 600, MID);
    const r = BALANCE.heroes.lightning.chainRange;
    enemy(b, 600 + r * 0.5, MID - 20);
    enemy(b, 600 + r * 0.5, MID - 20 - r * 0.5);
    expect(pick(b, 'lightning')).toBe(pack);
  });

  it('keeps every potion but the wind on an enemy at the wall', () => {
    const b = field();
    const wall = b.wallFront(toFp(500)) / FP;
    const near = enemy(b, 500, wall - 30 - BALANCE.targeting.wallNear / 2);
    enemy(b, 300, MID, 'flyer', 3);
    enemy(b, 320, MID);
    enemy(b, 340, MID);
    for (const k of ['arcane', 'fire', 'ice', 'lightning', 'poison'] as const) expect(pick(b, k), k).toBe(near);
    expect(pick(b, 'wind')).not.toBe(near);
  });

  it('looks past enemies still behind the top edge', () => {
    const b = field();
    const seen = enemy(b, 500, MID);
    enemy(b, 300, BALANCE.field.top - 100, 'runner', 3);
    expect(pick(b, 'ice')).toBe(seen);
  });

  it('breaks ties by the order the enemies came on', () => {
    const b = field();
    const first = enemy(b, 300, MID, 'runner', 3);
    enemy(b, 700, MID, 'runner', 3);
    expect(pick(b, 'ice')).toBe(first);
    expect(pick(b, 'poison')).toBe(first);
    expect(pick(b, 'fire')).toBe(first);
  });

  it('throws each potion of the grid at its own pick', () => {
    const b = field();
    enemy(b, 500, MID + 100);
    const runner = enemy(b, 300, MID, 'runner', 3);
    b.slots.fill(null);
    b.slots[0] = { id: 1, kind: 'ice', star: 1, slot: 0, cooldown: 0 };
    stepHeroes(b);
    expect(b.projectiles.map((p) => p.targetId)).toEqual([runner.id]);
  });
});
