// The edges of the target picks (targetPick.ts): the lightning's chain count and how far down the
// front it looks, fire apart from lightning, ice passing over the frozen and the ones already
// aimed at, and the exact lines of the wall's reach and the top edge. Pinned by mutation testing
// (ref/mutation-sim.md).

import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { K } from './field';
import { toFp } from './math/fixed';
import { TargetPick } from './targetPick';
import { BALANCE, type Enemy, type HeroKind, type Projectile } from './types';

const B = BALANCE;

/** An enemy at (x, y), world units, moving at `speed` world units a tick. */
function enemy(b: Battle, x: number, y: number, speed = 1): Enemy {
  [x, y] = [toFp(x), toFp(y)];
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind: 'grunt', x, y, px: x, py: y, hp: toFp(100), maxHp: toFp(100), speed: toFp(speed), radius: toFp(30),
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

/** A row of `n` at y, each a chain hop (220, under the 260 range) right of the last, from x. */
function row(b: Battle, n: number, x: number, y: number): Enemy[] {
  return Array.from({ length: n }, (_, i) => enemy(b, x + 220 * i, y - i));
}

describe('the lightning\'s pick', () => {
  it('takes a chain of two over a pair in front, each hop to one not hit yet', () => {
    const b = field();
    row(b, 2, 100, 1000);
    const [three] = row(b, 3, 100, 600);
    expect(pick(b, 'lightning')).toBe(three);
  });

  it('takes a pair behind over a lone one in front, and the front pair of two', () => {
    const lone = field();
    enemy(lone, 100, 1000);
    const [pair] = row(lone, 2, 100, 600);
    expect(pick(lone, 'lightning')).toBe(pair);

    const two = field();
    const [front] = row(two, 2, 100, 1000);
    row(two, 2, 100, 600);
    expect(pick(two, 'lightning')).toBe(front);
  });

  it('counts the extra chains of the skill', () => {
    const b = field();
    (b.mods as { extraChains: number }).extraChains = 1;
    row(b, 3, 100, 1000);
    const [four] = row(b, 4, 100, 600);
    expect(pick(b, 'lightning')).toBe(four);
  });

  it('looks only at the first twelve down the front', () => {
    const b = field();
    // twelve alone, a step further apart than a hop, then a pair just inside the top edge
    for (const y of [1000, 720, 440]) for (const x of [100, 400, 700, 1000]) enemy(b, x, y);
    enemy(b, 100, 175);
    enemy(b, 110, 170);
    expect(pick(b, 'lightning')).toBe(b.enemies[0]);
  });

  it('chains only from ones on the field', () => {
    const b = field();
    const lone = enemy(b, 100, 1000);
    row(b, 3, 100, B.field.top - 100);
    expect(pick(b, 'lightning')).toBe(lone);
  });
});

describe('the fire\'s pick', () => {
  it('is the thickest crowd, not the lightning\'s longest chain', () => {
    const b = field();
    row(b, 3, 100, 1000);
    const crowd = [enemy(b, 600, 500), enemy(b, 620, 500), enemy(b, 600, 520), enemy(b, 620, 520)];
    expect(pick(b, 'lightning')).toBe(b.enemies[0]);
    expect(crowd).toContain(pick(b, 'fire'));
  });

  it('counts no crowd behind the top edge', () => {
    const b = field();
    const lone = enemy(b, 100, 1000);
    for (const x of [600, 620, 640]) enemy(b, x, B.field.top - 100);
    expect(pick(b, 'fire')).toBe(lone);
  });
});

describe('the ice\'s pick', () => {
  it('passes over a frozen one', () => {
    const b = field();
    enemy(b, 300, 700, 5).freezeTime = 1;
    const next = enemy(b, 700, 700, 3);
    expect(pick(b, 'ice')).toBe(next);
  });

  it('passes over one an ice shot is already flying at, not one of another potion\'s', () => {
    const b = field();
    const fast = enemy(b, 300, 700, 5);
    const next = enemy(b, 700, 700, 3);
    b.projectiles.push({ kind: 'fire', targetId: fast.id } as Projectile);
    expect(pick(b, 'ice')).toBe(fast);
    b.projectiles.push({ kind: 'ice', targetId: fast.id } as Projectile);
    expect(pick(b, 'ice')).toBe(next);
  });

  it('sees one whose body has just reached the top edge', () => {
    const b = field();
    const slow = enemy(b, 700, 700, 1);
    const edge = enemy(b, 300, 0, 5);
    edge.y = K.top - edge.radius;
    expect(pick(b, 'ice')).toBe(edge);
    edge.y--;
    expect(pick(b, 'ice')).toBe(slow);
  });
});

describe('the wall\'s reach', () => {
  it('starts exactly a step short of the wall', () => {
    const b = field();
    const near = enemy(b, 500, 0, 1);
    const fast = enemy(b, 300, 700, 5);
    near.y = b.wallFront(near.x) - near.radius - toFp(B.targeting.wallNear);
    expect(pick(b, 'ice')).toBe(near);
    near.y--;
    expect(pick(b, 'ice')).toBe(fast);
  });
});
