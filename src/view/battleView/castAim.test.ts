// Aiming the commander's spell (castAim.ts): a drag from the badge onto the road casts there, back
// on the badge or off the road casts nothing, a tap throws at the thickest crowd, and a mouse
// click picks the spell up for a second click; the ring and the outlines it draws.

import { describe, expect, it, vi } from 'vitest';
import { charged, grunt } from '../../sim/commanderKit';
import { FP } from '../../sim/math/fixed';
import { BALANCE } from '../../sim/types';
import { CastAim, DRAG_MIN, onRoad } from './castAim';
import { badgeAt } from './commander';
import { WALL_TOP } from './wall';

const F = BALANCE.field;

/** A charged battle with a grunt at (500, 800), the aim, and the cast spied on. */
function setup() {
  const b = charged();
  b.enemies.push(grunt(1, 500, 800, 1e6));
  const aim = new CastAim();
  const cast = vi.spyOn(b, 'cast');
  return { b, aim, cast, badge: badgeAt() };
}

describe('cast aim', () => {
  it('knows the road: between the sides, from the top down to the wall', () => {
    expect(onRoad(500, 800)).toBe(true);
    expect(onRoad(F.left - 1, 800)).toBe(false);
    expect(onRoad(F.right + 1, 800)).toBe(false);
    expect(onRoad(500, F.top - 1)).toBe(false);
    expect(onRoad(500, WALL_TOP + 1)).toBe(false);
  });

  it('casts where a drag from the badge lets go on the road', () => {
    const { b, aim, cast, badge } = setup();
    expect(aim.down(b, badge)).toBe(true);
    expect(aim.active).toBe(true);
    expect(aim.showing).toBe(false);
    aim.move({ x: 600, y: 900 });
    expect(aim.showing).toBe(true);
    aim.up(b, { x: 520, y: 810 }, false);
    expect(cast).toHaveBeenCalledWith({ x: 520 * FP, y: 810 * FP });
    expect(b.flasks[0].how).toBe('drag');
    expect(aim.active).toBe(false);
  });

  it('casts nothing dragged back onto the badge or off the road, the charge kept', () => {
    const { b, aim, cast, badge } = setup();
    for (const to of [badge, { x: 500, y: WALL_TOP + 40 }, { x: F.right + 30, y: 600 }]) {
      aim.down(b, badge);
      aim.move({ x: 500, y: 600 });
      aim.move(to);
      aim.up(b, to, false);
    }
    expect(cast).not.toHaveBeenCalled();
    expect(b.canCast()).toBe(true);
  });

  it('throws a tap at the thickest crowd, a small wobble still a tap', () => {
    const { b, aim, cast, badge } = setup();
    aim.down(b, badge);
    aim.move({ x: badge.x + DRAG_MIN - 5, y: badge.y });
    aim.up(b, badge, false);
    expect(cast).toHaveBeenCalledWith();
    expect(b.flasks[0].how).toBe('tap');
  });

  it('takes no press away from the badge, and none before the charge is full', () => {
    const { b, aim } = setup();
    expect(aim.down(b, { x: 500, y: 800 })).toBe(false);
    b.charge = 0;
    expect(aim.down(b, badgeAt())).toBe(true);
    expect(aim.active).toBe(false);
    aim.up(b, badgeAt(), false);
    b.charge = BALANCE.commander.charge;
    vi.spyOn(b, 'paused', 'get').mockReturnValue(true);
    aim.down(b, badgeAt());
    expect(aim.active).toBe(false);
  });

  it('picks the spell up on a mouse click: a click on the road casts there, on the badge at the crowd', () => {
    const { b, aim, cast, badge } = setup();
    aim.down(b, badge);
    aim.up(b, badge, true);
    expect(aim.active).toBe(true);
    aim.move({ x: 700, y: 700 });
    expect(aim.showing).toBe(true);
    expect(aim.down(b, { x: 700, y: 700 })).toBe(true);
    expect(cast).toHaveBeenLastCalledWith({ x: 700 * FP, y: 700 * FP });
    expect(aim.active).toBe(false);
    // the second spell: picked up, then the badge clicked again
    b.charge = BALANCE.commander.charge;
    aim.down(b, badge);
    aim.up(b, badge, true);
    aim.down(b, badge);
    expect(cast).toHaveBeenLastCalledWith();
    // the third: picked up, then put down off the road
    b.charge = BALANCE.commander.charge;
    aim.down(b, badge);
    aim.up(b, badge, true);
    aim.down(b, { x: 500, y: WALL_TOP + 100 });
    expect(cast).toHaveBeenCalledTimes(2);
    expect(aim.active).toBe(false);
  });

  it('rings the reach under the finger and outlines who it would catch', () => {
    const { b, aim, badge } = setup();
    aim.draw(b);
    expect(aim.g.bounds.width).toBe(0);
    aim.down(b, badge);
    aim.move({ x: 500, y: 800 });
    aim.draw(b);
    const r = BALANCE.commander.bomb.radius;
    expect(aim.g.bounds.width).toBeCloseTo(2 * r + 6, -1);
    // far from the grunt: the ring alone, no outline beyond it
    b.enemies.push(grunt(2, 900, 300, 1e6));
    aim.draw(b);
    expect(aim.g.bounds.maxX).toBeLessThan(500 + r + 10);
    // off the road: a grey ring, nothing outlined
    aim.move({ x: 500, y: WALL_TOP + 60 });
    aim.draw(b);
    expect(aim.g.bounds.width).toBeGreaterThan(0);
  });

  it('drops the aim once the spell went off by itself, and on a new battle', () => {
    const { b, aim, badge } = setup();
    aim.down(b, badge);
    b.charge = 0;
    aim.draw(b);
    expect(aim.active).toBe(false);
    b.charge = BALANCE.commander.charge;
    aim.down(b, badge);
    aim.reset();
    expect(aim.active).toBe(false);
  });
});
