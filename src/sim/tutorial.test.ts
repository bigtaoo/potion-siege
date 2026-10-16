import { describe, expect, it } from 'vitest';
import { Battle, WALL_ROW } from './battle';
import { mergeablePair, Tutorial } from './tutorial';
import { BALANCE } from './types';

const W = WALL_ROW * BALANCE.grid.cols;

describe('tutorial', () => {
  it('walks through summon, merge, the first upgrade and its pick', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    expect(tut.showing(b)).toBe('summon');
    expect(tut.holds(b)).toBe(true);

    b.summon();
    tut.update(b, b.drain());
    expect(tut.step).toBe('merge');
    // no pair yet: the battle plays on until there is one
    b.slots.fill(null);
    expect(tut.showing(b)).toBeNull();
    expect(tut.holds(b)).toBe(false);

    b.slots[W] = { id: 1, kind: 'fire', star: 1, slot: W, cooldown: 1 };
    b.slots[W + 1] = { id: 2, kind: 'fire', star: 1, slot: W + 1, cooldown: 1 };
    expect(mergeablePair(b)).toEqual([W, W + 1]);
    expect(tut.showing(b)).toBe('merge');
    b.move(W, W + 1);
    tut.update(b, b.drain());
    expect(tut.step).toBe('upgrade');

    b.gold = 0;
    expect(tut.showing(b)).toBeNull();
    b.gold = 1e5;
    expect(tut.showing(b)).toBe('upgrade');
    b.upgrade();
    tut.update(b, b.drain());
    expect(tut.step).toBe('pick');
    expect(tut.showing(b)).toBe('pick');
    // the pick pauses the battle by itself
    expect(tut.holds(b)).toBe(false);
    b.choose(b.choices![0]);
    tut.update(b, b.drain());
    expect(tut.done).toBe(true);
    expect(tut.showing(b)).toBeNull();
  });

  it('stops pointing once skipped', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    tut.skip();
    expect(tut.done).toBe(true);
    expect(tut.holds(b)).toBe(false);
  });
});
