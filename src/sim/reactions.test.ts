// The potion reactions (reactions.ts): which pair sets off which, what each does, the element it
// uses up, the cooldown, and the counts and events a battle keeps of them.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { RESIST } from './enemies';
import { battleSetup, newMeta } from './meta';
import { FP, ticks, toFp } from './math/fixed';
import { elementsOn, react, reactionOf, wearReactions } from './reactions';
import { BALANCE, type Enemy } from './types';

const R = BALANCE.reactions;

// on a grunt that takes every potion in full, so the numbers read straight
const gruntResist = RESIST.grunt;
beforeAll(() => {
  RESIST.grunt = {};
});
afterAll(() => {
  RESIST.grunt = gruntResist;
});

/** A battle with no enemies and no waves: only the test's own. */
function still(): Battle {
  const b = new Battle(1, battleSetup(newMeta()));
  b.enemies = [];
  b['pending'] = [];
  return b;
}

/** An enemy at (x, y) with `hp` hit points, all in world units. */
function enemy(b: Battle, x: number, y: number, hp = 1000): Enemy {
  [x, y, hp] = [toFp(x), toFp(y), toFp(hp)];
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind: 'grunt', x, y, px: x, py: y, hp, maxHp: hp, speed: 0, radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
      markTime: 0, chill: 0, chillTime: 0, brittleTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000, heft: 1000,
  };
  b.enemies.push(e);
  return e;
}

const lost = (e: Enemy) => (e.maxHp - e.hp) / FP;

describe('potion reactions', () => {
  it('pairs the elements', () => {
    expect(reactionOf('fire', 'ice')).toBe('steam');
    expect(reactionOf('ice', 'fire')).toBe('steam');
    expect(reactionOf('lightning', 'ice')).toBe('superconduct');
    expect(reactionOf('fire', 'lightning')).toBe('overload');
    expect(reactionOf('poison', 'lightning')).toBe('electrolysis');
    expect(reactionOf('fire', 'poison')).toBe('combustion');
    expect(reactionOf('wind', 'fire')).toBe('firestorm');
    expect(reactionOf('wind', 'ice')).toBe('blizzard');
    expect(reactionOf('arcane', 'poison')).toBe('resonance');
    expect(reactionOf('fire', 'fire')).toBeNull();
    expect(reactionOf('wind', 'poison')).toBeNull();
  });

  it('leaves frost and shock behind, which wear off', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    react(b, e, 'ice', toFp(10));
    react(b, e, 'wind', 0); // wind on frost: a blizzard, which uses the frost up
    expect(e.frostTime).toBe(0);
    const f = enemy(b, 900, 400);
    react(b, f, 'lightning', toFp(10));
    expect(elementsOn(f)).toEqual(['lightning']);
    for (let t = 0; t < ticks(R.shockTime); t++) wearReactions(f);
    expect(elementsOn(f)).toEqual([]);
  });

  it('sets off steam with fire on a frosted enemy: damage and a slow all around, the frost used up', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    const near = enemy(b, 500 + R.steam.radius - 10, 400);
    const far = enemy(b, 500 + R.steam.radius + 50, 400);
    e.frostTime = ticks(R.frostTime);
    react(b, e, 'fire', toFp(100));
    expect(lost(e)).toBeCloseTo(100 * R.steam.damage, 1);
    expect(lost(near)).toBeCloseTo(100 * R.steam.damage, 1);
    expect(lost(far)).toBe(0);
    expect(near.slowFactor).toBe(1000 - R.steam.slow * 1000);
    expect(e.frostTime).toBe(0);
    expect(b.reactions.steam).toBe(1);
    expect(b.events).toContainEqual({ type: 'reaction', id: 'steam', x: 500, y: 400, radius: R.steam.radius });
  });

  it('reacts at most once a cooldown', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    e.frostTime = 1000;
    react(b, e, 'fire', toFp(100));
    e.frostTime = 1000;
    react(b, e, 'fire', toFp(100));
    expect(b.reactions.steam).toBe(1);
    for (let t = 0; t < ticks(R.cooldown); t++) wearReactions(e);
    e.frostTime = 1000;
    react(b, e, 'fire', toFp(100));
    expect(b.reactions.steam).toBe(2);
  });

  it('sets the poison left off at once with fire, and runs it down the current with lightning', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    e.poisonDps = toFp(20);
    e.poisonTime = ticks(3);
    react(b, e, 'fire', toFp(10));
    // what the poison would still have done (60), not the small hit
    expect(lost(e)).toBeCloseTo(60 * R.combustion.damage, 0);
    expect(e.poisonTime).toBe(0);

    const c = still();
    const f = enemy(c, 500, 400);
    const g = enemy(c, 560, 400);
    f.poisonDps = toFp(20);
    f.poisonTime = ticks(3);
    react(c, f, 'lightning', toFp(10));
    expect(g.poisonTime).toBeGreaterThan(0);
    expect(g.rust).toBe(R.electrolysis.rust);
    expect(c.reactions.electrolysis).toBe(1);
  });

  it('fans the scorch into a burn all around with wind', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    const near = enemy(b, 560, 400);
    e.scorch = toFp(100);
    e.scorchTime = ticks(2);
    react(b, e, 'wind', toFp(10));
    expect(near.burnDps).toBe(toFp(100 * R.firestorm.burn));
    expect(near.burnTime).toBeGreaterThan(0);
    expect(e.scorchTime).toBe(0);
  });

  it('rings an arcane bolt with whatever is there, on the one it hit alone', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    const near = enemy(b, 540, 400);
    e.frostTime = 1000;
    react(b, e, 'arcane', toFp(100));
    expect(lost(e)).toBeCloseTo(100 * R.resonance.damage, 1);
    expect(lost(near)).toBe(0);
  });

  it('does nothing on the dead, nor in a battle with reactions off', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    e.frostTime = 1000;
    e.hp = 0;
    react(b, e, 'fire', toFp(100));
    expect(b.reactions.steam).toBe(0);
    b.reacting = false;
    const f = enemy(b, 900, 400);
    f.frostTime = 1000;
    react(b, f, 'fire', toFp(100));
    expect(b.reactions.steam).toBe(0);
  });

  it('happens in a real battle with the starting lineup', () => {
    const b = new Battle(1, battleSetup(newMeta()));
    for (let t = 0; t < ticks(120) && b.result === null; t++) {
      if (b.choices) b.choose(b.choices[0]);
      else if (b.gold >= b.summonCost()) b.summon();
      b.step();
      b.drain();
    }
    expect(Object.values(b.reactions).reduce((a, n) => a + n, 0)).toBeGreaterThan(0);
  });
});
