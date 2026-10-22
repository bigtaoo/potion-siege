// The battle's short-lived effects (blasts, bursts, flashes, rings): drawings that fade out over
// their time, each on the ground under the enemies, over the enemies and shots, or over the heroes.

import { Graphics } from 'pixi.js';

export interface Effect {
  ttl: number;
  max: number;
  draw: (g: Graphics, life: number) => void;
  /** Drawn above the heroes instead of under them. */
  top?: boolean;
  /** Drawn on the ground, under the enemies. */
  ground?: boolean;
}

/** Its three Graphics go into the view at their places in the drawing order. */
export class FxLayer {
  /** On the ground, under the enemies. */
  readonly ground = new Graphics();
  /** Over the enemies and the shots, under the heroes. */
  readonly mid = new Graphics();
  /** Over the heroes. */
  readonly top = new Graphics();
  private list: Effect[] = [];

  clear(): void {
    this.list = [];
  }

  push(e: Effect): void {
    this.list.push(e);
  }

  effect(ttl: number, draw: Effect['draw'], ground = false): void {
    this.list.push({ ttl, max: ttl, draw, ground });
  }

  burst(x: number, y: number, r: number, color: number, ttl: number): void {
    this.effect(ttl, (g, life) => {
      g.circle(x, y, r * (1.2 - life * 0.5)).fill({ color, alpha: life * 0.45 });
    });
  }

  /** Ages every effect by `dt` seconds, drops the ones that are over and draws the rest. */
  update(dt: number): void {
    const fx = this.mid.clear();
    const fxTop = this.top.clear();
    const fxGround = this.ground.clear();
    // in place: a new array every frame was garbage
    const list = this.list;
    let n = 0;
    for (const e of list) if ((e.ttl -= dt) > 0) list[n++] = e;
    list.length = n;
    for (const e of list) e.draw(e.top ? fxTop : e.ground ? fxGround : fx, e.ttl / e.max);
  }
}
