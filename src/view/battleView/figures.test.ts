import { Container, Graphics, type Sprite } from 'pixi.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BALANCE } from '../../sim/types';
import { SpriteLayer } from '../art';
import { fakeArt } from '../fakeArt';
import { turnView } from '../landView';
import { PotionLayer } from '../potion';
import { drawCell, STILL, type FigureAnim } from './figures';

const TOP = BALANCE.maxStar;

function cell() {
  const c = { under: new Graphics(), over: new Graphics(), art: new SpriteLayer(), potions: new PotionLayer() };
  const draw = (star: number, o: { x?: number; y?: number; size?: number; dim?: boolean; anim?: (i: number) => FigureAnim } = {}) => {
    c.art.begin();
    c.potions.begin();
    drawCell(1, c.under.clear(), c.over.clear(), c.art, c.potions, 'fire', star, o.x ?? 500, o.y ?? 1000, o.size ?? 1, 1, 0, o.dim, o.anim);
    c.art.end();
    c.potions.end();
  };
  const shown = () => ({
    art: c.art.children.filter((s) => s.visible) as Sprite[],
    potions: c.potions.children.filter((p) => p.visible),
  });
  return { ...c, draw, shown };
}

describe('the heroes of a cell', () => {
  it('stands in as shapes while there is no art', () => {
    const c = cell();
    c.draw(2);
    expect(c.over.bounds.width).toBeGreaterThan(0);
    expect(c.shown().potions.length).toBe(0);
    c.draw(TOP);
    expect(c.under.bounds.width).toBeGreaterThan(0);
    expect(c.shown().art.length).toBe(0);
  });

  describe('with the art', () => {
    beforeAll(fakeArt);
    afterEach(() => turnView(new Container(), false));

    it('shows as many potions as the cell\'s level, and one big hero at the top level', () => {
      const c = cell();
      for (let star = 1; star < TOP; star++) {
        c.draw(star);
        expect([c.shown().potions.length, c.shown().art.length]).toEqual([star, 0]);
      }
      c.draw(TOP);
      expect([c.shown().potions.length, c.shown().art.length]).toEqual([0, 1]);
    });

    it('leaves out a figure that is still fusing', () => {
      const c = cell();
      c.draw(3, { anim: (i) => (i === 1 ? { ...STILL, pop: -1 } : STILL) });
      expect(c.shown().potions.length).toBe(2);
      c.draw(TOP, { anim: () => ({ ...STILL, pop: -0.1 }) });
      expect(c.shown().art.length).toBe(0);
      expect(c.under.bounds.width).toBe(0);
    });

    it('turns the big hero as it dives and spins, and greys it while dimmed', () => {
      const c = cell();
      c.draw(TOP, { anim: () => ({ ...STILL, tilt: 1, spin: 0.25 }) });
      expect(c.shown().art[0].rotation).toBeCloseTo(1.25);
      const bright = c.shown().art[0].tint;
      c.draw(TOP, { dim: true });
      expect(c.shown().art[0].rotation).toBe(0);
      expect(c.shown().art[0].tint).not.toBe(bright);
    });

    it('squashes the big hero as a merge lands in it, and grows it as it pops in', () => {
      const c = cell();
      c.draw(TOP);
      const still = c.shown().art[0].scale.clone();
      c.draw(TOP, { anim: () => ({ ...STILL, squash: 0.3 }) });
      const s = c.shown().art[0].scale;
      expect(s.x).toBeGreaterThan(still.x);
      expect(s.y).toBeLessThan(still.y);
      c.draw(TOP, { anim: () => ({ ...STILL, pop: 0 }) });
      expect(c.shown().art[0].scale.x).toBeLessThan(still.x);
    });

    it('puts the feet below the cell\'s middle on the screen, upright and on a field on its side', () => {
      const c = cell();
      c.draw(TOP, { size: 0.5 });
      expect(c.shown().art[0].position).toMatchObject({ x: 500, y: 1025 });
      turnView(new Container(), true);
      c.draw(TOP, { size: 0.5 });
      expect(c.shown().art[0].position).toMatchObject({ x: 525, y: 1000 });
    });

    it('lines the potions of a cell up across the screen, upright and on a field on its side', () => {
      const c = cell();
      c.draw(2);
      const [a, b] = c.shown().potions;
      expect(b.x - a.x).toBe(56);
      expect(b.y).toBe(a.y);
      turnView(new Container(), true);
      c.draw(2);
      const [p, q] = c.shown().potions;
      expect(p.y - q.y).toBe(56);
      expect(q.x).toBe(p.x);
    });
  });
});
