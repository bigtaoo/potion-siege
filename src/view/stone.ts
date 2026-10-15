// The wall seen from above, in the colours of the painted wall in bg_base.png. Every built
// cell is a paving slab on the wall's top, and the wall is as thick in each column as the
// cells built there: the front edge, with its parapet and merlons, steps forward as the
// column grows.

import type { Graphics } from 'pixi.js';

/** Colours picked from the painted wall. */
export const STONE = { face: 0xb49470, light: 0xdcbc80, mortar: 0x6e5040, line: 0x3a2820, pave: 0xa88a64, slab: 0xcfb68a, shadow: 0x24180f };

/** One column of the wall: its sides and the y of its front edge. */
export interface WallColumn {
  x0: number;
  x1: number;
  front: number;
}

/** A block seen from above and the workshop side: its top face, then the face towards us. */
function block(g: Graphics, x: number, y: number, w: number, top: number, face: number): void {
  g.rect(x, y, w, top).fill(STONE.light);
  g.rect(x, y + top, w, face).fill(STONE.face);
  g.moveTo(x, y + top).lineTo(x + w, y + top).stroke({ width: 3, color: STONE.mortar });
  g.rect(x, y, w, top + face).stroke({ width: 4, color: STONE.line });
}

/** A paving slab: the spot one cell's potions stand on. */
export function slab(g: Graphics, x: number, y: number, w: number, h: number, seed: number): void {
  g.roundRect(x, y, w, h, 8).fill(STONE.slab);
  g.roundRect(x, y + h - 8, w, 8, 4).fill({ color: STONE.mortar, alpha: 0.35 });
  // split into two flagstones, the joint a little off-centre
  const j = x + w * (0.4 + (seed % 3) * 0.1);
  g.moveTo(j, y + 4).lineTo(j, y + h - 4).stroke({ width: 3, color: STONE.mortar });
  g.roundRect(x, y, w, h, 8).stroke({ width: 3, color: STONE.line });
}

/** The wall's top from each column's front edge back to `back`: paving, then the parapet and
 *  merlons along the front, and along any side where the next column is thinner. */
export function wallTop(g: Graphics, columns: WallColumn[], back: number): void {
  for (const c of columns) g.rect(c.x0, c.front, c.x1 - c.x0, back - c.front).fill(STONE.pave);
  // the back edge, where the wall drops to the workshop floor
  g.rect(0, back - 6, columns[columns.length - 1].x1, 12).fill(STONE.light).stroke({ width: 3, color: STONE.line });
  columns.forEach((c, i) => {
    for (const [n, side] of [[columns[i - 1], c.x0], [columns[i + 1], c.x1]] as const) {
      if (n && n.front > c.front) block(g, side - 9, c.front, 18, n.front - c.front + 6, 8);
    }
  });
  for (const c of columns) {
    block(g, c.x0, c.front - 8, c.x1 - c.x0, 10, 14);
    const w = c.x1 - c.x0;
    const m = 46;
    const n = Math.max(1, Math.round(w / 70));
    for (let k = 0; k < n; k++) block(g, c.x0 + ((k + 0.5) * w) / n - m / 2, c.front - 46, m, 16, 34);
  }
}
