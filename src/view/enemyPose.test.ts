import { Container } from 'pixi.js';
import { afterEach, describe, expect, it } from 'vitest';
import { ticks, TICK_RATE } from '../sim/math/fixed';
import { BRAD_FULL } from '../sim/math/trig';
import { BALANCE, type Enemy, type EnemyKind } from '../sim/types';
import { SpriteLayer } from './art';
import { BASH_EVERY, bash, stepPhase, walk } from './enemyGait';
import { bossTell, poseEnemy, type Reaction } from './enemyPose';
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
const SIZE = TALL / 100;

function enemy(kind: EnemyKind, over: Partial<Enemy> = {}): Enemy {
  return { id: 0, kind, x: X, y: Y, radius: R, atWall: false, freezeTime: 0, ...over } as Enemy;
}

function pose(e: Enemy, t = 0, react?: Reaction) {
  const layer = new SpriteLayer();
  layer.begin();
  return poseEnemy(layer, TEX, e, t, react);
}

/** The time `kind`'s blow `c` of the way through, for id 0. */
const bashAt = (kind: EnemyKind, c: number): number => c * BASH_EVERY[kind];

afterEach(() => turnView(new Container(), false));

describe('poseEnemy', () => {
  it('stands each walker in the step of its kind for how far it has come', () => {
    for (const kind of ['grunt', 'runner', 'brute', 'boss', 'clock', 'tripod'] as const) {
      const e = enemy(kind, { id: 3 });
      const w = walk(kind, stepPhase(e));
      const s = pose(e);
      expect(s.texture).toBe(TEX);
      expect(s.x, kind).toBe(X);
      expect(s.y, kind).toBeCloseTo(GROUND - w.up);
      expect(s.rotation, kind).toBeCloseTo(w.rot);
      expect(s.scale.x, kind).toBeCloseTo(SIZE * w.sx);
      expect(s.scale.y, kind).toBeCloseTo(SIZE * w.sy);
    }
  });

  it('does not step with the clock: one standing still keeps its pose', () => {
    const e = enemy('grunt', { id: 2 });
    const a = pose(e, 0);
    const b = pose(e, 1.37);
    expect([b.y, b.rotation, b.scale.y]).toEqual([a.y, a.rotation, a.scale.y]);
    expect(pose(enemy('grunt', { id: 2, y: Y + 7 })).y).not.toBeCloseTo(a.y);
  });

  it('stands one frozen in its ice upright, unscaled, on the ground', () => {
    for (const kind of ['grunt', 'winder', 'anvil', 'gear', 'flyer'] as const) {
      const s = pose(enemy(kind, { id: 1, freezeTime: 5, leapTime: 4, hopTime: 3, atWall: kind === 'grunt' }), 0.3);
      const lift = kind === 'flyer' ? R * ENEMY_ART.lift : 0;
      expect(s.y, kind).toBeCloseTo(GROUND - lift);
      expect(s.rotation, kind).toBe(0);
      if (kind !== 'flyer') expect(s.scale.y, kind).toBeCloseTo(SIZE);
    }
  });

  it('flies a flyer over its shadow, bobbing with its wings and leaning into its weave', () => {
    const s = pose(enemy('flyer'));
    expect(s.y).toBeCloseTo(GROUND - R * ENEMY_ART.lift);
    expect(s.scale.y).toBeCloseTo(SIZE * 0.97);
    expect(s.rotation).toBeCloseTo(0.14);
    expect(pose(enemy('flyer', { phase: BRAD_FULL / 2 })).rotation).toBeCloseTo(-0.14);
    const later = Math.cos(2 * BALANCE.flyer.weaveRate) * 0.14;
    expect(pose(enemy('flyer'), 2).rotation).toBeCloseTo(later);
    expect(pose(enemy('flyer'), 0.1).y).toBeCloseTo(GROUND - R * ENEMY_ART.lift - Math.sin(1.4) * 6);
  });

  it('scuttles a winder low, and jolts it taller as it winds the others back', () => {
    const e = enemy('winder');
    const st = stepPhase(e);
    const s = pose(e);
    expect(s.y).toBeCloseTo(GROUND - Math.abs(Math.sin(st * 2)) * 0.35 * 8);
    expect(s.rotation).toBeCloseTo(Math.sin(st * 2) * 0.03);
    expect(s.scale.x).toBeCloseTo(SIZE);
    const every = BALANCE.winder.every;
    expect(pose(enemy('winder', { windTime: ticks(every - 1) })).scale.x).toBeCloseTo(SIZE);
    expect(pose(enemy('winder', { windTime: every * TICK_RATE })).scale.x).toBeCloseTo(SIZE * 1.12);
    expect(pose(enemy('winder', { windTime: (every - 0.15) * TICK_RATE })).scale.x).toBeCloseTo(SIZE * 1.06);
  });

  it('sails an anvil up in an arc mid-leap, stretched tall', () => {
    const flight = ticks(BALANCE.bosses.anvil.leapTime);
    const s = pose(enemy('anvil', { leapTime: flight / 2 }));
    const bob = Math.abs(Math.sin(stepPhase(enemy('anvil')) * 1.5)) * 0.4 * 6;
    expect(s.y).toBeCloseTo(GROUND - 130 - bob);
    expect(s.scale.y).toBeCloseTo(SIZE * 1.1);
    expect(s.scale.x).toBeCloseTo(SIZE * 0.95);
    expect(s.rotation).toBe(0);
    expect(pose(enemy('anvil', { leapTime: flight })).y).toBeCloseTo(GROUND - bob);
  });

  it('crouches an anvil in the last ticks before a leap', () => {
    const s = pose(enemy('anvil', { hopTime: 4, leapTime: 0 }));
    expect(s.scale.y).toBeCloseTo(SIZE * 0.91);
    expect(s.scale.x).toBeCloseTo(SIZE * 1.05);
    for (const over of [{ hopTime: 8 }, {}]) {
      const still = pose(enemy('anvil', over));
      expect(still.scale.y).toBeCloseTo(SIZE);
    }
  });

  it('crouches an anvil at the wall before each slam and bounds it up after', () => {
    const every = ticks(BALANCE.bosses.anvil.slamEvery);
    const crouched = pose(enemy('anvil', { atWall: true, hopTime: 5 }));
    expect(crouched.scale.y).toBeCloseTo(SIZE * (1 - 0.5 * 0.22));
    expect(crouched.scale.x).toBeCloseTo(SIZE * 1.06);
    expect(crouched.y).toBeCloseTo(GROUND);
    const up = pose(enemy('anvil', { atWall: true, hopTime: every - 4 }));
    expect(up.y).toBeCloseTo(GROUND - 40);
    expect(up.scale.y).toBeCloseTo(SIZE * 1.08);
    // it slams, it does not bash
    expect(pose(enemy('anvil', { atWall: true, hopTime: every / 2 }), bashAt('anvil', 0.7)).y).toBeCloseTo(GROUND);
  });

  it('rolls the gear king from side to side, and scurries its bare core smaller and quicker', () => {
    const st = stepPhase(enemy('gear'));
    const rim = pose(enemy('gear'));
    expect(rim.y).toBeCloseTo(GROUND - Math.abs(Math.sin(st)) * 4);
    expect(rim.rotation).toBeCloseTo(Math.sin(st * 0.8) * 0.12);
    expect(rim.scale.x).toBeCloseTo(SIZE);
    const core = pose(enemy('gear', { core: true }));
    expect(core.y).toBeCloseTo(GROUND - Math.abs(Math.sin(st * 2)) * 10);
    expect(core.rotation).toBeCloseTo(Math.sin(st * 2) * 0.06);
    expect(core.scale.x).toBeCloseTo(SIZE * 0.8);
  });

  it('beats on the wall: rears back, lunges into it scaled to its size, settles', () => {
    const e = enemy('grunt', { atWall: true });
    const w = walk('grunt', stepPhase(e));
    for (const c of [0.3, 0.6, 0.7, 0.9]) {
      const b = bash(c);
      const s = pose(e, bashAt('grunt', c));
      expect(s.y, String(c)).toBeCloseTo(GROUND + b.fwd * (R / 30) - w.up - b.up);
      expect(s.scale.y, String(c)).toBeCloseTo(SIZE * w.sy * b.sy);
    }
    // the lunge at the impact is the deepest
    expect(pose(e, bashAt('grunt', 0.7)).y).toBeGreaterThan(pose(e, bashAt('grunt', 0.3)).y);
  });

  it('dives a flyer at the wall instead, held level', () => {
    const e = enemy('flyer', { atWall: true });
    const b = bash(0.7);
    const s = pose(e, bashAt('flyer', 0.7));
    expect(s.rotation).toBe(0);
    expect(s.y).toBeCloseTo(GROUND + b.fwd * (R / 30) - R * ENEMY_ART.lift - Math.sin(0.7 * BASH_EVERY.flyer * 14) * 6 + b.fwd * 0.8);
  });

  it('swells a boss and shakes it in the moment before it acts', () => {
    const tell = ticks(0.5);
    expect(bossTell(enemy('clock', { broodTime: tell / 2 }))).toBeCloseTo(0.5);
    expect(bossTell(enemy('clock', { broodTime: tell }))).toBe(0);
    expect(bossTell(enemy('tripod', { shieldMax: 50, shield: 0, shieldTime: 0 }))).toBe(1);
    expect(bossTell(enemy('tripod', { shieldMax: 50, shield: 10, shieldTime: 0 }))).toBe(0);
    expect(bossTell(enemy('grunt'))).toBe(0);
    const calm = pose(enemy('clock'), 0.01);
    const s = pose(enemy('clock', { broodTime: 0 }), 0.01);
    expect(s.scale.x).toBeCloseTo(calm.scale.x * 1.1);
    expect(s.scale.y).toBeCloseTo(calm.scale.y * 1.08);
    expect(s.rotation).toBeCloseTo(calm.rotation + Math.sin(0.4) * 0.05);
    expect(pose(enemy('clock', { broodTime: 0, freezeTime: 3 })).scale.x).toBeCloseTo(SIZE);
  });

  it('knocks one hit back and squashes it', () => {
    const e = enemy('grunt');
    const calm = pose(e);
    const s = pose(e, 0, { hit: 1, push: 0, spin: 0 });
    expect(s.y).toBeCloseTo(calm.y - 5 * (R / 30));
    expect(s.scale.x).toBeCloseTo(calm.scale.x * 1.08);
    expect(s.scale.y).toBeCloseTo(calm.scale.y * 0.9);
  });

  it('throws one pushed off its feet, tumbling, and turns one in a whirlwind', () => {
    const e = enemy('grunt');
    const calm = pose(e);
    const s = pose(e, 0, { hit: 0, push: 0.5, spin: 0 });
    expect(s.y).toBeCloseTo(calm.y - 14);
    expect(s.rotation).toBeCloseTo(calm.rotation + Math.sin(Math.PI * 1.5) * 0.125);
    expect(pose(e, 0, { hit: 0, push: 1, spin: 0 }).y).toBeCloseTo(calm.y);
    expect(pose(e, 0, { hit: 0, push: 0, spin: 0.2 }).rotation).toBeCloseTo(calm.rotation + 0.2);
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
    const a = poseEnemy(layer, TEX, enemy('grunt'), 0);
    const b = poseEnemy(layer, TEX, enemy('gear', { x: 100 }), 0);
    expect(a).not.toBe(b);
    expect(layer.children).toEqual([a, b]);
    expect(b.x).toBe(100);
  });
});
