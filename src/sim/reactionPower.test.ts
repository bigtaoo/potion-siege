// What a reaction's power rests on (reactionPower.ts): the mastery stars the save carries into the
// setup, the legend recipe that boosts it, and the news a battle's events bring the save.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RESIST } from './enemies';
import { FP, ticks, toFp } from './math/fixed';
import { BASE_SETUP, battleSetup, newMeta } from './meta';
import { boostedBy, masteryOf, masteryStars, REACTION_LEGENDS, REACTION_MASTERY, reactionNews, reactionPower } from './reactionPower';
import { react } from './reactions';
import { enemy, still } from './stillField';
import { BALANCE, REACTION_IDS, type BattleEvent } from './types';

const R = BALANCE.reactions;
const gruntResist = RESIST.grunt;
beforeAll(() => {
  RESIST.grunt = {};
});
afterAll(() => {
  RESIST.grunt = gruntResist;
});

const rx = (id: (typeof REACTION_IDS)[number]): BattleEvent => ({ type: 'reaction', id, x: 0, y: 0, radius: 0 });

describe('reaction mastery', () => {
  it('earns a star at 100, 1000 and 10000', () => {
    expect([0, 99, 100, 999, 1000, 10000, 1e6].map(masteryStars)).toEqual([0, 0, 1, 1, 2, 3, 3]);
  });

  it('leaves a setup without stars as it was, and carries the stars there are', () => {
    expect(BASE_SETUP.mastery).toBeUndefined();
    expect(masteryOf(newMeta())).toBeUndefined();
    const m = newMeta();
    m.achievements.stats.reactions.steam = REACTION_MASTERY[1];
    m.achievements.stats.reactions.overload = 5;
    expect(battleSetup(m).mastery).toEqual({ steam: 2 });
  });

  it('makes a reaction a step stronger a star, with the same reach', () => {
    expect(reactionPower(still(), 'steam')).toEqual({ power: 1, reach: 1 });
    const b = still({ ...battleSetup(newMeta()), mastery: { steam: 2, blizzard: 9 } });
    expect(reactionPower(b, 'steam').power).toBeCloseTo(1 + 2 * R.masteryStep);
    expect(reactionPower(b, 'steam').reach).toBe(1);
    // a star count past the last is held at it
    expect(reactionPower(b, 'blizzard').power).toBeCloseTo(1 + REACTION_MASTERY.length * R.masteryStep);
  });

  it('hits harder by its stars', () => {
    const plain = still();
    const e = enemy(plain, 500, 400);
    e.frostTime = ticks(R.frostTime);
    react(plain, e, 'fire', toFp(100));
    const strong = still({ ...battleSetup(newMeta()), mastery: { steam: 3 } });
    const f = enemy(strong, 500, 400);
    f.frostTime = ticks(R.frostTime);
    react(strong, f, 'fire', toFp(100));
    const lost = (x: typeof e) => (x.maxHp - x.hp) / FP;
    expect(lost(f) / lost(e)).toBeCloseTo(1 + 3 * R.masteryStep, 2);
    expect(f.slowTime).toBeGreaterThan(e.slowTime);
  });
});

describe('the legend recipes as reaction boosts', () => {
  it('names the reaction each recipe boosts', () => {
    expect(boostedBy('iceLightning')).toBe('superconduct');
    expect(boostedBy('fireArcane')).toBe('resonance');
    expect(boostedBy('allDamage')).toBeNull();
    for (const id of REACTION_IDS) for (const s of REACTION_LEGENDS[id]) expect(boostedBy(s)).toBe(id);
  });

  it('makes the boosted reaction stronger and wider while taken', () => {
    const b = still();
    b.skills.iceLightning = 1;
    expect(reactionPower(b, 'superconduct')).toEqual({ power: R.legendPower, reach: R.legendReach });
    expect(reactionPower(b, 'overload')).toEqual({ power: 1, reach: 1 });
    const e = enemy(b, 500, 400);
    // just past the plain reach, inside the boosted one
    const near = enemy(b, 500 + R.superconduct.radius + 10, 400);
    e.frostTime = ticks(R.frostTime);
    react(b, e, 'lightning', toFp(100));
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(b.events).toContainEqual({ type: 'reaction', id: 'superconduct', x: 500, y: 400, radius: Math.round(R.superconduct.radius * R.legendReach) });
  });

  it('boosts electrolysis by the poison it spreads', () => {
    const b = still();
    b.skills.poisonLightning = 1;
    const e = enemy(b, 500, 400);
    const near = enemy(b, 540, 400);
    e.poisonTime = ticks(3);
    e.poisonDps = toFp(10);
    react(b, e, 'lightning', toFp(10));
    expect(near.poisonDps).toBe(Math.trunc(toFp(10) * R.legendPower));
  });
});

describe('reaction news', () => {
  it('finds a reaction never set off and the stars reached, before the events are counted', () => {
    const m = newMeta();
    m.achievements.stats.reactions.overload = REACTION_MASTERY[0] - 1;
    m.achievements.stats.reactions.blizzard = 7;
    const news = reactionNews(m, [rx('steam'), rx('steam'), rx('overload'), rx('blizzard'), { type: 'summon' } as BattleEvent]);
    expect(news.found).toEqual(['steam']);
    expect(news.starred).toEqual([['overload', 1]]);
    expect(reactionNews(m, [])).toEqual({ found: [], starred: [] });
  });
});
