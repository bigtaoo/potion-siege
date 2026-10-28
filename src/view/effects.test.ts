import { describe, expect, it } from 'vitest';
import type { Graphics } from 'pixi.js';
import type { HeroKind } from '../sim/types';
import { HIT_TIME, chainBolt, gearBurst, glassShards, gustWave, hitEffect, iceShell, pushLines, rewindWave, stunStars, vortexSwirl } from './effects';
import { INK } from './potion';

type Call = { m: string; args: unknown[] };
type Style = { color?: number; alpha?: number; width?: number };

/** A Graphics stand-in that keeps every call made on it, in order. */
function recorder(): { g: Graphics; calls: Call[] } {
  const calls: Call[] = [];
  const g: Graphics = new Proxy({} as Graphics, {
    get: (_, m: string) => (...args: unknown[]) => {
      calls.push({ m, args });
      return g;
    },
  });
  return { g, calls };
}

const draw = (fn: (g: Graphics) => void): Call[] => {
  const r = recorder();
  fn(r.g);
  return r.calls;
};
const named = (calls: Call[], m: string): Call[] => calls.filter((c) => c.m === m);
const styles = (calls: Call[], m: 'fill' | 'stroke'): Style[] => named(calls, m).map((c) => (typeof c.args[0] === 'object' ? (c.args[0] as Style) : { color: c.args[0] as number }));
const alphas = (calls: Call[]): number[] => [...styles(calls, 'fill'), ...styles(calls, 'stroke')].map((s) => s.alpha ?? 1);
const colors = (calls: Call[]): Set<number> => new Set([...styles(calls, 'fill'), ...styles(calls, 'stroke')].map((s) => s.color ?? -1));

const KINDS: (HeroKind | 'poison')[] = ['fire', 'ice', 'lightning', 'arcane', 'wind', 'poison'];

describe('hit effects', () => {
  it('last a short moment for every kind, poison included', () => {
    for (const k of KINDS) expect(HIT_TIME[k]).toBeGreaterThan(0.2);
    for (const k of KINDS) expect(HIT_TIME[k]).toBeLessThanOrEqual(0.4);
  });

  it('draw something inked for each kind at full strength early in their life', () => {
    for (const k of KINDS) {
      const calls = draw((g) => hitEffect(g, k, 300, 400, 80, 0.2));
      expect(calls.length, k).toBeGreaterThan(3);
      expect(colors(calls).has(INK), k).toBe(true);
      expect(alphas(calls).every((a) => a === 1), k).toBe(true);
    }
  });

  it('fade out over the last part of their life', () => {
    for (const k of ['fire', 'lightning', 'poison', 'wind'] as const) {
      const late = alphas(draw((g) => hitEffect(g, k, 300, 400, 80, 0.8)));
      expect(Math.max(...late), k).toBeCloseTo(0.5);
    }
  });

  it('grow a fire splash with the blast radius, and throw six embers', () => {
    const small = named(draw((g) => hitEffect(g, 'fire', 0, 0, 40, 0.5)), 'circle');
    const big = named(draw((g) => hitEffect(g, 'fire', 0, 0, 160, 0.5)), 'circle');
    expect(small).toHaveLength(7);
    expect(big[0].args[2] as number).toBeCloseTo((small[0].args[2] as number) * 4);
  });

  it('drop the snowflake from an ice hit late in its life, keeping the shards', () => {
    const early = draw((g) => hitEffect(g, 'ice', 0, 0, 60, 0.3));
    const late = draw((g) => hitEffect(g, 'ice', 0, 0, 60, 0.8));
    expect(named(early, 'circle')).toHaveLength(1);
    expect(named(late, 'circle')).toHaveLength(0);
    expect(named(late, 'poly')).toHaveLength(6);
  });

  it('let the arcane stars go out before the end', () => {
    expect(named(draw((g) => hitEffect(g, 'arcane', 0, 0, 60, 0.5)), 'poly')).toHaveLength(10);
    expect(draw((g) => hitEffect(g, 'arcane', 0, 0, 60, 0.9))).toHaveLength(0);
  });

  it('shrink the lightning flash to nothing as it ends', () => {
    const flash = (p: number) => named(draw((g) => hitEffect(g, 'lightning', 0, 0, 60, p)), 'circle')[0].args[2] as number;
    expect(flash(0)).toBe(18);
    expect(flash(0.5)).toBe(9);
    expect(flash(1)).toBe(0);
  });

  it('blow a leaf off with three curls of wind, and rise poison bubbles four at a time', () => {
    const wind = draw((g) => hitEffect(g, 'wind', 0, 0, 60, 0.4));
    expect(named(wind, 'poly')).toHaveLength(7);
    const bubbles = (p: number) => named(draw((g) => hitEffect(g, 'poison', 0, 0, 60, p)), 'circle');
    expect(bubbles(0.5)).toHaveLength(4);
    const y = (p: number) => bubbles(p).reduce((s, c) => s + (c.args[1] as number), 0);
    expect(y(0.9)).toBeLessThan(y(0.1));
  });
});

