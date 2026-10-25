import { describe, expect, it } from 'vitest';
import { Battle, WALL_ROW } from './battle';
import { TICK_RATE } from './math/fixed';
import { BASE_SETUP, FIRST_SEED } from './meta';
import { checkReplay, takeReplay } from './replay';
import { HOLD_AFTER_SECONDS, mergeablePair, Tutorial } from './tutorial';
import { BALANCE } from './types';

const W = WALL_ROW * BALANCE.grid.cols;

/** Runs `secs` seconds of frames as the shell does: a tick only while the tutorial does not hold
 *  the battle, the tutorial moved on after each. Returns the ticks that ran. */
function run(b: Battle, tut: Tutorial, secs: number): number {
  let ran = 0;
  for (let i = 0; i < secs * TICK_RATE && !b.paused; i++) {
    if (!tut.holds(b)) {
      b.step();
      ran++;
    }
    tut.update(b, b.drain());
  }
  return ran;
}

/** Where everything that moves on its own stands: the enemies, the wall, the clock. */
const board = (b: Battle) => ({ t: b.time, wall: b.wall, enemies: b.enemies.map((e) => [e.x, e.y, e.hp]), pending: b.pending.length });

describe('tutorial', () => {
  it('walks through summon, merge, the first upgrade and its pick', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    expect(tut.showing(b)).toBe('summon');

    b.summon();
    tut.update(b, b.drain());
    expect(tut.step).toBe('merge');
    // no pair yet: the hand goes to 召唤 for one more
    b.slots.fill(null);
    expect(tut.showing(b)).toBe('more');
    b.gold = 0;
    expect(tut.showing(b)).toBeNull();
    b.gold = 1e5;

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

  it('lets the crowd walk in for HOLD_AFTER_SECONDS, then holds the first battle for an idle player for good', () => {
    const b = new Battle(FIRST_SEED, BASE_SETUP);
    const tut = new Tutorial();
    expect(tut.holds(b)).toBe(false);
    run(b, tut, 10);
    expect(b.time).toBe(HOLD_AFTER_SECONDS * TICK_RATE);
    expect(tut.holds(b)).toBe(true);
    const before = board(b);
    expect(run(b, tut, 120)).toBe(0);
    // nothing moved, nothing hit the wall, no wave came, and nothing was done for the player
    expect(board(b)).toEqual(before);
    expect(b.commands).toEqual([]);
    expect(b.summons).toBe(0);
    expect(tut.step).toBe('summon');
  });

  it('goes on the moment the player does the step, and holds again at the next one', () => {
    const b = new Battle(FIRST_SEED, BASE_SETUP);
    const tut = new Tutorial();
    run(b, tut, 10);
    b.summon();
    tut.update(b, b.drain());
    expect(tut.step).toBe('merge');
    // the summon left gold for another: the hand moves to 召唤 and the battle waits for it
    expect(tut.showing(b)).toBe('more');
    expect(run(b, tut, 5)).toBe(0);
    // summon until there is a pair, then merge it: the battle waits on each step in turn
    while (!mergeablePair(b)) {
      expect(b.summon()).toBe(true);
      tut.update(b, b.drain());
    }
    expect(tut.showing(b)).toBe('merge');
    expect(run(b, tut, 5)).toBe(0);
    const [from, to] = mergeablePair(b)!;
    b.move(from, to);
    tut.update(b, b.drain());
    expect(tut.step).toBe('upgrade');
    // 强化 is not affordable yet: the battle plays on until it is, then holds there
    expect(tut.holds(b)).toBe(false);
    const ran = run(b, tut, 60);
    expect(ran).toBeGreaterThan(0);
    expect(tut.showing(b)).toBe('upgrade');
    expect(tut.holds(b)).toBe(true);
    expect(run(b, tut, 5)).toBe(0);
    b.upgrade();
    tut.update(b, b.drain());
    // the pick pauses the battle by itself; the tutorial does not hold on it
    expect(tut.step).toBe('pick');
    expect(b.paused).toBe(true);
    expect(tut.holds(b)).toBe(false);
  });

  it('keeps the replay whole: commands given during a hold play back to the same battle', () => {
    const b = new Battle(FIRST_SEED, BASE_SETUP);
    const tut = new Tutorial();
    run(b, tut, 10);
    while (!mergeablePair(b)) {
      b.summon();
      tut.update(b, b.drain());
    }
    const [from, to] = mergeablePair(b)!;
    b.move(from, to);
    tut.update(b, b.drain());
    run(b, tut, 30);
    expect(b.commands.every((c) => c.tick === HOLD_AFTER_SECONDS * TICK_RATE)).toBe(true);
    expect(checkReplay(takeReplay(b))).toBe(true);
  });

  it('holds nothing once skipped', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    run(b, tut, HOLD_AFTER_SECONDS + 1);
    expect(tut.holds(b)).toBe(true);
    tut.skip();
    expect(tut.done).toBe(true);
    expect(tut.showing(b)).toBeNull();
    expect(tut.holds(b)).toBe(false);
  });
});
