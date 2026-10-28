import { Container } from 'pixi.js';
import { afterEach, describe, expect, it } from 'vitest';
import { ticks, TICK_RATE } from '../sim/math/fixed';
import { BRAD_FULL } from '../sim/math/trig';
import { BALANCE, type Enemy, type EnemyKind } from '../sim/types';
import { SpriteLayer } from './art';
import { poseEnemy } from './enemyPose';
import { turnView } from './landView';
import { blankTexture } from './potionKit';
import { ENEMY_ART } from './shapes';

const TEX = blankTexture(50, 100);
const R = 20;
const X = 400;
const Y = 600;
/** Where its feet stand on the ground, and how tall it is drawn, before any hop. */
const GROUND = Y + R * ENEMY_ART.feet;
const TALL = R * ENEMY_ART.height;

function enemy(kind: EnemyKind, over: Partial<Enemy> = {}): Enemy {
  return { id: 0, kind, x: X, y: Y, radius: R, atWall: false, ...over } as Enemy;
}

function pose(e: Enemy, t = 0, seconds = 0) {
  const layer = new SpriteLayer();
  layer.begin();
  return poseEnemy(layer, TEX, e, t, seconds);
}

/** The step phase poseEnemy uses for `kind` at view time `t`. */
function step(kind: EnemyKind, t: number, id = 0): number {
  return t * 9 * Math.sqrt(BALANCE.enemies[kind].speed / BALANCE.enemies.grunt.speed) + id * 1.7;
}

afterEach(() => turnView(new Container(), false));

