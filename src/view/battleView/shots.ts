// The heroes' shots as the battle draws them: thrown vials tumbling end over end, trailing fire,
// each leaving from the thrower's hand, or the placeholder shapes.

import type { Graphics } from 'pixi.js';
import type { Battle } from '../../sim/battle';
import { FP } from '../../sim/math/fixed';
import { SpriteLayer, potionLook } from '../art';
import { lerpX, lerpY } from '../fixedStep';
import { INK } from '../potion';
import { drawProjectile } from '../shapes';

/** Seconds a thrown vial takes to drift from the hand onto its true path. */
const LEAVE_HAND = 0.15;

export class ShotLayer {
  /** The vials' art; goes into the view at its place in the drawing order. */
  readonly art = new SpriteLayer();
  /** Thrown vials still leaving the hand: how far the hand was from where the sim spawned them. */
  private readonly launches = new Map<number, { dx: number; dy: number; at: number }>();

  clear(): void {
    this.launches.clear();
  }

  /** Shot `projectile` left a hand (dx, dy) from where the sim spawned it, at `now` seconds. */
  launch(projectile: number, dx: number, dy: number, now: number): void {
    for (const [id, l] of this.launches) if (now - l.at > LEAVE_HAND) this.launches.delete(id);
    this.launches.set(projectile, { dx, dy, at: now });
  }

  /** Starts the art and draws the shots of `b` `alpha` of the way through its last tick, at `t`
   *  seconds, the trails and shapes on `w`; the caller ends the art (the commander's flasks go in
   *  it too). */
  draw(b: Battle, alpha: number, t: number, w: Graphics): void {
    this.art.begin();
    for (const p of b.projectiles) {
      const look = potionLook(p.kind);
      if (!look) {
        drawProjectile(w, p.kind, lerpX(p, alpha), lerpY(p, alpha));
        continue;
      }
      // a thrown vial tumbling end over end, trailing fire; it leaves from the thrower's hand
      let px = lerpX(p, alpha);
      let py = lerpY(p, alpha);
      const tx = p.tx / FP;
      const ty = p.ty / FP;
      const launch = this.launches.get(p.id);
      if (launch) {
        const k = 1 - (t - launch.at) / LEAVE_HAND;
        if (k <= 0) this.launches.delete(p.id);
        else {
          px += launch.dx * k * k;
          py += launch.dy * k * k;
        }
      }
      const len = Math.hypot(tx - px, ty - py) || 1;
      const dx = (px - tx) / len;
      const dy = (py - ty) / len;
      // the trail: one inked outline under all three blobs, so it reads as a single streak
      for (let i = 3; i >= 1; i--) w.circle(px + dx * i * 16, py + dy * i * 16, 20 - i * 3 + 4).fill(INK);
      for (let i = 3; i >= 1; i--) w.circle(px + dx * i * 16, py + dy * i * 16, 20 - i * 3).fill(look.glow[i - 1]);
      const s = this.art.put(look.body, px, py, 44 + p.star * 4);
      s.anchor.set(0.5);
      s.rotation = t * 14 + p.id;
    }
  }
}
