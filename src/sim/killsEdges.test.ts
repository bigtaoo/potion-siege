// The edges of the dead taken off (kills.ts): the gold and count each one adds, what makes one
// die burnt, rusted, frozen or only chilled, and how far each burst reaches. Pinned by mutation testing (ref/mutation-sim.md).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { RESIST } from './enemies';
import { reapDead } from './kills';
import { BASE_SETUP, battleSetup, newMeta } from './meta';
import { FP, ticks, toFp } from './math/fixed';
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

/** An enemy at (x, y) with `hp` hit points, all in world units. */
function enemy(b: Battle, x: number, y: number, hp: number): Enemy {
  [x, y, hp] = [toFp(x), toFp(y), toFp(hp)];
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind: 'grunt', x, y, px: x, py: y, hp, maxHp: hp, speed: 0, radius: toFp(30),
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

/** One that has just died at (500, 600), with 100 hit points at full. */
function victim(b: Battle): Enemy {
  const e = enemy(b, 500, 600, 100);
  e.hp = 0;
  return e;
}

const u = (v: number) => v / FP;

describe('the kill pay', () => {
  it('pays its kind\'s gold plus the skill\'s, times the challenge\'s rate, and counts each one', () => {
    const modifiers = { enemySpeed: 1, summonCost: 1, waveGold: 1, killGold: 3, crit: 0, bossWaves: BALANCE.waves.bossWaves, banned: [] };
    const b = new Battle(1, { ...BASE_SETUP, modifiers });
    b.enemies = [];
    (b.mods as { goldPerKill: number }).goldPerKill = 2;
    const [g, k] = [b.gold, b.kills];
    victim(b);
    victim(b);
    reapDead(b);
    expect(b.gold - g).toBe(2 * (BALANCE.enemies.grunt.gold + 2) * 3);
    expect(b.kills - k).toBe(2);

    const plain = new Battle(1, { ...BASE_SETUP, modifiers: undefined });
    plain.enemies = [];
    const p = plain.gold;
    victim(plain);
    reapDead(plain);
    expect(plain.gold - p).toBe(BALANCE.enemies.grunt.gold);
  });
});

describe('the fire chain', () => {
  it('bursts only from one still burning, and only around it', () => {
    const b = withSkills(['fireChain']);
    const cold = victim(b);
    cold.scorch = toFp(100); // a scorch that has worn off
    const near = enemy(b, 560, 600, 1e6);
    reapDead(b);
    expect(near.hp).toBe(toFp(1e6));

    const hot = withSkills(['fireChain']);
    const v = victim(hot);
    v.scorch = toFp(100);
    v.scorchTime = ticks(1);
    const close = enemy(hot, 560, 600, 1e6);
    const far = enemy(hot, 1500, 600, 1e6);
    reapDead(hot);
    expect(close.hp).toBeLessThan(toFp(1e6));
    expect(far.hp).toBe(toFp(1e6));
  });
});

describe('the melt', () => {
  it('needs the skill', () => {
    const b = withSkills([]);
    victim(b).rust = 3;
    const near = enemy(b, 560, 600, 1e6);
    reapDead(b);
    expect(near.rust).toBe(0);
  });

  it('spreads only rust there was, only close by, half of it onto an ornithopter', () => {
    const clean = withSkills(['poisonMelt']);
    victim(clean);
    const n = enemy(clean, 560, 600, 1e6);
    reapDead(clean);
    expect(n.rust).toBe(0);

    const b = withSkills(['poisonMelt']);
    victim(b).rust = 3;
    const near = enemy(b, 560, 600, 1e6);
    const flyer = enemy(b, 440, 600, 1e6);
    flyer.kind = 'flyer';
    const far = enemy(b, 1500, 600, 1e6);
    reapDead(b);
    expect(near.rust).toBe(3);
    expect(flyer.rust).toBe(Math.ceil(3 * BALANCE.flyer.splash));
    expect(far.rust).toBe(0);
  });
});

describe('the shatter', () => {
  it('needs one frozen or chilled', () => {
    const b = withSkills(['iceShatter']);
    victim(b);
    const near = enemy(b, 560, 600, 1e6);
    reapDead(b);
    expect(near.hp).toBe(toFp(1e6));
  });

  it('cuts with fewer shards that do not chill from one only chilled', () => {
    const b = withSkills(['iceShatter']);
    victim(b).slowTime = ticks(1);
    const near = enemy(b, 560, 600, 1e6);
    reapDead(b);
    expect(1e6 - u(near.hp)).toBeCloseTo(100 * S.shatterChill);
    expect(near.slowTime).toBe(0);
  });
});
