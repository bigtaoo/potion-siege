// How an enemy's sprite stands on the field each frame: the step of its kind (enemyGait), the
// flyer's wingbeat, the anvil's leap and slam, the winder's jolt, the bosses' tells before they
// act, its blows on the wall, and how it takes a hit, a knock back or a whirlwind (BattleView
// puts one per enemy).

import type { Sprite, Texture } from 'pixi.js';
import { ticks, TICK_RATE } from '../sim/math/fixed';
import { BRAD_FULL } from '../sim/math/trig';
import { BALANCE, type Enemy } from '../sim/types';
import type { SpriteLayer } from './art';
import { bash, bashPhase, stepPhase, walk } from './enemyGait';
import { aside } from './landView';
import { ENEMY_ART } from './shapes';

/** What is happening to an enemy besides its walk, each 0 when nothing is. */
export interface Reaction {
  /** 1 as a hit lands, back to 0 over a moment. */
  hit: number;
  /** 1 as a wind hit knocks it back, down to 0 as it lands. */
  push: number;
  /** Extra turn in radians while a whirlwind has hold of it. */
  spin: number;
}
export const CALM: Reaction = { hit: 0, push: 0, spin: 0 };

/** Seconds of warning a boss gives before it acts (the clock's brood, the tripod's new jar). */
const TELL = 0.5;
/** Ticks the anvil crouches before a slam at the wall, and spends up in the air after. */
const SLAM_CROUCH = 10;
const SLAM_UP = 8;

/** Puts `e` (as drawn: world units, radius included) into `layer` with `tex`, posed for battle
 *  time `t` (seconds, between ticks, so it stops with the battle and keeps its pace). */
export function poseEnemy(layer: SpriteLayer, tex: Texture, e: Enemy, t: number, react: Reaction = CALM): Sprite {
  const h = e.radius * ENEMY_ART.height;
  // how far it reaches toward the wall, scaled to its size
  const reach = e.radius / 30;
  let up = 0;
  let fwd = 0;
  let rot = 0;
  let sx = 1;
  let sy = 1;
  const frozen = e.freezeTime > 0;
  const blows = e.atWall && !frozen && e.kind !== 'anvil';
  if (e.kind === 'flyer') {
    // up in the air over its shadow: it bobs with the wingbeat and leans into its swing
    const beat = frozen ? 0 : Math.sin(t * 14 + e.id * 1.7);
    up = e.radius * ENEMY_ART.lift + beat * 6;
    sy = 0.97 + beat * 0.03;
    rot = e.atWall || frozen ? 0 : Math.cos(((e.phase ?? 0) / BRAD_FULL) * 2 * Math.PI + t * BALANCE.flyer.weaveRate) * 0.14;
  } else if (frozen) {
    // stuck fast in its block of ice
  } else if (e.kind === 'winder') {
    // eight legs: a quick low scuttle, and a jolt each time it winds the others back
    const s = stepPhase(e);
    const jolt = Math.max(0, (e.windTime ?? 0) / TICK_RATE - (BALANCE.winder.every - 0.3)) / 0.3;
    up = Math.abs(Math.sin(s * 2)) * 0.35 * 8;
    rot = Math.sin(s * 2) * 0.03;
    sx = sy = 1 + jolt * 0.12;
  } else if (e.kind === 'anvil') {
    ({ up, sx, sy } = anvil(e));
  } else if (e.kind === 'gear') {
    // the cog rolls from side to side; the bare core scurries on its legs
    const s = stepPhase(e);
    const core = !!e.core;
    up = Math.abs(Math.sin(s * (core ? 2 : 1))) * (core ? 10 : 4);
    rot = core ? Math.sin(s * 2) * 0.06 : Math.sin(s * 0.8) * 0.12;
    sx = sy = core ? 0.8 : 1;
  } else {
    ({ up, rot, sx, sy } = walk(e.kind, stepPhase(e)));
  }
  if (!frozen) {
    const tell = bossTell(e);
    if (tell > 0) {
      sx *= 1 + 0.1 * tell;
      sy *= 1 + 0.08 * tell;
      rot += Math.sin(t * 40) * 0.05 * tell;
    }
  }
  if (blows) {
    const b = bash(bashPhase(e, t));
    // a flyer dives at the wall instead of stepping into it
    if (e.kind === 'flyer') up -= b.fwd * 0.8;
    fwd += b.fwd * reach;
    up += b.up;
    sy *= b.sy;
  }
  if (react.hit > 0) {
    // knocked back a little and squashed by the blow
    fwd -= 5 * reach * react.hit;
    sx *= 1 + 0.08 * react.hit;
    sy *= 1 - 0.1 * react.hit;
  }
  if (react.push > 0) {
    // thrown off its feet, tumbling, then down again
    const k = 1 - react.push;
    up += 14 * 4 * k * react.push;
    rot += Math.sin(k * Math.PI * 3) * 0.25 * react.push;
  }
  rot += react.spin;
  const p = aside(e.x, e.y + fwd, 0, e.radius * ENEMY_ART.feet - up);
  const s = layer.put(tex, p.x, p.y, h);
  s.scale.x *= sx;
  s.scale.y *= sy;
  s.rotation = rot;
  return s;
}

/** The anvil on its spring: it crouches before a leap, sails up in an arc, squashes as it lands;
 *  at the wall it crouches before each slam and bounds up as it comes down. */
function anvil(e: Enemy): { up: number; sx: number; sy: number } {
  const A = BALANCE.bosses.anvil;
  if (e.atWall) {
    const hop = e.hopTime ?? Infinity;
    const crouch = hop < SLAM_CROUCH ? 1 - hop / SLAM_CROUCH : 0;
    const since = ticks(A.slamEvery) - hop;
    const air = since >= 0 && since < SLAM_UP ? Math.sin((Math.PI * since) / SLAM_UP) : 0;
    return { up: air * 40, sx: 1 + crouch * 0.12, sy: 1 - crouch * 0.22 + air * 0.08 };
  }
  const up = e.leapTime ? Math.sin(Math.PI * (1 - e.leapTime / ticks(A.leapTime))) : 0;
  const crouch = !e.leapTime && e.hopTime !== undefined && e.hopTime < 8 ? 1 - e.hopTime / 8 : 0;
  const bob = Math.abs(Math.sin(stepPhase(e) * 1.5)) * 0.4;
  return { up: up * 130 + bob * 6, sx: 1 + crouch * 0.1 - up * 0.05, sy: 1 - crouch * 0.18 + up * 0.1 };
}

/** 0-1: how close a boss is to acting, over its last TELL seconds (the clock opening its door on
 *  a brood, the bare tripod growing its jar back). */
export function bossTell(e: Enemy): number {
  const tell = ticks(TELL);
  if (e.kind === 'clock' && e.broodTime !== undefined && e.broodTime < tell) return 1 - e.broodTime / tell;
  if (e.kind === 'tripod' && e.shieldMax && !e.shield && e.shieldTime !== undefined && e.shieldTime < tell) return 1 - e.shieldTime / tell;
  return 0;
}
