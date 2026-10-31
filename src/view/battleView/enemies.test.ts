import { Container, Graphics, type Sprite } from 'pixi.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Battle } from '../../sim/battle';
import { FP } from '../../sim/math/fixed';
import { battleSetup, newMeta } from '../../sim/meta';
import { BALANCE, type Enemy } from '../../sim/types';
import { BASH_EVERY } from '../enemyGait';
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
  const draw = (list: Enemy[], now = 1, bt = 1) => {
    b.enemies = list;
    enemies.draw(b, 1, bt, now, w.clear(), u.clear());
    const vis = (c: Container) => c.children.filter((s) => s.visible) as Sprite[];
    return { art: vis(enemies.art), shadows: vis(enemies.marks.shadows), bars: vis(enemies.marks.bars), flash: vis(enemies.flash), dead: vis(enemies.dead) };
  };
  return { enemies, b, w, u, draw };
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
      enemies.draw(b, 0.25, 1, 1, w, u);
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

    it('lights one up white as a blow lands on it, not as it burns', () => {
      const { enemies, draw } = layer();
      draw([foe(1, 400, 600)], 1);
      expect(draw([foe(1, 400, 600, { hp: 90 })], 1.02).flash.length).toBe(0);
      enemies.tracks.strike(400, 600, 10);
      const lit = draw([foe(1, 400, 600, { hp: 80 })], 1.04).flash;
      expect(lit.length).toBe(1);
      expect(lit[0].blendMode).toBe('add');
      expect(draw([foe(1, 400, 600, { hp: 80 })], 1.5).flash.length).toBe(0);
    });

    it('leaves a wreck where one died, and forgets them all in a new battle', () => {
      const { enemies, draw } = layer();
      draw([foe(1, 400, 600)], 1);
      enemies.tracks.died(400, 600);
      const d = draw([], 1.02);
      expect(d.dead.length).toBe(1);
      expect(d.flash.length).toBe(1);
      expect(draw([], 2).dead.length).toBe(0);
      draw([foe(2, 400, 600)], 2);
      enemies.tracks.died(400, 600);
      enemies.soft = true;
      expect(draw([], 2.02).dead.length).toBe(1);
      enemies.draw(new Battle(2, battleSetup(newMeta(), 1)), 1, 1, 2.03, new Graphics(), new Graphics());
      expect(enemies.dead.children.filter((s) => s.visible).length).toBe(0);
    });

    it('tells of each blow one beats on the wall, but not frozen or as the anvil', () => {
      const { enemies, draw } = layer();
      const onBlow = vi.fn();
      enemies.onBlow = onBlow;
      const every = BASH_EVERY.grunt;
      // id 0 starts its swing at 0
      for (const c of [0.5, 0.75, 0.8]) draw([foe(0, 400, 600, { atWall: true })], c, c * every);
      expect(onBlow).toHaveBeenCalledTimes(1);
      expect(onBlow).toHaveBeenCalledWith(400, 600, 40, 'grunt');
      for (const c of [1.5, 1.75]) draw([foe(0, 400, 600, { atWall: true, freezeTime: 5 })], c, c * every);
      for (const c of [2.5, 2.75]) draw([foe(0, 400, 600, { atWall: true, kind: 'anvil' })], c, c * BASH_EVERY.anvil);
      expect(onBlow).toHaveBeenCalledTimes(1);
    });

    it('turns one caught in a whirlwind back and forth, but not a boss', () => {
      const { b, draw } = layer();
      const still = draw([foe(1, 400, 600)], 0.1).art[0].rotation;
      b.vortices.push({ x: 400 * FP, y: 600 * FP } as (typeof b.vortices)[number]);
      expect(draw([foe(1, 400, 600)], 0.1).art[0].rotation).toBeCloseTo(still + Math.sin(2.2) * 0.18);
      const boss = draw([foe(1, 400, 600, { kind: 'boss' })], 0.1).art[0].rotation;
      b.vortices.length = 0;
      expect(draw([foe(1, 400, 600, { kind: 'boss' })], 0.1).art[0].rotation).toBeCloseTo(boss);
    });

    it('does not carry a boss\'s jar bar over to a new enemy in its place', () => {
      const { draw } = layer();
      expect(draw([foe(1, 400, 600, { kind: 'tripod', hp: 50, shieldMax: 40, shield: 20 })]).bars.length).toBe(4);
      expect(draw([foe(2, 400, 600, { hp: 50 })]).bars.length).toBe(2);
    });
  });
});
