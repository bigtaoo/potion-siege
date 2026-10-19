// What the codex's pages share: the area they fill, a board's measures and colours, and the board.

import { Container } from 'pixi.js';
import { lightPanel, plate } from '../kit';

/** The part of the page the tab fills. */
export interface CodexArea {
  x: number;
  y: number;
  w: number;
  h: number;
  wide: boolean;
}

/** Room a board's title plate takes at its top, and its bottom margin; the gap between rows. */
export const HEAD = 76;
export const FOOT = 34;
export const GAP = 14;
export const WEAK = 0x26732f;
export const STRONG = 0xb3352a;
export const GREY = 0x8a7d6a;

/** A page's board: the paper panel with its title plate over the top edge. */
export function board(title: string, w: number, h: number): Container {
  const c = new Container();
  const p = plate(title, 40, 300);
  p.y = -h / 2 + 4;
  c.addChild(lightPanel(w, h), p);
  return c;
}
