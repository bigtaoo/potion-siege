// Damage as damage.ts deals it: each potion credited with what it took (overkill and the
// commander's flask left out), and the rust stacking, wearing off and adding to every hit.

import { describe, expect, it } from 'vitest';
import { Battle, WALL_ROW } from './battle';
import { FP, TICK_RATE, ticks, toFp } from './math/fixed';
import { BALANCE, type Enemy, HERO_KINDS, type HeroKind, LINEUP, type Projectile } from './types';
import type { Spawn } from './waves';

/** The first cell of the wall row, open from the start. */
const W = WALL_ROW * BALANCE.grid.cols;

/** A grunt standing still at (x, y) with `hp` hit points, all in world units. */
function grunt(id: number, x: number, y: number, hp: number): Enemy {
  [x, y, hp] = [toFp(x), toFp(y), toFp(hp)];
  return {
    id, kind: 'grunt', x, y, px: x, py: y, hp, maxHp: hp, speed: 0, radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
    markTime: 0, chill: 0, chillTime: 0, brittleTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000, heft: 1000,
  };
}

/** A shot of `kind` already on `target` (`damage` in world units), landing on the next tick. */
function shot(kind: HeroKind, target: Enemy, damage: number): Projectile {
  const { x, y } = target;
  return { id: 1, kind, star: 1, x, y, px: x, py: y, targetId: target.id, tx: x, ty: y, damage: toFp(damage) };
}

/** Hit points back in world units. */
const u = (v: number) => v / FP;
describe('damage dealt', () => {
  /** No waves, so only the test's own shots land. */
  function quiet(): Battle {
    const b = new Battle(5);
    b.enemies = [];
    return b;
  }

  function enemy(b: Battle, x: number, y: number, hp: number): Enemy {
    const e = grunt(9000 + b.enemies.length, x, y, hp);
    b.enemies.push(e);
    return e;
  }

  /** A projectile of `kind` already on `target`, landing on the next step. */
  function hit(b: Battle, kind: HeroKind, target: Enemy, damage: number): void {
    b.projectiles.push(shot(kind, target, damage));
    b.step();
  }

  it('credits the fire splash on every enemy it reaches', () => {
    const b = quiet();
    const a = enemy(b, 500, 400, 1000);
    enemy(b, 540, 400, 1000);
    hit(b, 'fire', a, 100);
    expect(u(b.dealt.fire)).toBeCloseTo(200);
  });

  it('credits poison with its ticks', () => {
    const b = quiet();
    const e = enemy(b, 500, 400, 1e6);
    hit(b, 'poison', e, 10);
    for (let i = 0; i < TICK_RATE; i++) b.step();
    expect(u(b.dealt.poison)).toBeGreaterThan(10 + BALANCE.heroes.poison.poisonDps * 0.9);
  });

  it('credits lightning with its chain jumps', () => {
    const b = quiet();
    const a = enemy(b, 500, 400, 1e6);
    enemy(b, 560, 400, 1e6);
    enemy(b, 620, 400, 1e6);
    hit(b, 'lightning', a, 100);
    expect(u(b.dealt.lightning)).toBeGreaterThan(100 + 100 * BALANCE.heroes.lightning.chainFalloff * 0.99);
  });

  it('leaves out overkill and the commander', () => {
    const b = quiet();
    hit(b, 'arcane', enemy(b, 500, 400, 10), 1000);
    expect(u(b.dealt.arcane)).toBeCloseTo(10);
    enemy(b, 500, 400, 1e6);
    b.charge = BALANCE.commander.charge;
    expect(b.cast()).toBe(true);
    for (let i = 0; i < 60; i++) b.step();
    expect(HERO_KINDS.reduce((a, k) => a + b.dealt[k], 0)).toBe(b.dealt.arcane);
    expect(u(b.dealt.arcane)).toBeCloseTo(10);
  });

  it('never credits more than the enemies lost', () => {
    const b = new Battle(11);
    LINEUP.forEach((kind, i) => (b.slots[W + i] = { id: 500 + i, kind, star: 3, slot: W + i, cooldown: 0 }));
    const credited = () => HERO_KINDS.reduce((a, k) => a + b.dealt[k], 0);
    let lost = 0;
    // an enemy can come in and die in the same step (a splash already in flight), so what
    // spawns counts too: the hit points that left the wave plan less those still standing
    const pending = () => (b as unknown as { pending: Spawn[] }).pending;
    for (let i = 0; i < 900 && !b.paused && !b.result; i++) {
      const before = new Map(b.enemies.map((e) => [e.id, Math.max(0, e.hp)]));
      const planned = new Set(pending());
      b.step();
      const after = new Map(b.enemies.map((e) => [e.id, Math.max(0, e.hp)]));
      for (const [id, hp] of before) lost += hp - (after.get(id) ?? 0);
      const left = new Set(pending());
      for (const s of planned) if (!left.has(s)) lost += s.hp;
      for (const e of b.enemies) if (!before.has(e.id)) lost -= Math.max(0, e.hp);
    }
    expect(credited()).toBeGreaterThan(0);
    expect(credited()).toBeLessThanOrEqual(lost);
  });
});

describe('rust', () => {
  const P = BALANCE.heroes.poison;

  function rig(): { b: Battle; e: Enemy } {
    const b = new Battle(5);
    b.enemies = [];
    const e = grunt(9000, 500, 400, 1e6);
    b.enemies.push(e);
    return { b, e };
  }

  function shoot(b: Battle, kind: HeroKind, e: Enemy, damage: number): void {
    b.projectiles.push(shot(kind, e, damage));
    b.step();
  }

  it('stacks one rust per corrosion hit up to the cap', () => {
    const { b, e } = rig();
    for (let i = 1; i <= P.rustMax + 2; i++) {
      shoot(b, 'poison', e, 1);
      expect(e.rust).toBe(Math.min(i, P.rustMax));
    }
  });

  it('wears off once the corrosion stops', () => {
    const { b, e } = rig();
    shoot(b, 'poison', e, 1);
    for (let i = 0; i < ticks(P.rustTime + 0.5); i++) b.step();
    expect(e.rust).toBe(0);
  });

  it('makes every hit land harder, on top of the arcane mark', () => {
    const { b, e } = rig();
    e.rust = 3;
    e.rustTime = ticks(99);
    let before = e.hp;
    shoot(b, 'arcane', e, 100);
    expect(u(before - e.hp)).toBeCloseTo(100 * (1 + P.rustStep * 3));
    // one Arcane Mark level, taken as an offered skill
    b.choices = ['arcaneMark'];
    b.choose('arcaneMark');
    e.markTime = ticks(99);
    before = e.hp;
    shoot(b, 'arcane', e, 100);
    expect(u(before - e.hp)).toBeCloseTo(100 * (1 + BALANCE.skills.arcaneMark) * (1 + P.rustStep * 3));
  });
});
