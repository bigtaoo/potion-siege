// The reactions of the three later potions (reactions.ts): light, quicksilver and vine, each with
// the two elements it pairs with, what each reaction does and the element it leaves behind.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RESIST } from './enemies';
import { FP, ticks, toFp } from './math/fixed';
import { enemy, still } from './stillField';
import { root } from './lateHits';
import { elementsOn, react, reactionOf, wearReactions } from './reactions';
import { BALANCE, type Enemy } from './types';

const R = BALANCE.reactions;

// on grunts that take every potion in full, so the numbers read straight
const gruntResist = RESIST.grunt;
beforeAll(() => {
  RESIST.grunt = {};
});
afterAll(() => {
  RESIST.grunt = gruntResist;
});

const lost = (e: Enemy) => (e.maxHp - e.hp) / FP;

describe('the later potions\' reactions', () => {
  it('pairs light, quicksilver and vine each with two elements, either way round', () => {
    expect([reactionOf('light', 'ice'), reactionOf('ice', 'light')]).toEqual(['prism', 'prism']);
    expect([reactionOf('light', 'fire'), reactionOf('fire', 'light')]).toEqual(['flare', 'flare']);
    expect([reactionOf('metal', 'lightning'), reactionOf('lightning', 'metal')]).toEqual(['magnetize', 'magnetize']);
    expect([reactionOf('metal', 'fire'), reactionOf('fire', 'metal')]).toEqual(['molten', 'molten']);
    expect([reactionOf('vine', 'poison'), reactionOf('poison', 'vine')]).toEqual(['spores', 'spores']);
    expect([reactionOf('vine', 'ice'), reactionOf('ice', 'vine')]).toEqual(['bramble', 'bramble']);
    expect(reactionOf('light', 'metal')).toBeNull();
    expect(reactionOf('vine', 'vine')).toBeNull();
    expect(reactionOf('arcane', 'vine')).toBe('resonance');
  });

  it('leaves glare and the magnet behind, which wear off', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    react(b, e, 'light', toFp(10));
    react(b, e, 'metal', toFp(10));
    expect(elementsOn(e)).toEqual(['light', 'metal']);
    for (let t = 0; t < ticks(Math.max(R.glareTime, R.magnetTime)); t++) wearReactions(e);
    expect(elementsOn(e)).toEqual([]);
  });

  it('counts a tangle as the vine\'s element and wears it off', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    e.tangleTime = 2;
    expect(elementsOn(e)).toEqual(['vine']);
    wearReactions(e);
    wearReactions(e);
    expect(elementsOn(e)).toEqual([]);
  });

  it('splits light on a frozen one into beams at the nearest few around: the prism', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    const ring = [enemy(b, 560, 400), enemy(b, 500, 470), enemy(b, 420, 400), enemy(b, 500, 300)];
    const far = enemy(b, 500 + R.prism.range + 80, 400);
    e.frostTime = ticks(R.frostTime);
    react(b, e, 'light', toFp(100));
    expect(lost(e)).toBeCloseTo(100 * R.prism.damage, 1);
    // the nearest `bolts` of the four take a beam each, the farthest of them none
    expect(ring.slice(0, R.prism.bolts).map(lost)).toEqual(Array(R.prism.bolts).fill(100 * R.prism.damage));
    expect(lost(ring[3])).toBe(0);
    expect(lost(far)).toBe(0);
    expect(b.events.filter((ev) => ev.type === 'beam')).toHaveLength(R.prism.bolts);
    expect(e.frostTime).toBe(0);
    expect(e.glareTime).toBe(ticks(R.glareTime));
    expect(b.reactions.prism).toBe(1);
  });

  it('flares light on a scorched one: damage and a slow all around, the scorch used up', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    const near = enemy(b, 500 + R.flare.radius - 10, 400);
    const far = enemy(b, 500 + R.flare.radius + 50, 400);
    e.scorchTime = 30;
    react(b, e, 'light', toFp(100));
    expect(lost(e)).toBeCloseTo(100 * R.flare.damage, 1);
    expect(lost(near)).toBeCloseTo(100 * R.flare.damage, 1);
    expect(near.slowFactor).toBe(1000 - R.flare.slow * 1000);
    expect(lost(far)).toBe(0);
    expect(e.scorchTime).toBe(0);
    expect(b.reactions.flare).toBe(1);
  });

  it('flares fire on a glaring one as well', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    e.glareTime = 30;
    react(b, e, 'fire', toFp(100));
    expect(b.reactions.flare).toBe(1);
    expect(e.glareTime).toBe(0);
  });

  it('magnetizes quicksilver on a shocked one: damage all around, the rest drawn in but no boss', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    const near = enemy(b, 620, 400);
    const boss = enemy(b, 500, 520);
    boss.kind = 'boss';
    const touching = enemy(b, 555, 400);
    e.shockTime = 30;
    react(b, e, 'metal', toFp(100));
    expect(lost(e)).toBeCloseTo(100 * R.magnetize.damage, 1);
    expect(lost(near)).toBeGreaterThan(0);
    expect(near.x / FP).toBe(620 - R.magnetize.pull);
    expect(boss.y / FP).toBe(520);
    // one already against it stays where it is rather than going into it
    expect(touching.x / FP).toBe(555);
    expect(e.shockTime).toBe(0);
    expect(b.reactions.magnetize).toBe(1);
  });

  it('draws a flyer in by its weave, not its place', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    const fly = enemy(b, 620, 400);
    fly.kind = 'flyer';
    fly.x0 = fly.x;
    e.shockTime = 30;
    react(b, e, 'metal', toFp(100));
    expect(fly.x0 / FP).toBe(620 - R.magnetize.pull);
  });

  it('boils quicksilver on a scorched one into a heavy burn: molten', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    e.scorchTime = 30;
    react(b, e, 'metal', toFp(100));
    expect(e.burnDps / FP).toBeCloseTo(100 * R.molten.burn, 1);
    expect(e.burnTime).toBe(ticks(R.molten.time));
    expect(e.burnBy).toBe('metal');
    // a weaker burn after it does not take the strong one's place
    e.reactTime = 0;
    e.scorchTime = 30;
    react(b, e, 'metal', toFp(10));
    expect(e.burnDps / FP).toBeCloseTo(100 * R.molten.burn, 1);
  });

  it('blooms the vine on a poisoned one into poison all around: spores', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    const near = enemy(b, 500 + R.spores.radius - 10, 400);
    const far = enemy(b, 500 + R.spores.radius + 50, 400);
    e.poisonTime = 30;
    e.poisonDps = toFp(5);
    react(b, e, 'vine', toFp(100));
    expect(near.poisonTime).toBeGreaterThan(0);
    expect(near.poisonDps).toBeGreaterThanOrEqual(toFp(5));
    expect(far.poisonTime).toBe(0);
    expect(b.reactions.spores).toBe(1);
  });

  it('shoots thorns from a frozen vine: all around hurt and held, the bramble', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    const near = enemy(b, 500 + R.bramble.radius - 10, 400);
    const far = enemy(b, 500 + R.bramble.radius + 50, 400);
    e.frostTime = ticks(R.frostTime);
    react(b, e, 'vine', toFp(100));
    expect(lost(e)).toBeCloseTo(100 * R.bramble.damage, 1);
    expect(lost(near)).toBeCloseTo(100 * R.bramble.damage, 1);
    expect(near.slowFactor).toBe(0);
    expect(near.tangleTime).toBeGreaterThan(0);
    expect(lost(far)).toBe(0);
    expect(far.tangleTime ?? 0).toBe(0);
    expect(b.reactions.bramble).toBe(1);
  });

  it('still flares light on a scorch the fire left, but not on one the light left itself', () => {
    const b = still();
    const fired = enemy(b, 300, 400);
    fired.scorchTime = 30;
    fired.scorchBy = 'fire';
    const lit = enemy(b, 700, 400);
    lit.scorchTime = 30;
    lit.scorchBy = 'light';
    react(b, lit, 'light', toFp(100));
    expect(b.reactions.flare).toBe(0);
    react(b, fired, 'light', toFp(100));
    expect(b.reactions.flare).toBe(1);
  });

  it('keeps a used-up tangle as the guard against a new root, but it reacts no more', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    e.tangleTime = ticks(R.glareTime);
    react(b, e, 'arcane', toFp(100));
    expect(b.reactions.resonance).toBe(1);
    expect(e.tangleTime).toBeGreaterThan(0);
    expect(elementsOn(e)).toEqual([]);
    e.reactTime = 0;
    react(b, e, 'arcane', toFp(100));
    expect(b.reactions.resonance).toBe(1);
  });

  it('lets quicksilver boil a scorch the light left: only the potion that left it passes over it', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    e.scorchTime = 30;
    e.scorchBy = 'light';
    react(b, e, 'metal', toFp(100));
    expect(b.reactions.molten).toBe(1);
  });

  it('makes a new tangle an element again once the used one has worn off', () => {
    const b = still();
    const e = enemy(b, 500, 400);
    e.tangleTime = 1;
    e.tangleUsed = true;
    expect(root(e, 10)).toBe(false);
    wearReactions(e);
    expect(root(e, 10)).toBe(true);
    expect(elementsOn(e)).toEqual(['vine']);
  });
});
