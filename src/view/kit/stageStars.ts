// A stage's stars: three small ones in a row, gold for normal mode and red for hard, the ones
// not earned yet hollow; and one big star for an icon.

import { Container, Graphics } from 'pixi.js';
import { COLORS } from '../ui';
import { LIGHT, P } from './palette';

/** The colour of an earned star on normal and on hard mode. */
export const STAR_GOLD = COLORS.gold;
export const STAR_HARD = P.red;

/** A five-point star, its points `r` from (x, y). */
export function starShape(g: Graphics, x: number, y: number, r: number, fill: number, line = Math.max(2, r * 0.16)): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.48 : r;
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  return g.poly(pts).fill(fill).stroke({ width: line, color: P.line, join: 'round' });
}

/** Three stars `r` in radius side by side around x 0, `lit` of them earned from the left. */
export function starRow(lit: number, r: number, hard = false): Graphics {
  const g = new Graphics();
  const gap = r * 2.1;
  for (let i = 0; i < 3; i++) starShape(g, (i - 1) * gap, 0, r, i < lit ? (hard ? STAR_HARD : STAR_GOLD) : LIGHT.inset);
  return g;
}

/** One big star about 100 across, for an achievement's icon. */
export function starIcon(hard = false): Container {
  const g = starShape(new Graphics(), 0, 4, 50, hard ? STAR_HARD : STAR_GOLD, 7);
  g.circle(-9, -8, 8).fill({ color: 0xffffff, alpha: 0.55 });
  return g;
}
