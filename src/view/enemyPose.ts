// How an enemy's sprite stands on the field each frame: the walk, hop or roll of its kind, the
// flyer's wingbeat, the anvil's leap, the winder's jolt (BattleView puts one per enemy).

import type { Sprite, Texture } from 'pixi.js';
import { ticks, TICK_RATE } from '../sim/math/fixed';
import { BRAD_FULL } from '../sim/math/trig';
import { BALANCE, type Enemy } from '../sim/types';
import type { SpriteLayer } from './art';
import { aside } from './landView';
import { ENEMY_ART } from './shapes';

/** Puts `e` (as drawn: world units, radius included) into `layer` with `tex`, posed for view time
 *  `t` and battle time `seconds`. */
export function poseEnemy(layer: SpriteLayer, tex: Texture, e: Enemy, t: number, seconds: number): Sprite {
  // waddle: hop and sway, out of step with each other, faster walkers taking quicker steps
  const step = t * 9 * Math.sqrt(BALANCE.enemies[e.kind].speed / BALANCE.enemies.grunt.speed) + e.id * 1.7;
  let s: Sprite;
  if (e.kind === 'flyer') {
    // up in the air over its shadow: it bobs with the wingbeat and leans into its swing
    const beat = Math.sin(t * 14 + e.id * 1.7);
    s = stand(layer, tex, e, e.radius * ENEMY_ART.lift + beat * 6, e.radius * ENEMY_ART.height);
    s.scale.y *= 0.97 + beat * 0.03;
    s.rotation = e.atWall ? 0 : Math.cos((((e.phase ?? 0) / BRAD_FULL) * 2 * Math.PI) + seconds * BALANCE.flyer.weaveRate) * 0.14;
  } else if (e.kind === 'winder') {
    // eight legs: a quick low scuttle, and a jolt each time it winds the others back
    const jolt = Math.max(0, (e.windTime ?? 0) / TICK_RATE - (BALANCE.winder.every - 0.3)) / 0.3;
    const hop = Math.abs(Math.sin(step * 2)) * 0.35;
    s = stand(layer, tex, e, hop * 8, e.radius * ENEMY_ART.height * (1 + jolt * 0.12));
    s.rotation = Math.sin(step * 2) * 0.03;
  } else if (e.kind === 'anvil') {
    // on its spring: it crouches before a leap, sails up in an arc, and squashes as it lands
    const A = BALANCE.bosses.anvil;
    const flight = ticks(A.leapTime);
    const up = e.leapTime ? Math.sin(Math.PI * (1 - e.leapTime / flight)) : 0;
    const crouch = !e.leapTime && !e.atWall && e.hopTime !== undefined && e.hopTime < 8 ? 1 - e.hopTime / 8 : 0;
    const bob = Math.abs(Math.sin(step * 1.5)) * 0.4;
    s = stand(layer, tex, e, up * 130 + bob * 6, e.radius * ENEMY_ART.height);
    s.scale.y *= 1 - crouch * 0.18 + up * 0.1;
    s.scale.x *= 1 + crouch * 0.1 - up * 0.05;
    s.rotation = 0;
  } else if (e.kind === 'gear') {
    // the cog rolls from side to side; the bare core scurries on its legs
    const core = !!e.core;
    const hop = Math.abs(Math.sin(step * (core ? 2 : 1)));
    s = stand(layer, tex, e, hop * (core ? 10 : 4), e.radius * ENEMY_ART.height * (core ? 0.8 : 1));
    s.rotation = core ? Math.sin(step * 2) * 0.06 : Math.sin(step * 0.8) * 0.12;
  } else {
    // the tank rolls on tracks: no steps, only a rumble
    const tracks = e.kind === 'boss';
    const hop = tracks ? Math.abs(Math.sin(step * 3)) * 0.3 : Math.abs(Math.sin(step));
    s = stand(layer, tex, e, hop * 8, e.radius * ENEMY_ART.height);
    s.rotation = tracks ? 0 : Math.cos(step) * 0.07;
    s.scale.y *= tracks ? 1 : 0.96 + hop * 0.06;
  }
  return s;
}

/** `e`'s sprite `h` tall with its feet `up` over the ground under it, upward on the screen. */
function stand(layer: SpriteLayer, tex: Texture, e: Enemy, up: number, h: number): Sprite {
  const p = aside(e.x, e.y, 0, e.radius * ENEMY_ART.feet - up);
  return layer.put(tex, p.x, p.y, h);
}
