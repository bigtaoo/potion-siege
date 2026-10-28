// The shapes that stand in for heroes and enemies while there is no art (shapes.ts).
import { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { Enemy } from '../sim/types';
import { artBarTop, barsShown, drawEnemy, drawHero } from './shapes';

describe('a hero drawn as a shape', () => {
  it('is a rounded square for poison and a wide oval for wind', () => {
    const shape = (kind: 'poison' | 'wind') => {
      const g = new Graphics();
      drawHero(g, kind, 0, 0, 100);
      return g.bounds;
    };
    // 1.6 and 1.9 radii across, plus the outline
    expect(shape('poison').width).toBeCloseTo(167);
    expect(shape('wind').width).toBeCloseTo(197);
  });
});

describe('an enemy drawn as a shape', () => {
  const enemy = (o: Partial<Enemy> = {}) =>
    ({ kind: 'tripod', x: 500, y: 800, radius: 40, hp: 50, maxHp: 100, freezeTime: 0, burnTime: 0, poisonTime: 0, slowTime: 0, ...o }) as Enemy;

  it("puts the bell jar's own bar just above its health bar", () => {
    const plain = new Graphics();
    drawEnemy(plain, enemy());
    const jar = new Graphics();
    drawEnemy(jar, enemy({ shieldMax: 60, shield: 30 }));
    expect(plain.bounds.minY - jar.bounds.minY).toBeCloseTo(14);
  });
});

describe('an enemy shape in its states', () => {
  const enemy = (o: Partial<Enemy> = {}) =>
    ({ kind: 'grunt', x: 500, y: 800, radius: 40, hp: 100, maxHp: 100, freezeTime: 0, burnTime: 0, poisonTime: 0, slowTime: 0, ...o }) as Enemy;
  const width = (o: Partial<Enemy>, art: 'under' | 'over' | null = null) => {
    const g = new Graphics();
    drawEnemy(g, enemy(o), art);
    return g.bounds.width;
  };

  it('rings a burning or poisoned one, and a frozen one wears ice but no slow ring', () => {
    const bare = width({});
    expect(width({ burnTime: 1 })).toBeGreaterThan(bare);
    expect(width({ poisonTime: 1 })).toBeGreaterThan(bare);
    expect(width({ freezeTime: 1, slowTime: 1 })).toBe(bare);
    expect(width({ slowTime: 1 })).toBeGreaterThan(width({ burnTime: 1 }));
  });

  it('frames an elite bar in gold, and draws nothing over the art of a plain one', () => {
    expect(width({ elite: true })).toBeGreaterThan(width({ hp: 50 }));
    expect(width({}, 'over')).toBe(0);
  });

  it('reads a missing jar as empty: bars show and the jar bar has no fill', () => {
    expect(barsShown(enemy({ shieldMax: 40 }))).toBe(true);
    const g = new Graphics();
    drawEnemy(g, enemy({ kind: 'tripod', shieldMax: 40 }));
    expect(g.bounds.width).toBeGreaterThan(0);
  });

  it('hangs a flyer\'s bars higher over its art', () => {
    expect(artBarTop(enemy({ kind: 'flyer' }))).toBeLessThan(artBarTop(enemy()));
  });
});
