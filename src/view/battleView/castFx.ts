// What the commander's casts look like where they land: the mark the flask is thrown at, its
// burst (a flash, a fireball, a shock ring, a scorch left on the road), every enemy it caught
// flashing with what it took; the frost's cold burst and the acid's splash and pool.

import type { Graphics } from 'pixi.js';
import type { FlaskHit } from '../../sim/types';
import { glassShards } from '../effects';
import type { Floaters } from './floaters';
import type { FxLayer } from './fxLayer';
import { ACID_COLOR, BOMB_COLOR, FROST_COLOR } from './spellLook';
import { WALL_TOP } from './wall';

const FLAME = 0xffe08a;
const WHITE = 0xfff8e6;
const SCORCH = 0x3a2414;
/** What an enemy took, hot red-orange: it reads on the grass, the road and the flash alike. */
const HURT = 0xff5a2e;
/** Seconds the scorch stays on the road. */
const SCORCH_TIME = 1.6;

/** Whether a flash reaching `reach` out from (x, y) would cover the cells on the wall: then it
 *  goes under the heroes (fx.mid) instead of over them. */
export function overWall(y: number, reach: number): boolean {
  return y + reach > WALL_TOP;
}

/** The mark on the road while the flask is in the air: the reach it will burst over, closing in
 *  as it comes down, with a cross at its middle. */
export function landingMark(fx: FxLayer, x: number, y: number, radius: number, flight: number, color = BOMB_COLOR): void {
  fx.effect(flight, (g, life) => {
    const k = 1 - life;
    const pulse = 0.5 + 0.5 * Math.sin(k * Math.PI * 6);
    g.circle(x, y, radius).fill({ color, alpha: 0.1 + 0.12 * k });
    g.circle(x, y, radius * (1.25 - 0.25 * k)).stroke({ width: 8, color, alpha: 0.55 + 0.35 * pulse });
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
  // a white flash over everything for a blink (under the heroes by the wall), then the fireball
  fx.push({ ttl: 0.14, max: 0.14, top: !overWall(y, radius * 1.1), draw: (g, life) => g.circle(x, y, radius * 1.1).fill({ color: WHITE, alpha: 0.7 * life }) });
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
    fx.push({ ttl: 0.25, max: 0.25, top: !overWall(h.y, HIT_FLASH), draw: (g, life) => hitFlash(g, h.x, h.y, life) });
    if (h.damage > 0) floaters.show(`-${h.damage}`, h.x, h.y - 40, HURT, 1.3);
  }
  // how many it caught, big over the burst
  if (hits.length > 1) floaters.show(`×${hits.length}`, x, y - radius - 10, FLAME, 2);
}

/** How far the flash on a caught enemy reaches at its widest. */
const HIT_FLASH = 64;

function hitFlash(g: Graphics, x: number, y: number, life: number): void {
  g.circle(x, y, HIT_FLASH - 18 + (1 - life) * 18).fill({ color: WHITE, alpha: 0.75 * life });
}

/** The frost bursts at (x, y) over `radius`: a cold flash, a ring of frost running out, and a
 *  crust of ice on each enemy it caught. */
export function frostBurst(fx: FxLayer, x: number, y: number, radius: number, hits: readonly FlaskHit[]): void {
  fx.push({ ttl: 0.18, max: 0.18, top: !overWall(y, radius), draw: (g, life) => g.circle(x, y, radius).fill({ color: WHITE, alpha: 0.6 * life }) });
  fx.effect(0.8, (g, life) => {
    const k = 1 - life;
    g.circle(x, y, radius * (0.3 + k * 0.8)).fill({ color: FROST_COLOR, alpha: life * 0.35 });
    g.circle(x, y, radius * (0.4 + k * 0.8)).stroke({ width: 16 * life, color: WHITE, alpha: life });
  });
  fx.effect(0.7, (g, life) => glassShards(g, x, y, 1 - life));
  for (const h of hits) {
    fx.effect(0.6, (g, life) => g.circle(h.x, h.y, 46).fill({ color: FROST_COLOR, alpha: 0.55 * life }).stroke({ width: 4, color: WHITE, alpha: life }));
  }
}

/** The acid splashes down at (x, y): a green burst, then the pool stays (acidPool, each frame). */
export function acidSplash(fx: FxLayer, x: number, y: number, radius: number): void {
  fx.effect(0.5, (g, life) => {
    const k = 1 - life;
    g.circle(x, y, radius * (0.4 + k * 0.7)).fill({ color: ACID_COLOR, alpha: life * 0.5 });
  });
  fx.effect(0.7, (g, life) => glassShards(g, x, y, 1 - life));
}

/** An acid pool at (x, y) at `t` seconds, `left` of it still to go (0–1 over its last half second):
 *  a green puddle with bubbles rising and popping across it. */
export function acidPool(g: Graphics, x: number, y: number, radius: number, t: number, left: number): void {
  g.circle(x, y, radius).fill({ color: ACID_COLOR, alpha: 0.28 * left }).stroke({ width: 5, color: ACID_COLOR, alpha: 0.6 * left });
  g.circle(x, y, radius * 0.6).fill({ color: ACID_COLOR, alpha: 0.18 * left });
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4 + x * 0.01;
    const d = radius * (0.2 + ((i * 37) % 70) / 100);
    const p = (t * 1.3 + i * 0.37) % 1;
    g.circle(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 6 + p * 10).stroke({ width: 3, color: 0xe6ffb0, alpha: (1 - p) * 0.8 * left });
  }
}
