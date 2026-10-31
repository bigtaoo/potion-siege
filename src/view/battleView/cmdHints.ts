// The commander's small hints (audit V7): a wall cell by its "x/5" count, so the count says what
// it builds, with one line spelling it out the first time the count shows in a run of the game;
// and once the charge is full, the whole ring aglow and a hand pointing at it.
import { Container, type Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { P } from '../kit/palette';
import { aside, drawUpright } from '../landView';
import { pointingHand } from '../Tutorial';
import { COLORS, label } from '../ui';

/** Seconds the one-line tip stays, once per page load (the save has no field to spare for it). */
export const TIP_SECONDS = 6;
let tipLeft = TIP_SECONDS;

/** Lets the tip show again, as on a fresh page load. */
export function resetCellTip(): void {
  tipLeft = TIP_SECONDS;
}

/** A small wall cell centred on (x, y), drawn upright: the thing the count over the commander builds. */
export function drawCellIcon(g: Graphics, x: number, y: number, k: number): void {
  const s = 30 * k;
  drawUpright(g, x, y, (ox, oy) => {
    g.roundRect(ox - s / 2, oy - s / 2, s, s, 6 * k).fill(COLORS.wallTop).stroke({ width: 3 * k, color: P.umber });
    g.rect(ox - s / 2 + 5 * k, oy - 1 * k, s - 10 * k, 2 * k).fill(COLORS.wall);
    g.rect(ox - 1 * k, oy - s / 2 + 5 * k, 2 * k, s / 2 - 6 * k).fill(COLORS.wall);
  });
}

/** The full charge ring's glow at (x, y), around a badge of radius `r`, pulsing. */
export function drawFullGlow(g: Graphics, x: number, y: number, r: number, time: number): void {
  const p = 0.5 + 0.5 * Math.sin(time * 6);
  g.circle(x, y, r + 22 + p * 6).fill({ color: COLORS.gold, alpha: 0.16 + 0.16 * p });
  g.circle(x, y, r + 14).stroke({ width: 8, color: COLORS.gold, alpha: 0.45 + 0.4 * p });
}

/** The tip and the hand, standing upright among the view's words (landView.ts keepUpright). */
export class CommanderHints extends Container {
  readonly tip = label('', 30, { stroke: { color: P.umber, width: 5 } });
  readonly hand = new Container();

  constructor() {
    super();
    this.eventMode = 'none';
    this.hand.addChild(pointingHand());
    this.tip.visible = this.hand.visible = false;
    this.addChild(this.tip, this.hand);
  }

  /** The tip over the count at `at`, while it lasts: `left` summons to the next cell, null with no count. */
  showTip(left: number | null, at: { x: number; y: number }, k: number, dt: number): void {
    this.tip.visible = left !== null && tipLeft > 0;
    if (left === null || tipLeft <= 0) return;
    tipLeft -= dt;
    const words = t('cellTip', { n: left });
    if (this.tip.text !== words) this.tip.text = words;
    const p = aside(at.x, at.y, 0, -46 * k);
    this.tip.position.set(p.x, p.y);
    this.tip.scale.set(k);
    this.tip.alpha = Math.min(1, tipLeft / 0.4);
  }

  /** The hand pointing up at a full badge of radius `r` at `at` from below, bobbing; null hides it. */
  pointAt(at: { x: number; y: number } | null, r: number, time: number): void {
    this.hand.visible = at !== null;
    if (!at) return;
    const p = aside(at.x, at.y, 14, r + 12 + Math.abs(Math.sin(time * 4)) * 16);
    this.hand.position.set(p.x, p.y);
    this.hand.rotation = -0.35;
    this.hand.scale.set(0.55);
  }
}
