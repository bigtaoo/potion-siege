// The heroes of a cell as the battle draws them: the small figures of a level 1-3 cell, the one
// big hero of the top level in its golden aura, and how each figure is moving.

import type { Graphics, Texture } from 'pixi.js';
import { BALANCE, type HeroKind } from '../../sim/types';
import { figureTexture, potionLook, ultimateTexture, type SpriteLayer } from '../art';
import { popScale, recoil, type PotionLayer } from '../potion';
import { drawHero, heroShadow } from '../shapes';
import { COLORS } from '../ui';

/** Where the figures of a level 1-3 cell stand, back to front, and how tall they are. */
export const FIGURES: { spots: [number, number][]; height: number }[] = [
  { spots: [[0, 0]], height: 92 },
  { spots: [[-28, 0], [28, 0]], height: 80 },
  { spots: [[0, -22], [-30, 8], [30, 8]], height: 74 },
];
const ULTIMATE_HEIGHT = 150;
/** Wide ultimates (arms spread out) are drawn shorter so they stay inside their cell. */
const ULTIMATE_WIDTH = 155;

/** How a figure is moving: drawing back to throw (0-1), seconds since it threw, since it appeared. */
export interface FigureAnim {
  wind: number;
  since: number;
  pop: number;
  /** Diving into another potion: a fixed tilt, mark out. */
  tilt?: number;
  /** Squash (above 0) or stretch (below 0), and an extra turn, as a merge lands in it. */
  squash?: number;
  spin?: number;
}
export const STILL: FigureAnim = { wind: 0, since: Infinity, pop: Infinity };

/** The heroes of one cell centred on (x, y) at `time` seconds into the battle: levels 1-3 show
 *  that many small figures, the top level one big hero in a golden aura. */
export function drawCell(time: number, under: Graphics, over: Graphics, layer: SpriteLayer, potions: PotionLayer, kind: HeroKind, star: number, x: number, y: number, size: number, alpha: number, phase: number, dim = false, anim: (i: number) => FigureAnim = () => STILL): void {
  const feet = y + 50 * size;
  if (star >= BALANCE.maxStar) {
    const a = anim(0);
    if (a.pop < 0) return;
    const grow = popScale(a.pop);
    const pulse = 0.8 + 0.2 * Math.sin(time * 4 + phase);
    under.circle(x, y - 10 * size, 64 * size * pulse * grow).fill({ color: COLORS.gold, alpha: 0.5 * alpha });
    under.circle(x, y - 10 * size, 46 * size * grow).fill({ color: 0xfff3c0, alpha: 0.5 * alpha });
    const tex = ultimateTexture(kind);
    const h = tex ? Math.min(ULTIMATE_HEIGHT, (ULTIMATE_WIDTH * tex.height) / tex.width) : ULTIMATE_HEIGHT;
    figure(time, under, over, layer, tex, kind, x, feet, h * size, alpha, phase, dim, a);
    return;
  }
  const { spots, height } = FIGURES[star - 1];
  const look = potionLook(kind);
  spots.forEach(([dx, dy], i) => {
    const a = anim(i);
    // still fusing
    if (a.pop < 0) return;
    const fx = x + dx * size;
    const ff = feet + dy * size;
    if (!look) {
      figure(time, under, over, layer, figureTexture(kind), kind, fx, ff, height * size, alpha, phase + i, dim, a);
      return;
    }
    heroShadow(under, fx, ff - 4, height * size * 0.6 * popScale(a.pop), alpha);
    potions.put(look, { x: fx, feet: ff, height: height * size * 1.05, alpha, dim, phase: phase + i, time, ...a });
  });
}

/** One figure with its feet on (x, feet): its art if there is any, else the placeholder shape.
 *  Breathes gently. */
function figure(time: number, under: Graphics, over: Graphics, layer: SpriteLayer, tex: Texture | undefined, kind: HeroKind, x: number, feet: number, height: number, alpha: number, phase: number, dim: boolean, anim: FigureAnim = STILL): void {
  if (!tex) {
    drawHero(over, kind, x, feet - height * 0.42, height * 0.4, dim ? alpha * 0.35 : alpha);
    return;
  }
  // narrow art stands a little taller, so it does not look smaller than its neighbours
  const h = height * Math.max(1, (0.85 * tex.height) / tex.width);
  heroShadow(under, x, feet - 4, h * 0.7, alpha);
  const s = layer.put(tex, x, feet, h);
  s.alpha = alpha;
  if (dim) s.tint = 0x5a5a5a;
  // breathes; squashes as it draws back, stretches as it throws, pops in when it appears
  const r = recoil(anim.since);
  const grow = popScale(anim.pop);
  const sq = anim.squash ?? 0;
  s.scale.x *= grow * (1 + sq) * (1 + anim.wind * 0.06 - r * 0.06);
  s.scale.y *= grow * (1 - sq) * (1 + Math.sin(time * 3 + phase) * 0.025 - anim.wind * 0.08 + r * 0.1);
  s.rotation = (anim.tilt ?? 0) + (anim.spin ?? 0);
}
