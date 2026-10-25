// The look of the wall and the boards beside the battle on a wide screen. They stay a step
// behind the board: the wall is dark walnut with a vignette, the boards are dark glass with
// a thin brass edge and cream words, so the bright battle in the middle is what the eye finds
// first. Only the current wave keeps a full brass frame.

import { Container, Graphics } from 'pixi.js';
import { P, workshopWall } from './kit';
import { label } from './ui';

/** The colours the boards' content is drawn in. */
export const SIDE = {
  ink: P.cream,
  soft: P.paperDark,
  accent: P.brassLight,
  /** The empty part of a damage bar. */
  track: P.cream,
  inset: P.woodDark,
  insetEdge: P.line,
  /** An empty pip. */
  pip: P.woodDark,
} as const;

/** How far a wave that is still to come fades back next to the current one. */
export const REST_ALPHA = 0.72;

/** The wall beside the board, the board taking `x0` to `w - x0`. */
export function sideBackdrop(w: number, h: number, x0: number): Container {
  const c = new Container();
  const x1 = w - x0;
  const g = new Graphics().rect(0, 0, w, h).fill({ color: P.woodDark, alpha: 0.78 });
  // a vignette: darker toward the screen's outer edges and along the top and bottom
  for (let i = 1; i <= 8; i++) {
    const d = (x0 * i) / 9;
    g.rect(0, 0, x0 - d, h).fill({ color: P.line, alpha: 0.05 });
    g.rect(x1 + d, 0, x0 - d, h).fill({ color: P.line, alpha: 0.05 });
  }
  for (let i = 1; i <= 5; i++) {
    g.rect(0, 0, w, 24 * i).fill({ color: P.line, alpha: 0.04 });
    g.rect(0, h - 24 * i, w, 24 * i).fill({ color: P.line, alpha: 0.04 });
  }
  // the board casts a shadow on the wall
  for (let i = 1; i <= 8; i++) g.rect(x0 - i * 14, 0, x1 - x0 + i * 28, h).fill({ color: 0x000000, alpha: 0.1 });
  c.addChild(workshopWall(w, h), g);
  return c;
}

/** The board behind a column's content, centred on its position. */
export function sidePanel(w: number, h: number): Graphics {
  const x = -w / 2;
  const y = -h / 2;
  return new Graphics()
    .roundRect(x, y + 8, w, h, 28)
    .fill({ color: 0x000000, alpha: 0.25 })
    .roundRect(x, y, w, h, 28)
    .fill({ color: P.line, alpha: 0.55 })
    .stroke({ width: 3, color: P.brassDark, alpha: 0.8 });
}

/** The board's heading, just inside its top edge. */
export function sideHead(text: string): Container {
  const c = new Container();
  const t = label(text, 34, { fill: SIDE.accent, stroke: { color: P.line, width: 5 } });
  t.y = 22;
  c.addChild(t);
  return c;
}

/** A row on the board, centred on its position. */
export function sideTile(w: number, h: number, r = 24): Graphics {
  return new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill({ color: P.wood, alpha: 0.7 }).stroke({ width: 3, color: P.line });
}
