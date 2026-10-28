import { Container, Graphics, type Sprite } from 'pixi.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Battle } from '../../sim/battle';
import { FP } from '../../sim/math/fixed';
import { battleSetup, newMeta } from '../../sim/meta';
import { BALANCE, type Enemy } from '../../sim/types';
import { fakeArt } from '../fakeArt';
import { turnView } from '../landView';
import { EnemyLayer } from './enemies';

/** An enemy at (x, y) in world units, stored in the sim's fixed point. */
function foe(id: number, x: number, y: number, o: Partial<Enemy> = {}): Enemy {
  return {
    id, kind: 'grunt', x: x * FP, y: y * FP, px: x * FP, py: y * FP, hp: 100, maxHp: 100, radius: 40 * FP,
    freezeTime: 0, slowTime: 0, burnTime: 0, chargeTime: 0, markTime: 0, rust: 0, poisonTime: 0, ...o,
  } as Enemy;
}

function layer() {
  const enemies = new EnemyLayer();
  const b = new Battle(1, battleSetup(newMeta(), 1));
  const w = new Graphics();
  const u = new Graphics();
  const draw = (list: Enemy[]) => {
    b.enemies = list;
    enemies.draw(b, 1, 1, w.clear(), u.clear());
    const vis = (c: Container) => c.children.filter((s) => s.visible) as Sprite[];
    return { art: vis(enemies.art), shadows: vis(enemies.marks.shadows), bars: vis(enemies.marks.bars) };
  };
  return { enemies, w, u, draw };
}

describe('the enemies as drawn', () => {
  it('stands in as shapes, with no shadows or bars, while there is no art', () => {
    const { w, draw } = layer();
    const drawn = draw([foe(1, 400, 600, { hp: 10 })]);
    expect([drawn.art.length, drawn.shadows.length, drawn.bars.length]).toEqual([0, 0, 0]);
    expect(w.bounds.width).toBeGreaterThan(0);
  });

  describe('with the art', () => {
    beforeAll(fakeArt);
    afterEach(() => turnView(new Container(), false));

    it('draws each enemy in its art with its shadow, and bars on the hurt ones', () => {
      const { draw } = layer();
      const drawn = draw([foe(1, 300, 600), foe(2, 500, 700, { hp: 50 })]);
      expect([drawn.art.length, drawn.shadows.length, drawn.bars.length]).toEqual([2, 2, 2]);
      expect(draw([]).art.length).toBe(0);
    });

    it('draws the farther ones first: higher on an upright field, farther right on one on its side', () => {
      const { draw } = layer();
      const foes = () => [foe(1, 300, 900), foe(2, 700, 400), foe(3, 500, 600)];
      // the shadows go in the same order as the art, at the feet
      expect(draw(foes()).shadows.map((s) => s.y)).toEqual([432, 632, 932]);
      turnView(new Container(), true);
      expect(draw(foes()).shadows.map((s) => s.x)).toEqual([332, 532, 732]);
    });

    it('draws an enemy between its last two ticks', () => {
      const { enemies, w, u } = layer();
      const b = new Battle(1, battleSetup(newMeta(), 1));
      b.enemies = [foe(1, 400, 700, { py: 600 * FP })];
      enemies.draw(b, 0.25, 1, w, u);
      expect(enemies.marks.shadows.children[0].y).toBe(625 + 32);
    });

    it('fades a rank of the horde in out of the haze, its shadow and bars waiting until it is out', () => {
      const { draw } = layer();
      const top = BALANCE.field.top;
      const drawn = draw([foe(1, 400, top - 40 - 1e4, { hp: 1 }), foe(2, 500, top - 40 - BALANCE.waves.horde.rowGap / 2, { hp: 1 })]);
      expect(drawn.art.length).toBe(1);
      expect(drawn.art[0].alpha).toBeCloseTo(0.5);
      expect(drawn.shadows.length + drawn.bars.length).toBe(0);
    });

    it('frames an elite under and over its art', () => {
      const { u, draw } = layer();
      draw([foe(1, 400, 600)]);
      expect(u.bounds.width).toBe(0);
      draw([foe(1, 400, 600, { elite: true })]);
      expect(u.bounds.width).toBeGreaterThan(0);
    });

    it('draws a frozen one in its shell of ice', () => {
      const { w, draw } = layer();
      draw([foe(1, 400, 600)]);
      expect(w.bounds.width).toBe(0);
      draw([foe(1, 400, 600, { freezeTime: 10 })]);
      expect(w.bounds.width).toBeGreaterThan(0);
      turnView(new Container(), true);
      draw([foe(1, 400, 600, { freezeTime: 10 })]);
      expect(w.bounds.width).toBeGreaterThan(0);
    });

    it('tints an enemy by its strongest status, ice first', () => {
      const { draw } = layer();
      const tint = (o: Partial<Enemy>) => draw([foe(1, 400, 600, o)]).art[0].tint;
      expect(tint({ freezeTime: 1, slowTime: 1 })).toBe(0x9fe8ff);
      expect(tint({ slowTime: 1, burnTime: 1 })).toBe(0xc4dcff);
      expect(tint({ burnTime: 1, chargeTime: 1 })).toBe(0xffb27a);
      expect(tint({ chargeTime: 1, markTime: 1 })).toBe(0xfff2a0);
      expect(tint({ markTime: 1, rust: 1 })).toBe(0xdcb8ff);
      expect(tint({ rust: 1, poisonTime: 1 })).toBe(0xe0a878);
      expect(tint({ poisonTime: 1 })).toBe(0xc8f0a0);
      expect(tint({})).toBe(0xffffff);
    });

    it('does not carry a boss\'s jar bar over to a new enemy in its place', () => {
      const { draw } = layer();
      expect(draw([foe(1, 400, 600, { kind: 'tripod', hp: 50, shieldMax: 40, shield: 20 })]).bars.length).toBe(4);
      expect(draw([foe(2, 400, 600, { hp: 50 })]).bars.length).toBe(2);
    });
  });
});
