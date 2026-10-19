// The wall the potions stand on, seen from above: where its front and back edges are, where its
// health bar sits, and its top with a slab for every built cell.

import type { Graphics } from 'pixi.js';
import { SLOT_COUNT, slotCenter, type Battle } from '../../sim/battle';
import { FP, toFp } from '../../sim/math/fixed';
import { BALANCE } from '../../sim/types';
import { slab, wallTop, type WallColumn } from '../stone';
import { DESIGN_W } from '../viewport';

const F = BALANCE.field;
const G = BALANCE.grid;
/** Front of the thinnest wall (the bottom row only), and the wall's back edge. */
export const WALL_TOP = G.y0 + G.cellH * (G.rows - 1) - F.parapet;
export const WALL_BOTTOM = G.y0 + G.cellH * G.rows;
/** The wall's health bar, set into the wall's inner face. */
export const BAR_H = 30;
export const BAR_Y = WALL_BOTTOM + 16;

/** The wall's top on `g`: a slab for every built cell, each column as thick as its cells, with
 *  the parapet along its front. */
export function drawWallTop(g: Graphics, b: Battle): void {
  const columns: WallColumn[] = [];
  for (let col = 0; col < G.cols; col++) {
    const x0 = col === 0 ? 0 : G.x0 + G.cellW * col;
    const x1 = col === G.cols - 1 ? DESIGN_W : G.x0 + G.cellW * (col + 1);
    columns.push({ x0, x1, front: b.wallFront(toFp(G.x0 + G.cellW * (col + 0.5))) / FP + F.parapet });
  }
  wallTop(g, columns, WALL_BOTTOM);
  for (let s = 0; s < SLOT_COUNT; s++) {
    if (!b.isOpen(s)) continue;
    const c = slotCenter(s);
    slab(g, c.x - G.cellW / 2 + 8, c.y - G.cellH / 2 + 10, G.cellW - 16, G.cellH - 22, s);
  }
}
