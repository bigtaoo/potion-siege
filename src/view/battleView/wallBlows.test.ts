import { Graphics } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { FxLayer } from './fxLayer';
import { HEAVY, chips, wallBlow } from './wallBlows';

describe('wallBlow', () => {
  it('puffs dust in front of the enemy, heavier for the heavy kinds, and throws chips', () => {
    const fx = new FxLayer();
    const burst = vi.spyOn(fx, 'burst');
    const effect = vi.spyOn(fx, 'effect');
    wallBlow(fx, 300, 500, 30, 'grunt');
    expect(burst).toHaveBeenLastCalledWith(300, 530, 36, expect.any(Number), 0.22);
    wallBlow(fx, 300, 500, 60, 'brute');
    expect(burst.mock.calls[1][4]).toBe(0.35);
    expect(effect.mock.calls.filter(([ttl]) => ttl === 0.3).length).toBe(2);
    expect(HEAVY.has('boss')).toBe(true);
    expect(HEAVY.has('runner')).toBe(false);
  });

  it('throws three chips up off the wall and lets them fall back, fading', () => {
    const g = new Graphics();
    chips(g, 100, 100, 1, 0, 0);
    expect(g.bounds.height).toBeLessThan(10);
    chips(g.clear(), 100, 100, 1, 0, 0.5);
    expect(g.bounds.minY).toBeLessThan(96);
    chips(g.clear(), 100, 100, 1, 0, 1);
    expect(g.bounds.minY).toBeCloseTo(96);
  });
});
