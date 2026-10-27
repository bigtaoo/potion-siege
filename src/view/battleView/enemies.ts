// The enemies as the battle draws them: between their last two ticks, farther ones first, each
// in its art (posed, tinted by what is on it) or its placeholder shape.

import type { Graphics } from 'pixi.js';
import type { Battle } from '../../sim/battle';
import { FP } from '../../sim/math/fixed';
import type { Enemy } from '../../sim/types';
import { SpriteLayer, enemyTexture } from '../art';
import { iceShell } from '../effects';
import { poseEnemy } from '../enemyPose';
import { lerpX, lerpY } from '../fixedStep';
import { hordeFade } from '../hordeFx';
import { drawUpright, isLand } from '../landView';
import { ENEMY_ART, drawEnemy } from '../shapes';
import { EnemyMarks } from './enemyMarks';

/** Farther enemies first (higher on the screen), so nearer ones overlap them. */
const byDepth = (p: Enemy, q: Enemy): number => p.y - q.y;
const byDepthLand = (p: Enemy, q: Enemy): number => p.x - q.x;

export class EnemyLayer {
  /** The enemies' art; goes into the view at its place in the drawing order. */
  readonly art = new SpriteLayer();
  /** Their shadows (under the art) and HP bars (over it); BattleView places both. */
  readonly marks = new EnemyMarks();
  /** The enemies in drawing order, refilled every frame. */
  private readonly depth: Enemy[] = [];
  /** The enemies as drawn: world units, between their last two ticks; reused every frame. */
  private readonly drawn: Enemy[] = [];

  /** The enemies of `b` `alpha` of the way through its last tick, at `t` seconds into the
   *  battle: shapes and ice on `w`, what goes under the art on `u`. */
  draw(b: Battle, alpha: number, t: number, w: Graphics, u: Graphics): void {
    this.art.begin();
    this.marks.begin();
    const depth = this.depth;
    depth.length = 0;
    for (let i = 0; i < b.enemies.length; i++) {
      const e = b.enemies[i];
      // a fresh copy for a new enemy: a boss's optional fields (shield, core...) must not linger
      let o = this.drawn[i];
      if (!o || o.id !== e.id) o = this.drawn[i] = { ...e };
      else Object.assign(o, e);
      o.x = lerpX(e, alpha);
      o.y = lerpY(e, alpha);
      o.radius = e.radius / FP;
      depth.push(o);
    }
    depth.sort(isLand() ? byDepthLand : byDepth);
    for (const e of depth) {
      const fade = hordeFade(e);
      if (fade <= 0) continue;
      const tex = enemyTexture(e.kind, e);
      if (!tex) {
        drawEnemy(w, e);
        continue;
      }
      if (fade >= 1) {
        this.marks.shadow(e);
        this.marks.hp(e);
        if (e.elite) {
          drawEnemy(u, e, 'under');
          drawEnemy(w, e, 'over');
        }
      }
      const s = poseEnemy(this.art, tex, e, t, b.seconds);
      if (e.freezeTime > 0) {
        drawUpright(w, e.x, e.y, (ox, oy) => iceShell(w, ox, oy + e.radius * ENEMY_ART.feet, e.radius * 2.3, e.radius * ENEMY_ART.height * 0.92));
      }
      s.alpha = fade;
      s.tint = e.freezeTime > 0 ? 0x9fe8ff : e.slowTime > 0 ? 0xc4dcff : e.burnTime > 0 ? 0xffb27a : e.chargeTime > 0 ? 0xfff2a0 : e.markTime > 0 ? 0xdcb8ff : e.rust > 0 ? 0xe0a878 : e.poisonTime > 0 ? 0xc8f0a0 : 0xffffff;
    }
    depth.length = 0;
    this.art.end();
    this.marks.end();
  }
}
