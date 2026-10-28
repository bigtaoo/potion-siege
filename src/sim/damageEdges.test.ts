// The edges of how damage lands (damage.ts): what counts as chilled for superconduct, which static
// is still there to keep, a corrosion without poison, the brittleness a freeze never shortens,
// and the shards only a boss's shatter gives. Pinned by mutation testing (ref/mutation-sim.md).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { corrode, freeze, harm, shock } from './damage';
import { RESIST } from './enemies';
import { battleSetup, newMeta } from './meta';
import { FP, ticks, times, toFp } from './math/fixed';
import { type SkillId } from './skills';
import { BALANCE, type Enemy } from './types';

// Every potion lands in full on a grunt here; the resistances have tests of their own.
const gruntResist = RESIST.grunt;
beforeAll(() => {
  RESIST.grunt = {};
});
afterAll(() => {
  RESIST.grunt = gruntResist;
});

const S = BALANCE.skills;

/** An enemy at (500, 600) with `hp` hit points (world units). */
function enemy(b: Battle, hp = 1e6): Enemy {
  const [x, y] = [toFp(500), toFp(600)];
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind: 'grunt', x, y, px: x, py: y, hp: toFp(hp), maxHp: toFp(hp), speed: 0, radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
    markTime: 0, chill: 0, chillTime: 0, brittleTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000, heft: 1000,
  };
  b.enemies.push(e);
  return e;
}

/** A battle with no enemies and these skills taken. */
function withSkills(skills: SkillId[]): Battle {
  const b = new Battle(1, battleSetup(newMeta()));
  b.enemies = [];
  for (const id of skills) {
    b.choices = [id];
    b.choose(id);
  }
  return b;
}

const u = (v: number) => v / FP;

describe('damage edges', () => {
  it('gives superconduct nothing on one neither chilled nor frozen', () => {
    const b = withSkills(['iceLightning']);
    const e = enemy(b);
    shock(b, e, toFp(100));
    expect(u(e.hp)).toBeCloseTo(1e6 - 100);
  });

  it('keeps a stronger static only while it lasts', () => {
    const b = withSkills(['lightningStatic']);
    const live = enemy(b);
    live.charge = toFp(1000);
    live.chargeTime = ticks(1);
    shock(b, live, toFp(100));
    expect(live.charge).toBe(toFp(1000));
    const spent = enemy(b);
    spent.charge = toFp(1000);
    shock(b, spent, toFp(100));
    expect(u(spent.charge)).toBeCloseTo(100 * S.lightningStatic);
  });

  it('rusts without poisoning when the hit has no poison', () => {
    const b = withSkills([]);
    const e = enemy(b);
    corrode(b, e);
    expect(e.rust).toBe(1);
    expect(e.poisonTime).toBe(0);
  });

  it('never shortens a longer brittleness with a freeze, boss or not', () => {
    const b = withSkills([]);
    const e = enemy(b);
    const boss = enemy(b);
    boss.kind = 'boss';
    for (const one of [e, boss]) {
      one.brittleTime = ticks(30);
      freeze(b, one, 1, 0);
      expect(one.brittleTime).toBe(ticks(30));
    }
  });

  it('chips shards only off a boss, and only with shatter', () => {
    const b = withSkills(['iceShatter']);
    const flyer = enemy(b);
    flyer.kind = 'flyer';
    freeze(b, flyer, 1, toFp(100));
    expect(flyer.hp).toBe(toFp(1e6));
    const plain = withSkills([]);
    const boss = enemy(plain);
    boss.kind = 'boss';
    freeze(plain, boss, 1, toFp(100));
    expect(boss.hp).toBe(toFp(1e6));
  });

  it('marks the tripod\'s bell jar too', () => {
    const b = withSkills(['arcaneMark']);
    const tripod = enemy(b);
    tripod.kind = 'tripod';
    tripod.shield = toFp(1000);
    tripod.markTime = ticks(1);
    harm(b, tripod, toFp(100), 'fire');
    const into = times(times(toFp(100), BALANCE.bosses.tripod.other * 1000), 1000 + b.fixed.mark);
    expect(b.fixed.mark).toBeGreaterThan(0);
    expect(tripod.shield).toBe(toFp(1000) - into);
  });
});
