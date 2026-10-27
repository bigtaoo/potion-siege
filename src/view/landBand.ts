// The shelf under a field turned on its side, where the gold and the two buttons sit: walnut
// planks under a brass rail along the field's edge, the field casting a shadow onto it. Drawn in
// the turned board's own units, LAND.w wide and LAND.band high, its top left at the origin.

import { Graphics } from 'pixi.js';
import { P } from './kit';
import { LAND } from './wideLayout';

const RAIL = 16;
const PLANK = 68;

export function landBand(): Graphics {
  const { w, band: h } = LAND;
  const g = new Graphics().rect(0, 0, w, h).fill(P.wood);
  // planks along the shelf, their joins staggered from row to row
  for (let y = RAIL, row = 0; y < h; y += PLANK, row++) {
    g.rect(0, y, w, 4).fill({ color: P.woodDark, alpha: 0.7 });
    g.rect(0, y + 4, w, 3).fill({ color: P.woodLight, alpha: 0.25 });
    for (let x = row % 2 ? 260 : 520; x < w; x += 520) g.rect(x, y, 4, PLANK).fill({ color: P.woodDark, alpha: 0.55 });
  }
  // the field's shadow on the shelf, and the shelf's own darker front edge
  for (let i = 1; i <= 6; i++) g.rect(0, RAIL, w, 10 * i).fill({ color: 0x000000, alpha: 0.06 });
  for (let i = 1; i <= 4; i++) g.rect(0, h - 10 * i, w, 10 * i).fill({ color: P.line, alpha: 0.08 });
  // the brass rail, riveted
  g.rect(0, 0, w, RAIL).fill(P.brassDark);
  g.rect(0, 3, w, 4).fill({ color: P.brassLight, alpha: 0.85 });
  g.rect(0, RAIL - 2, w, 2).fill(P.line);
  for (let x = 120; x < w; x += 240) g.circle(x, RAIL / 2, 6).fill(P.brassLight).stroke({ width: 2, color: P.line });
  return g;
}
