// The commander's small hints (audit V7): a wall cell by its "x/5" count, so the count says what
// it builds, with one line spelling it out the first time the count shows in a run of the game;
// and once the charge is full, the whole ring aglow and a hand showing the cast: pressing the
// badge and dragging it onto the crowd, the spell's ring where it lets go.
import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { P } from '../kit/palette';
import { aside, drawUpright, isLand } from '../landView';
import { pointingHand } from '../Tutorial';
import { COLORS, label } from '../ui';
import { DESIGN_W } from '../viewport';
import { BAR_Y } from './wall';

/** Seconds the one-line tip stays, once per page load (the save has no field to spare for it). */
export const TIP_SECONDS = 6;
let tipLeft = TIP_SECONDS;
/** On a turned field the board beside the wall is narrow: the tip goes under the commander, wrapped. */
const LAND_BELOW = 250;
const LAND_WRAP = 230;
/** On an upright field the tip is a bubble over the wall's health bar, its tail down at the
 *  count under the bar: big enough to read on a phone, never over the bar nor the count. */
export const BUBBLE = { size: 38, wrap: 640, padX: 26, padY: 16, gap: 22, tail: 18 };
/** How far in from the field's edges the bubble keeps. */
const EDGE = 24;

/** Seconds of the hand's drag from the badge to the crowd, and the parts of it: pressing the
 *  badge, sliding over, resting on the crowd with the ring, fading. */
export const DRAG = { cycle: 2, press: 0.15, slide: 0.65, rest: 0.88 };

type Point = { x: number; y: number };

/** Where the hand drags to, and the ring it shows there: the spell's reach and colour. */
export interface DragTo {
  pick: () => Point | null;
  radius: number;
  color: number;
}

/** One hand at a time: while the board's own hand drags along a pair to fuse (the HUD's, set as it
 *  draws), the commander's waits; the glow and the call to tap still ask for the cast. */
export const handOff = { board: false };

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
  /** The plate behind the tip on an upright field. */
  readonly bubble = new Graphics();
  readonly hand = new Container();
  /** The drag's line and the ring where it lets go, under the hand. */
  readonly trail = new Graphics();
  private dragTime = 0;
  private to: Point | null = null;

  constructor() {
    super();
    this.eventMode = 'none';
    this.hand.addChild(pointingHand());
    this.tip.anchor.set(1, 0.5);
    this.tip.visible = this.hand.visible = this.bubble.visible = false;
    this.addChild(this.bubble, this.tip, this.trail, this.hand);
  }

  /** The tip, while it lasts: on an upright field a bubble over the wall's health bar with its
   *  tail at the count at `at`; on a turned field, under the commander. `left` summons to the next
   *  cell, null with no count. */
  showTip(left: number | null, at: { x: number; y: number }, k: number, dt: number): void {
    this.tip.visible = this.bubble.visible = left !== null && tipLeft > 0;
    if (left === null || tipLeft <= 0) return;
    tipLeft -= dt;
    const words = t('cellTip', { n: left });
    if (this.tip.text !== words) this.tip.text = words;
    const land = isLand();
    const size = land ? 30 : BUBBLE.size;
    const wrap = land ? LAND_WRAP : BUBBLE.wrap;
    if (this.tip.style.wordWrapWidth !== wrap || this.tip.style.fontSize !== size) {
      this.tip.anchor.set(0.5, 0.5);
      Object.assign(this.tip.style, { fontSize: size, wordWrap: true, wordWrapWidth: wrap, breakWords: land, align: 'center' });
    }
    this.tip.scale.set(k);
    this.tip.alpha = this.bubble.alpha = Math.min(1, tipLeft / 0.4);
    this.bubble.visible = !land;
    if (land) {
      const p = aside(at.x, at.y, 0, LAND_BELOW * k);
      this.tip.position.set(p.x, p.y);
      return;
    }
    const w = this.tip.width + 2 * BUBBLE.padX * k;
    const h = this.tip.height + 2 * BUBBLE.padY * k;
    const x = Math.max(EDGE + w / 2, Math.min(DESIGN_W - EDGE - w / 2, at.x));
    const bottom = BAR_Y - BUBBLE.gap;
    this.tip.position.set(x, bottom - h / 2);
    const tx = Math.max(x - w / 2 + 30, Math.min(x + w / 2 - 30, at.x));
    this.bubble
      .clear()
      .roundRect(x - w / 2, bottom - h, w, h, 20)
      .fill({ color: 0x14202c, alpha: 0.88 })
      .stroke({ width: 4, color: P.brass })
      .poly([tx - BUBBLE.tail, bottom - 2, tx + BUBBLE.tail, bottom - 2, tx, bottom + BUBBLE.tail])
      .fill({ color: 0x14202c, alpha: 0.88 });
  }

  /** The hand at a full badge of radius `r` at `at`, `dt` seconds on: pressing it and dragging
   *  to `to.pick()` (asked once a drag, so it stays on one crowd), the ring there as it rests; with
   *  nobody on the road, pointing up at the badge from below, bobbing. Null hides it. */
  pointAt(at: Point | null, r: number, dt: number, to: DragTo | null = null): void {
    this.hand.visible = at !== null && !handOff.board;
    this.trail.clear();
    if (!this.hand.visible || !at) {
      this.dragTime = 0;
      this.to = null;
      return;
    }
    const was = this.dragTime % DRAG.cycle;
    this.dragTime += dt;
    const s = this.dragTime % DRAG.cycle;
    if (!this.to || s < was) this.to = to?.pick() ?? null;
    this.hand.rotation = -0.35;
    if (!this.to || !to) {
      const p = aside(at.x, at.y, 14, r + 12 + Math.abs(Math.sin(this.dragTime * 4)) * 16);
      this.hand.position.set(p.x, p.y);
      this.hand.scale.set(0.55);
      this.hand.alpha = 1;
      return;
    }
    const k = s / DRAG.cycle;
    const go = Math.min(1, Math.max(0, (k - DRAG.press) / (DRAG.slide - DRAG.press)));
    const e = go * go * (3 - 2 * go);
    const x = at.x + (this.to.x - at.x) * e;
    const y = at.y + (this.to.y - at.y) * e;
    // pressed down on the badge, then dragging: the hand a touch smaller while it holds
    this.hand.position.set(x, y);
    this.hand.scale.set(k < DRAG.press ? 0.55 - 0.08 * (k / DRAG.press) : 0.47);
    this.hand.alpha = k < DRAG.rest ? 1 : 1 - (k - DRAG.rest) / (1 - DRAG.rest);
    const g = this.trail;
    if (go > 0) g.moveTo(at.x, at.y).lineTo(x, y).stroke({ width: 8, color: to.color, alpha: 0.45 * this.hand.alpha, cap: 'round' });
    if (k >= DRAG.slide) g.circle(x, y, to.radius).fill({ color: to.color, alpha: 0.14 * this.hand.alpha }).stroke({ width: 6, color: to.color, alpha: 0.8 * this.hand.alpha });
  }
}
