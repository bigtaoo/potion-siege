// The bridge between the screen's frame rate and the battle's fixed TICK_RATE (ported from
// standing's client/src/game/fixedStep.ts): frame time builds up in an accumulator, each whole
// tick of it runs one battle step, and what is left over is how far the view interpolates
// between the last two states. A speed above 1 feeds the accumulator faster (fast forward:
// twice the ticks per second), below 1 slower (the tutorial's slow motion). Pure, tested without Pixi.

import { FP, TICK_RATE } from '../sim/math/fixed';

export const TICK_MS = 1000 / TICK_RATE;
/** At most this many steps per frame at normal speed; past it the backlog is dropped (a hitch, a hidden tab). */
export const MAX_STEPS = 5;

export class FixedStep {
  private acc = 0;

  /** Adds a frame's time, `speed` times over; returns how many battle steps to run now. */
  advance(frameMs: number, speed = 1): number {
    this.acc += Math.max(0, frameMs) * speed;
    let steps = Math.floor(this.acc / TICK_MS);
    const most = Math.max(1, Math.ceil(MAX_STEPS * speed));
    if (steps > most) {
      steps = most;
      this.acc = 0;
    } else {
      this.acc -= steps * TICK_MS;
    }
    return steps;
  }

  /** 0 at the last state's start, 1 at it: how far to draw between px and x. */
  get alpha(): number {
    return Math.min(1, this.acc / TICK_MS);
  }
}

/** Something that moves in the battle: its position now and a tick ago, in FP. */
export interface Body {
  x: number;
  y: number;
  px: number;
  py: number;
}

/** A body's drawn position in world units, `alpha` of the way through the last tick. */
export function lerpX(b: Body, alpha: number): number {
  return (b.px + (b.x - b.px) * alpha) / FP;
}

export function lerpY(b: Body, alpha: number): number {
  return (b.py + (b.y - b.py) * alpha) / FP;
}
