// The shapes that stand in for heroes and enemies while there is no art (shapes.ts).
import { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { Enemy } from '../sim/types';
import { drawEnemy, drawHero } from './shapes';

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
