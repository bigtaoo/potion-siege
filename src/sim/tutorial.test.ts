import { describe, expect, it } from 'vitest';
import { Battle, WALL_ROW } from './battle';
import { TICK_RATE } from './math/fixed';
import { ASSIST_SECONDS, mergeablePair, Tutorial } from './tutorial';
import { BALANCE } from './types';

const W = WALL_ROW * BALANCE.grid.cols;

/** Steps the battle `secs` seconds, the tutorial watching (and assisting) as the shell does. */
function run(b: Battle, tut: Tutorial, secs: number): (string | null)[] {
  const helped: (string | null)[] = [];
  for (let i = 0; i < secs * TICK_RATE && !b.paused; i++) {
    b.step();
    tut.update(b, b.drain());
    const s = tut.assist(b);
    if (s) helped.push(s);
    tut.update(b, b.drain());
  }
  return helped;
}

describe('tutorial', () => {
  it('walks through summon, merge, the first upgrade and its pick', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    expect(tut.showing(b)).toBe('summon');

    b.summon();
    tut.update(b, b.drain());
    expect(tut.step).toBe('merge');
    // no pair yet: the battle plays on until there is one
    b.slots.fill(null);
    expect(tut.showing(b)).toBeNull();

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
    b.choose(b.choices![0]);
    tut.update(b, b.drain());
    expect(tut.done).toBe(true);
    expect(tut.showing(b)).toBeNull();
  });

  it('never holds the battle: it keeps ticking while a step points', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    tut.update(b, b.drain());
    expect(tut.showing(b)).toBe('summon');
    run(b, tut, 2);
    expect(b.seconds).toBeGreaterThanOrEqual(2);
    expect(tut.step).toBe('summon');
  });

  it('does a step itself once the player has left it alone long enough', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    tut.update(b, b.drain());
    expect(run(b, tut, ASSIST_SECONDS - 1)).toEqual([]);
    expect(run(b, tut, 2)).toEqual(['summon']);
    expect(tut.step).toBe('merge');
    expect(b.summons).toBe(1);
  });

  it('keeps summoning for an idle player until there is a pair to merge', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    tut.update(b, b.drain());
    const helped = run(b, tut, 60);
    expect(helped[0]).toBe('summon');
    expect(helped).toContain('merge');
    expect(b.summons).toBeGreaterThanOrEqual(2);
  });

  it('merges and upgrades for an idle player, but leaves the pick to them', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    b.summon();
    tut.update(b, b.drain());
    b.slots[W] = { id: 91, kind: 'fire', star: 1, slot: W, cooldown: 1 };
    b.slots[W + 1] = { id: 92, kind: 'fire', star: 1, slot: W + 1, cooldown: 1 };
    tut.update(b, b.drain());
    expect(run(b, tut, ASSIST_SECONDS + 1)).toContain('merge');
    expect(tut.step).toBe('upgrade');
    b.gold = 1e5;
    tut.update(b, b.drain());
    expect(run(b, tut, ASSIST_SECONDS + 1)).toEqual(['upgrade']);
    expect(tut.step).toBe('pick');
    expect(b.choices).not.toBeNull();
    expect(tut.assist(b)).toBeNull();
  });

  it('restarts the wait when the player acts before it runs out', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    tut.update(b, b.drain());
    run(b, tut, ASSIST_SECONDS - 2);
    b.summon();
    tut.update(b, b.drain());
    expect(tut.step).toBe('merge');
    expect(b.summons).toBe(1);
  });

  it('stops pointing once skipped', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    tut.skip();
    expect(tut.done).toBe(true);
    expect(tut.showing(b)).toBeNull();
    expect(tut.assist(b)).toBeNull();
  });
});
