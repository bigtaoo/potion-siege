import { describe, expect, it, vi } from 'vitest';
import { BALANCE, type FlaskHit } from '../../sim/types';
import { flaskBurst, overWall } from './castFx';
import type { Floaters } from './floaters';
import { FxLayer } from './fxLayer';
import { WALL_TOP } from './wall';

/** The effects flaskBurst left, by what they are drawn over. */
function burst(y: number, at: { x: number; y: number; damage: number }[] = []) {
  const hits = at.map((h) => ({ killed: false, ...h }) as FlaskHit);
  const fx = new FxLayer();
  const push = vi.spyOn(fx, 'push');
  flaskBurst(fx, { show: vi.fn() } as unknown as Floaters, 500, y, BALANCE.commander.bomb.radius, hits);
  return push.mock.calls.map(([e]) => e.top === true);
}

describe('the bomb flash', () => {
  it('knows when a flash would reach over the wall', () => {
    expect(overWall(WALL_TOP - 100, 50)).toBe(false);
    expect(overWall(WALL_TOP - 100, 150)).toBe(true);
  });

  it('flashes over the heroes out on the field', () => {
    expect(burst(400, [{ x: 500, y: 400, damage: 10 }])).toEqual([true, true]);
  });

  it('flashes under the heroes by the wall, so the cells stay in sight', () => {
    expect(burst(WALL_TOP - 60, [{ x: 500, y: WALL_TOP - 20, damage: 10 }, { x: 500, y: 300, damage: 0 }])).toEqual([false, false, true]);
  });
});