describe('poseEnemy', () => {
  it('stands a walker on its feet at rest, swaying and squashed by its step', () => {
    const s = pose(enemy('grunt'));
    expect([s.x, s.y]).toEqual([X, GROUND]);
    expect(s.texture).toBe(TEX);
    expect(s.scale.x).toBeCloseTo(TALL / 100);
    expect(s.scale.y).toBeCloseTo((TALL / 100) * 0.96);
    expect(s.rotation).toBeCloseTo(0.07);
  });

  it('hops a walker mid-step, quicker walkers stepping faster', () => {
    for (const kind of ['grunt', 'runner', 'brute', 'clock', 'tripod'] as const) {
      const st = step(kind, 0.1, 3);
      const hop = Math.abs(Math.sin(st));
      const s = pose(enemy(kind, { id: 3 }), 0.1);
      expect(s.y, kind).toBeCloseTo(GROUND - hop * 8);
      expect(s.rotation, kind).toBeCloseTo(Math.cos(st) * 0.07);
      expect(s.scale.y, kind).toBeCloseTo((TALL / 100) * (0.96 + hop * 0.06));
    }
    expect(step('runner', 1)).toBeGreaterThan(step('grunt', 1));
  });

  it('rolls the tank on its tracks: a low rumble, no lean, no squash', () => {
    const st = step('boss', 0.13);
    const s = pose(enemy('boss'), 0.13);
    expect(s.y).toBeCloseTo(GROUND - Math.abs(Math.sin(st * 3)) * 0.3 * 8);
    expect(s.rotation).toBe(0);
    expect(s.scale.y).toBeCloseTo(TALL / 100);
  });

  it('flies a flyer over its shadow, bobbing with its wings and leaning into its weave', () => {
    const s = pose(enemy('flyer'));
    expect(s.y).toBeCloseTo(GROUND - R * ENEMY_ART.lift);
    expect(s.scale.y).toBeCloseTo((TALL / 100) * 0.97);
    expect(s.rotation).toBeCloseTo(0.14);
    expect(pose(enemy('flyer', { phase: BRAD_FULL / 2 })).rotation).toBeCloseTo(-0.14);
    const later = Math.cos(2 * BALANCE.flyer.weaveRate) * 0.14;
    expect(pose(enemy('flyer'), 0, 2).rotation).toBeCloseTo(later);
    const beat = Math.sin(0.1 * 14);
    expect(pose(enemy('flyer'), 0.1).y).toBeCloseTo(GROUND - R * ENEMY_ART.lift - beat * 6);
  });

  it('holds a flyer level once it is at the wall', () => {
    expect(pose(enemy('flyer', { atWall: true })).rotation).toBe(0);
  });

  it('scuttles a winder low, and jolts it taller as it winds the others back', () => {
    const st = step('winder', 0.2);
    const s = pose(enemy('winder'), 0.2);
    expect(s.y).toBeCloseTo(GROUND - Math.abs(Math.sin(st * 2)) * 0.35 * 8);
    expect(s.rotation).toBeCloseTo(Math.sin(st * 2) * 0.03);
    expect(s.scale.x).toBeCloseTo(TALL / 100);
    const every = BALANCE.winder.every;
    expect(pose(enemy('winder', { windTime: ticks(every - 1) })).scale.x).toBeCloseTo(TALL / 100);
    expect(pose(enemy('winder', { windTime: every * TICK_RATE })).scale.x).toBeCloseTo((TALL / 100) * 1.12);
    expect(pose(enemy('winder', { windTime: (every - 0.15) * TICK_RATE })).scale.x).toBeCloseTo((TALL / 100) * 1.06);
  });

  it('sails an anvil up in an arc mid-leap, stretched tall', () => {
    const flight = ticks(BALANCE.bosses.anvil.leapTime);
    const s = pose(enemy('anvil', { leapTime: flight / 2 }));
    expect(s.y).toBeCloseTo(GROUND - 130);
    expect(s.scale.y).toBeCloseTo((TALL / 100) * 1.1);
    expect(s.scale.x).toBeCloseTo((TALL / 100) * 0.95);
    expect(s.rotation).toBe(0);
    expect(pose(enemy('anvil', { leapTime: flight })).y).toBeCloseTo(GROUND);
  });

  it('crouches an anvil in the last ticks before a leap, but not at the wall', () => {
    const s = pose(enemy('anvil', { hopTime: 4, leapTime: 0 }));
    expect(s.scale.y).toBeCloseTo((TALL / 100) * 0.91);
    expect(s.scale.x).toBeCloseTo((TALL / 100) * 1.05);
    for (const over of [{ hopTime: 8 }, { hopTime: 4, atWall: true }, {}]) {
      const still = pose(enemy('anvil', over));
      expect(still.scale.y).toBeCloseTo(TALL / 100);
      expect(still.scale.x).toBeCloseTo(TALL / 100);
    }
    const st = step('anvil', 0.3);
    expect(pose(enemy('anvil'), 0.3).y).toBeCloseTo(GROUND - Math.abs(Math.sin(st * 1.5)) * 0.4 * 6);
  });

  it('rolls the gear king from side to side, and scurries its bare core smaller and quicker', () => {
    const st = step('gear', 0.25);
    const rim = pose(enemy('gear'), 0.25);
    expect(rim.y).toBeCloseTo(GROUND - Math.abs(Math.sin(st)) * 4);
    expect(rim.rotation).toBeCloseTo(Math.sin(st * 0.8) * 0.12);
    expect(rim.scale.x).toBeCloseTo(TALL / 100);
    const core = pose(enemy('gear', { core: true }), 0.25);
    expect(core.y).toBeCloseTo(GROUND - Math.abs(Math.sin(st * 2)) * 10);
    expect(core.rotation).toBeCloseTo(Math.sin(st * 2) * 0.06);
    expect(core.scale.x).toBeCloseTo((TALL / 100) * 0.8);
  });

  it('lifts it sideways on a field lying on its side', () => {
    turnView(new Container(), true);
    const s = pose(enemy('flyer'));
    expect(s.x).toBeCloseTo(X + R * ENEMY_ART.feet - R * ENEMY_ART.lift);
    expect(s.y).toBe(Y);
  });

  it('puts each enemy in a sprite of its own in the layer', () => {
    const layer = new SpriteLayer();
    layer.begin();
    const a = poseEnemy(layer, TEX, enemy('grunt'), 0, 0);
    const b = poseEnemy(layer, TEX, enemy('gear', { x: 100 }), 0, 0);
    expect(a).not.toBe(b);
    expect(layer.children).toEqual([a, b]);
    expect(b.x).toBe(100);
  });
});
