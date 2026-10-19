// The commander's skills (commander.ts): its charge from kills, the revive, the flask thrown into
// the thick of them and the brew in turn, the self-cast, and a tapped cast in the replay.

import { describe, expect, it } from 'vitest';
import { Battle, WALL_ROW } from './battle';
import { FP, ticks, toFp } from './math/fixed';
import { BALANCE, type Enemy, type HeroKind, type Projectile } from './types';
import type { Spawn } from './waves';

/** The first cell of the wall row, open from the start. */
const W = WALL_ROW * BALANCE.grid.cols;

/** A grunt standing still at (x, y) with `hp` hit points, all in world units. */
function grunt(id: number, x: number, y: number, hp: number): Enemy {
  [x, y, hp] = [toFp(x), toFp(y), toFp(hp)];
  return {
    id, kind: 'grunt', x, y, px: x, py: y, hp, maxHp: hp, speed: 0, radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
    markTime: 0, chill: 0, chillTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000, heft: 1000,
  };
}

/** A shot of `kind` already on `target` (`damage` in world units), landing on the next tick. */
function shot(kind: HeroKind, target: Enemy, damage: number): Projectile {
  const { x, y } = target;
  return { id: 1, kind, star: 1, x, y, px: x, py: y, targetId: target.id, tx: x, ty: y, damage: toFp(damage) };
}

/** Hit points back in world units. */
const u = (v: number) => v / FP;

describe('commander skills', () => {
  const C = BALANCE.commander;

  /** No waves, a full charge. */
  function charged(): Battle {
    const b = new Battle(5);
    (b as unknown as { pending: Spawn[] }).pending = [];
    b.enemies = [];
    b.charge = C.charge;
    return b;
  }

  it('charges one a kill and a boss more, up to full', () => {
    const b = new Battle(5);
    (b as unknown as { pending: Spawn[] }).pending = [];
    b.enemies = [grunt(1, 500, 400, 1)];
    b.projectiles.push(shot('arcane', b.enemies[0], 10));
    b.step();
    expect(b.charge).toBe(1);
    expect(b.canCast()).toBe(false);
    expect(b.cast()).toBe(false);
    const boss = grunt(2, 500, 400, 1);
    boss.kind = 'boss';
    b.enemies.push(boss);
    b.charge = C.charge - 2;
    b.projectiles.push(shot('arcane', boss, 10));
    b.step();
    expect(b.charge).toBe(C.charge);
  });

  it('comes back from the revive with the wall whole and the bomb ready', () => {
    const b = new Battle(5);
    (b as unknown as { pending: Spawn[] }).pending = [];
    const boss = grunt(2, 500, 400, 1e6);
    boss.kind = 'boss';
    b.enemies = [grunt(1, 300, 1900, 1e6), boss]; // the grunt at the wall
    b.charge = 3;
    b.wall = 1;
    for (let i = 0; i < 2000 && !b.result; i++) b.step();
    expect(b.result).toBe('lost');
    expect(b.revive()).toBe(true);
    expect(b.result).toBeNull();
    expect(b.wall).toBe(b.wallMax);
    expect(b.enemies.map((e) => e.kind)).toEqual(['boss']);
    expect(b.charge).toBe(C.charge);
    expect(b.canCast()).toBe(true);
  });

  it('throws the flask into the thick of them, then brews, in turn', () => {
    const b = charged();
    b.slots[W] = { id: 100, kind: 'arcane', star: 2, slot: W, cooldown: 1e9 };
    const lone = grunt(1, 200, 700, 1e6);
    const pack = [grunt(2, 700, 400, 1e6), grunt(3, 740, 420, 1e6), grunt(4, 680, 450, 1e6)];
    b.enemies.push(lone, ...pack);
    expect(b.nextCast).toBe('bomb');
    expect(b.cast()).toBe(true);
    expect(b.charge).toBe(0);
    const cast = b.drain().find((e) => e.type === 'cast');
    expect(cast).toMatchObject({ skill: 'bomb' });
    // nothing lands until the flask has flown
    b.step();
    expect(pack[0].hp).toBe(toFp(1e6));
    for (let i = 0; i < ticks(C.bomb.flight); i++) b.step();
    const H = BALANCE.heroes.arcane;
    const dps = (H.damage * BALANCE.starDamage[1] * BALANCE.starSpeed[1]) / H.interval;
    for (const e of pack) {
      expect(1e6 - u(e.hp)).toBeCloseTo(Math.max(C.bomb.min, dps * C.bomb.seconds), 0);
      expect(e.slowTime).toBeGreaterThan(0);
    }
    expect(lone.hp).toBe(toFp(1e6));

    b.charge = C.charge;
    expect(b.nextCast).toBe('brew');
    expect(b.cast()).toBe(true);
    expect(b.brewTime).toBe(ticks(C.brew.time));
    expect(b.nextCast).toBe('bomb');
  });

  it('throws faster while the brew lasts', () => {
    const shots = (brew: boolean): number => {
      const b = charged();
      b.slots[W] = { id: 100, kind: 'arcane', star: 1, slot: W, cooldown: 0 };
      b.enemies.push(grunt(1, 500, 400, 1e9));
      b.casts = 1;
      if (!brew) b.charge = 0;
      else expect(b.cast()).toBe(true);
      let n = 0;
      for (let i = 0; i < ticks(C.brew.time); i++) {
        b.step();
        n += b.drain().filter((e) => e.type === 'shot').length;
      }
      return n;
    };
    expect(shots(true) / shots(false)).toBeCloseTo(1 + C.brew.speed, 0);
    expect(shots(true)).toBeGreaterThan(shots(false));
  });

  it('casts by itself once the charge has waited, but only with something to throw at', () => {
    const b = charged();
    for (let i = 0; i < ticks(C.autoCast) + 5; i++) b.step();
    expect(b.casts).toBe(0);
    b.enemies.push(grunt(1, 500, 400, 1e6));
    b.step();
    expect(b.casts).toBe(1);
    expect(b.charge).toBe(0);
  });

  it('replays a tapped cast', () => {
    const b = charged();
    b.enemies.push(grunt(1, 500, 400, 1e6));
    b.cast();
    expect(b.commands[b.commands.length - 1]).toMatchObject({ type: 'cast' });
  });
});
