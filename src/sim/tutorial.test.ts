import { describe, expect, it } from 'vitest';
import { FixedStep } from '../view/fixedStep';
import { Battle, WALL_ROW } from './battle';
import { FP, TICK_RATE } from './math/fixed';
import { BASE_SETUP, FIRST_SEED } from './meta';
import { checkReplay, takeReplay } from './replay';
import { HOLD_AFTER_SECONDS, mergeablePair, SLOW_PACE, STOP_GAP, Tutorial } from './tutorial';
import { BALANCE } from './types';

const W = WALL_ROW * BALANCE.grid.cols;

/** Runs `secs` wall seconds of 60 fps frames as the shell does: the clock fed at the tutorial's
 *  pace, a tick only while the pace has not dropped, the tutorial moved on after each. Returns
 *  the ticks that ran. */
function run(b: Battle, tut: Tutorial, secs: number): number {
  const clock = new FixedStep();
  let ran = 0;
  for (let f = 0; f < secs * 60 && !b.paused; f++) {
    const p = tut.pace(b);
    if (p === 0) continue;
    const steps = clock.advance(1000 / 60, p);
    for (let i = 0; i < steps && tut.pace(b) >= p; i++) {
      b.step();
      ran++;
      tut.update(b, b.drain());
    }
  }
  return ran;
}

/** How far the nearest enemy stands from the wall, in world units. */
const gap = (b: Battle) => Math.min(...b.enemies.map((e) => (b.wallFront(e.x) - e.radius - e.y) / FP));

/** Summons until there is a pair, then merges it. */
function mergeFirst(b: Battle, tut: Tutorial): void {
  while (!mergeablePair(b)) {
    expect(b.summon()).toBe(true);
    tut.update(b, b.drain());
  }
  const [from, to] = mergeablePair(b)!;
  b.move(from, to);
  tut.update(b, b.drain());
}

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

  it('lets the crowd walk in for HOLD_AFTER_SECONDS, then creeps on in slow motion and stops short of the wall', () => {
    const b = new Battle(FIRST_SEED, BASE_SETUP);
    const tut = new Tutorial();
    expect(tut.pace(b)).toBe(1);
    while (tut.pace(b) === 1) b.step();
    expect(b.time).toBe(HOLD_AFTER_SECONDS * TICK_RATE);
    expect(tut.pace(b)).toBe(SLOW_PACE);
    // the same ticks, a fifth as many a second: the crowd keeps coming down
    const far = gap(b);
    expect(run(b, tut, 10)).toBe(10 * TICK_RATE * SLOW_PACE);
    expect(gap(b)).toBeLessThan(far);
    // however long the player waits, the crowd stops a cell short and the wall is never touched
    const wall = b.wall;
    run(b, tut, 600);
    expect(tut.pace(b)).toBe(0);
    expect(gap(b)).toBeGreaterThan(STOP_GAP - 10);
    expect(gap(b)).toBeLessThanOrEqual(STOP_GAP);
    const t = b.time;
    expect(run(b, tut, 60)).toBe(0);
    expect(b.time).toBe(t);
    expect(b.wall).toBe(wall);
    expect(b.enemies.every((e) => !e.atWall)).toBe(true);
    // and nothing was done for the player
    expect(b.commands).toEqual([]);
    expect(b.summons).toBe(0);
    expect(tut.step).toBe('summon');
  });

  it('pairs the first two summons on FIRST_SEED however long the player waits, and points at the merge at once', () => {
    for (const [first, between] of [[0, 0], [1, 0.1], [3, 2], [20, 30], [70, 70], [600, 5]]) {
      const b = new Battle(FIRST_SEED, BASE_SETUP);
      const tut = new Tutorial();
      run(b, tut, first);
      expect(b.summon()).toBe(true);
      tut.update(b, b.drain());
      // the summon left gold for another: the hand moves to 召唤 and the battle creeps on
      expect(tut.showing(b)).toBe('more');
      run(b, tut, between);
      expect(b.summon()).toBe(true);
      tut.update(b, b.drain());
      expect(mergeablePair(b)).not.toBeNull();
      expect(tut.showing(b)).toBe('merge');
    }
  });

  it('goes on the moment the player does the step, and slows again at the next one', () => {
    const b = new Battle(FIRST_SEED, BASE_SETUP);
    const tut = new Tutorial();
    run(b, tut, 10);
    b.summon();
    tut.update(b, b.drain());
    expect(tut.step).toBe('merge');
    expect(tut.pace(b)).toBe(SLOW_PACE);
    mergeFirst(b, tut);
    expect(tut.step).toBe('upgrade');
    // 强化 is not affordable yet: the battle plays on at full speed until it is, then slows there
    expect(tut.pace(b)).toBe(1);
    run(b, tut, 60);
    expect(tut.showing(b)).toBe('upgrade');
    expect(tut.pace(b)).toBeLessThan(1);
    b.upgrade();
    tut.update(b, b.drain());
    // the pick pauses the battle by itself; the tutorial does not slow it
    expect(tut.step).toBe('pick');
    expect(b.paused).toBe(true);
    expect(tut.pace(b)).toBe(1);
  });

  it('keeps the replay whole: commands given in slow motion play back to the same battle', () => {
    const b = new Battle(FIRST_SEED, BASE_SETUP);
    const tut = new Tutorial();
    run(b, tut, 10);
    b.summon();
    tut.update(b, b.drain());
    run(b, tut, 7);
    mergeFirst(b, tut);
    run(b, tut, 30);
    expect(b.commands.length).toBeGreaterThan(2);
    expect(checkReplay(takeReplay(b))).toBe(true);
  });

  it('slows nothing once skipped', () => {
    const b = new Battle(1);
    const tut = new Tutorial();
    run(b, tut, HOLD_AFTER_SECONDS + 1);
    expect(tut.pace(b)).toBeLessThan(1);
    tut.skip();
    expect(tut.done).toBe(true);
    expect(tut.showing(b)).toBeNull();
    expect(tut.pace(b)).toBe(1);
  });
});
