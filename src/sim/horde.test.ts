import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { FP, ticks, toFp } from './math/fixed';
import { Prng } from './math/prng';
import { BALANCE, type Enemy, type HeroKind, type Projectile } from './types';
import { isHordeWave } from './horde';
import { planWave, type Spawn } from './waves';

const H = BALANCE.waves.horde;
const F = BALANCE.field;

/** A grunt of the horde (a quarter of the weight) standing still at (x, y), world units. */
function crowd(b: Battle, x: number, y: number, hp: number, heft = 250): Enemy {
  [x, y, hp] = [toFp(x), toFp(y), toFp(hp)];
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind: 'grunt', x, y, px: x, py: y, hp, maxHp: hp, speed: 0, radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
    markTime: 0, chill: 0, chillTime: 0, brittleTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: heft, heft,
  };
  b.enemies.push(e);
  return e;
}

function shot(kind: HeroKind, target: Enemy, damage: number): Projectile {
  const { x, y } = target;
  return { id: 1, kind, star: 1, x, y, px: x, py: y, targetId: target.id, tx: x, ty: y, damage: toFp(damage) };
}

function quiet(b: Battle): void {
  (b as unknown as { pending: Spawn[] }).pending = [];
  b.enemies = [];
}

describe('the horde (wave 1)', () => {
  it('is the first wave only, endless included', () => {
    expect(isHordeWave(1)).toBe(true);
    expect(isHordeWave(2)).toBe(false);
    expect(planWave(1, new Prng(3), 30, undefined, true).every((s) => s.heft === 250)).toBe(true);
  });

  it('comes as a crowd of light grunts in rushes, a few ranks deep, across the field', () => {
    for (const stage of [1, 7, 23]) {
      for (let seed = 1; seed <= 20; seed++) {
        const plan = planWave(1, new Prng(seed), stage);
        expect(plan.length).toBeGreaterThanOrEqual(50);
        const times = H.rushes.map(ticks);
        for (const s of plan) {
          expect(times).toContain(s.at);
          expect([s.heft, s.gold, s.size]).toEqual([250, 250, 800]);
          expect(s.lane!.x1).toBeGreaterThan(s.lane!.x0);
          expect(s.lane!.x0).toBeGreaterThan(F.left - 50);
          expect(s.lane!.x1).toBeLessThan(F.right + 50);
          expect(s.lane!.back % H.rowGap).toBe(0);
        }
        for (const at of times) {
          const rush = plan.filter((s) => s.at === at);
          expect(rush.length).toBeGreaterThanOrEqual(15);
          expect(rush.length).toBeLessThanOrEqual(20);
          // the front rank spans the field from edge to edge
          const front = rush.filter((s) => s.lane!.back === 0);
          expect(Math.min(...front.map((s) => s.lane!.x0))).toBeLessThan(F.left + 50);
          expect(Math.max(...front.map((s) => s.lane!.x1))).toBeGreaterThan(F.right - 50);
        }
      }
    }
  });

  it('pays the gold the wave did as the smaller crowd before it, with horde.hp of its hit points', () => {
    const totals = (crowdOf1: number, hpOf1: number) => {
      const keep = [BALANCE.waves.earlyCrowd[0], H.hp];
      [BALANCE.waves.earlyCrowd[0], H.hp] = [crowdOf1, hpOf1];
      let hp = 0, gold = 0;
      for (let seed = 1; seed <= 40; seed++) {
        for (const s of planWave(1, new Prng(seed), 1)) [hp, gold] = [hp + s.hp, gold + (s.gold ?? 1000)];
      }
      [BALANCE.waves.earlyCrowd[0], H.hp] = keep;
      return { hp, gold };
    };
    const now = totals(BALANCE.waves.earlyCrowd[0], H.hp);
    const before = totals(1.8, 1);
    expect(now.hp / before.hp).toBeCloseTo(H.hp, 1);
    expect(now.gold / before.gold).toBeCloseTo(1, 1);
  });

  it('leaves the later waves as they were', () => {
    // past the first chapter, where firstCrowd (firstCrowd.test.ts) makes the crowd lighter too
    for (const s of planWave(2, new Prng(4), BALANCE.waves.earlyHpTo + 1)) expect([s.heft, s.size, s.lane]).toEqual([undefined, undefined, undefined]);
  });

  it('comes in small, behind the top edge by its rank, inside its lane', () => {
    const b = new Battle(5);
    quiet(b);
    const lane = { x0: 400, x1: 520, back: 160 };
    (b as unknown as { pending: Spawn[] }).pending = [{ kind: 'grunt', at: 0, hp: 10_000, heft: 250, size: 800, lane }];
    b.step();
    const e = b.enemies[0];
    expect(e.radius).toBe(toFp(BALANCE.enemies.grunt.radius * 0.8));
    expect(e.x).toBeGreaterThanOrEqual(toFp(400));
    expect(e.x).toBeLessThanOrEqual(toFp(520));
    expect(e.y).toBeLessThan(toFp(F.top - 160));
    expect(e.heft).toBe(250);
  });

  it('bites the wall a quarter as hard', () => {
    const bite = (heft: number) => {
      const b = new Battle(5);
      quiet(b);
      const e = crowd(b, 500, 1500, 1e6, heft);
      e.atWall = true;
      const before = b.wall;
      b.step();
      return before - b.wall;
    };
    expect(bite(1000)).toBeGreaterThan(0);
    expect(bite(250)).toBe(Math.round(bite(1000) / 4));
  });

  it('charges the commander for the horde as for the smaller crowd it was', () => {
    // a quarter of a body each, times horde.charge (1.8, the crowd before): 0.45 a kill
    const b = new Battle(5);
    quiet(b);
    for (let i = 0; i < 8; i++) {
      const e = crowd(b, 300 + i * 60, 400, 1);
      b.projectiles.push(shot('arcane', e, 10));
      b.step();
      expect(b.charge).toBe(Math.floor(((i + 1) * 250 * H.charge) / 1000));
    }
  });

  it('sets off one fire chain blast for every four of the horde burnt to death', () => {
    const b = new Battle(1);
    quiet(b);
    b.choices = ['fireChain'];
    b.choose('fireChain');
    const near = crowd(b, 560, 600, 1e6, 1000);
    let blasts = 0;
    for (let i = 0; i < 8; i++) {
      const victim = crowd(b, 500, 600, 50);
      const before = near.hp;
      b.projectiles.push(shot('fire', victim, 100));
      b.step();
      expect(b.enemies).not.toContain(victim);
      // the shot's own splash is 100; a chain blast adds on top
      if ((before - near.hp) / FP > 100.5) blasts++;
    }
    expect(blasts).toBe(2);
  });
});
