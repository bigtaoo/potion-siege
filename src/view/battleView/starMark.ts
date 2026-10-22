// The three-star mark on the wall's health tube: a tick where the wall must stay for three stars
// (stars.ts) with a small star on it, gold while the wall is still at or over it.

import type { Graphics } from 'pixi.js';
import { STARS } from '../../sim/stars';
import { starShape, STAR_GOLD } from '../kit/stageStars';
import { P } from '../kit/palette';

/** Draws the mark on the tube at (x, y), `w` by `h`, the wall at `frac` of its health. */
export function starMark(g: Graphics, x: number, y: number, w: number, h: number, frac: number): void {
  const mx = x + w * STARS.three;
  const lit = frac >= STARS.three;
  g.rect(mx - 2, y - 3, 4, h + 6).fill({ color: lit ? STAR_GOLD : P.line, alpha: lit ? 1 : 0.6 });
  starShape(g, mx, y - 4, 13, lit ? STAR_GOLD : 0x9a8c78, 2.5);
}