describe('the chain bolt', () => {
  it('runs through every point of the chain, with four jitter points between each pair', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const polys = named(draw((g) => chainBolt(g, points, 1)), 'poly');
    expect(polys).toHaveLength(3);
    const pts = polys[0].args[0] as number[];
    expect(pts).toHaveLength(2 * (1 + 2 * 5));
    expect(pts.slice(10, 12)).toEqual([100, 0]);
    expect(pts.slice(-2)).toEqual([100, 100]);
  });

  it('thins as its life runs out but stays solid', () => {
    const points = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    const widths = (life: number) => styles(draw((g) => chainBolt(g, points, life)), 'stroke').map((s) => s.width);
    expect(widths(1)).toEqual([26, 15, 6]);
    expect(widths(0)).toEqual([26 * 0.45, 15 * 0.45, 6 * 0.45]);
    expect(styles(draw((g) => chainBolt(g, points, 0)), 'stroke').every((s) => s.alpha === undefined)).toBe(true);
  });
});

describe('a clockwork enemy coming apart', () => {
  it('puffs smoke only in the first half, and throws more pieces for a boss', () => {
    const smoke = (p: number, boss = false) => named(draw((g) => gearBurst(g, 0, 0, boss, p)), 'circle').length;
    // three smoke puffs, then a hub for each of the gears (pieces not every third)
    expect(smoke(0.2)).toBe(3 + 4);
    expect(smoke(0.7)).toBe(4);
    expect(smoke(0.7, true)).toBe(6);
  });

  it('lets the pieces fall under gravity', () => {
    const hubs = (p: number) => named(draw((g) => gearBurst(g, 0, 0, false, p)), 'circle').map((c) => c.args[1] as number);
    expect(Math.min(...hubs(0.9))).toBeGreaterThan(Math.min(...hubs(0.3)));
  });
});

describe('frozen and winder effects', () => {
  it('stands the ice block on the enemy feet, a little taller than the sprite', () => {
    const rect = named(draw((g) => iceShell(g, 100, 500, 80, 120)), 'roundRect')[0].args;
    expect(rect.slice(0, 4)).toEqual([60, 500 - 126, 80, 132]);
  });

  it('spreads the rewind clock out to its radius and turns the hand back', () => {
    const at = (p: number) => draw((g) => rewindWave(g, 0, 0, 200, p));
    const ring = (p: number) => named(at(p), 'ellipse')[0].args[2] as number;
    expect(ring(0)).toBeCloseTo(70);
    expect(ring(0.6)).toBe(200);
    const ticks = named(at(0.3), 'lineTo').length;
    expect(ticks).toBe(12 + 2);
    const hand = (p: number) => named(at(p), 'lineTo')[12].args as number[];
    expect(hand(0)[0]).toBeCloseTo(0);
    expect(hand(0)[1]).toBeLessThan(0);
    expect(hand(1 / 3)[0]).toBeLessThan(0);
  });
});

describe('wind effects', () => {
  it('draws no gust streak before the wind has started', () => {
    expect(draw((g) => gustWave(g, 0, 1000, 300, 100, 0))).toHaveLength(0);
  });

  it('sweeps seven streaks across with leaves on every other one, never past the right edge by much', () => {
    const calls = draw((g) => gustWave(g, 0, 1000, 300, 100, 0.9));
    const streaks = named(calls, 'poly').filter((c) => c.args[1] === false);
    expect(streaks).toHaveLength(14);
    const leaves = named(calls, 'poly').filter((c) => c.args[1] === undefined);
    expect(leaves).toHaveLength(4);
    const xs = streaks.flatMap((c) => (c.args[0] as number[]).filter((_, i) => i % 2 === 0));
    expect(Math.max(...xs)).toBeLessThanOrEqual(1000);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
  });

  it('draws three speed lines under a pushed enemy, fading', () => {
    const calls = draw((g) => pushLines(g, 0, 0, 40, 0.9));
    expect(named(calls, 'moveTo')).toHaveLength(6);
    expect(alphas(calls).every((a) => a < 1)).toBe(true);
  });

  it('turns the whirlwind arms with time', () => {
    const arm = (t: number) => named(draw((g) => vortexSwirl(g, 0, 0, 100, t, 0.5)), 'poly')[0].args[0] as number[];
    expect(arm(0)).not.toEqual(arm(0.3));
    const calls = draw((g) => vortexSwirl(g, 0, 0, 100, 0, 0.5));
    expect(named(calls, 'poly')).toHaveLength(6);
    expect(styles(calls, 'fill')[0].alpha).toBeCloseTo(0.08);
  });
});

describe('boss and stun effects', () => {
  it('flashes a ring as the bell jar bursts, then only the twelve shards fly', () => {
    const early = draw((g) => glassShards(g, 0, 0, 0.1));
    const late = draw((g) => glassShards(g, 0, 0, 0.5));
    expect(named(early, 'circle')).toHaveLength(1);
    expect(named(late, 'circle')).toHaveLength(0);
    expect(named(late, 'poly')).toHaveLength(12);
  });

  it('circles three stars over a stunned cell', () => {
    const at = (t: number) => named(draw((g) => stunStars(g, 50, 50, t)), 'poly');
    expect(at(0)).toHaveLength(6);
    expect(at(0)[0].args[0]).not.toEqual(at(0.5)[0].args[0]);
  });
});
