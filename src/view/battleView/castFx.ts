// What the commander's casts look like where they land: the mark the flask is thrown at, its
// burst (a flash, a fireball, a shock ring, a scorch left on the road), every enemy it caught
// flashing with what it took, and the brew's lift over each potion on the wall.

import type { Graphics } from 'pixi.js';
import type { FlaskHit } from '../../sim/types';
import { glassShards } from '../effects';
import type { Floaters } from './floaters';
import type { FxLayer } from './fxLayer';
import { BOMB_COLOR, BREW_COLOR } from './commander';

const FLAME = 0xffe08a;
const WHITE = 0xfff8e6;
const SCORCH = 0x3a2414;
/** What an enemy took, hot red-orange: it reads on the grass, the road and the flash alike. */
const HURT = 0xff5a2e;
/** Seconds the scorch stays on the road. */
const SCORCH_TIME = 1.6;

/** The mark on the road while the flask is in the air: the reach it will burst over, closing in
 *  as it comes down, with a cross at its middle. */
export function landingMark(fx: FxLayer, x: number, y: number, radius: number, flight: number): void {
  fx.effect(flight, (g, life) => {
    const k = 1 - life;
    const pulse = 0.5 + 0.5 * Math.sin(k * Math.PI * 6);
    g.circle(x, y, radius).fill({ color: BOMB_COLOR, alpha: 0.1 + 0.12 * k });
    g.circle(x, y, radius * (1.25 - 0.25 * k)).stroke({ width: 8, color: BOMB_COLOR, alpha: 0.55 + 0.35 * pulse });
    const c = 26 + 14 * life;
    g.moveTo(x - c, y).lineTo(x + c, y).moveTo(x, y - c).lineTo(x, y + c).stroke({ width: 7, color: WHITE, alpha: 0.8 });
  }, true);
}

/** The flask bursts at (x, y) over `radius`, on the enemies in `hits`. */
export function flaskBurst(fx: FxLayer, floaters: Floaters, x: number, y: number, radius: number, hits: readonly FlaskHit[]): void {
  // the scorch it leaves on the road, fading slowly
  fx.effect(SCORCH_TIME, (g, life) => {
    g.circle(x, y, radius * 0.75).fill({ color: SCORCH, alpha: 0.32 * life });
    g.circle(x, y, radius * 0.45).fill({ color: SCORCH, alpha: 0.25 * life });
  }, true);
  // a white flash over everything for a blink, then the fireball
  fx.push({ ttl: 0.14, max: 0.14, top: true, draw: (g, life) => g.circle(x, y, radius * 1.1).fill({ color: WHITE, alpha: 0.7 * life }) });
  fx.effect(0.7, (g, life) => {
    const k = 1 - life;
    g.circle(x, y, radius * (0.5 + k * 0.7)).fill({ color: BOMB_COLOR, alpha: life * 0.5 });
    g.circle(x, y, radius * (0.3 + k * 0.5)).fill({ color: FLAME, alpha: life * 0.65 });
  });
  // the shock ring running out past the reach
  fx.effect(0.55, (g, life) => {
    g.circle(x, y, radius * (0.4 + (1 - life) * 1.0)).stroke({ width: 20 * life, color: WHITE, alpha: life });
  });
  fx.effect(0.7, (g, life) => glassShards(g, x, y, 1 - life));
  // each enemy caught: a white flash on it and what it took
  for (const h of hits) {
    fx.push({ ttl: 0.25, max: 0.25, top: true, draw: (g, life) => hitFlash(g, h.x, h.y, life) });
    if (h.damage > 0) floaters.show(`-${h.damage}`, h.x, h.y - 40, HURT, 1.3);
  }
  // how many it caught, big over the burst
  if (hits.length > 1) floaters.show(`×${hits.length}`, x, y - radius - 10, FLAME, 2);
}

function hitFlash(g: Graphics, x: number, y: number, life: number): void {
  g.circle(x, y, 46 + (1 - life) * 18).fill({ color: WHITE, alpha: 0.75 * life });
}

/** The brew: a lift of `pct` over each potion on the wall, at `cells`. */
export function brewLift(floaters: Floaters, cells: readonly { x: number; y: number }[], pct: number): void {
  for (const c of cells) floaters.show(`+${pct}%`, c.x, c.y - 40, BREW_COLOR);
}
