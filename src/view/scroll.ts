// A list taller than the room it has: a window onto it that a drag (or the wheel) moves up and
// down, a fling coasting on until it slows or meets an end. A press that moves more than a few px
// is a drag, not a tap: the rows under it take no tap until the finger is up.

import { Container, Graphics, Rectangle, type FederatedPointerEvent, type FederatedWheelEvent } from 'pixi.js';
import { P } from './kit';

/** How far a press may move before it is a drag, and how much of a fling's speed is left after
 *  each ms. */
const SLOP = 12;
const COAST = 0.995;

export interface ScrollList {
  /** The window, its top-left corner at (0, 0): place it. */
  readonly view: Container;
  /** What scrolls: fill it from y = 0 down, then call `fill`. */
  readonly content: Container;
  /** How far down the list the window is. */
  readonly offset: number;
  /** Sets how tall the content is, holding the offset in range. */
  fill(h: number): void;
  to(y: number): void;
}

/** A `w` x `h` window opened `start` px down the list; `moved` hears each new offset (to keep it
 *  over a rebuild). */
export function scrollList(w: number, h: number, start: number, moved: (y: number) => void): ScrollList {
  const view = new Container();
  const content = new Container();
  const mask = new Graphics().rect(0, 0, w, h).fill(0xffffff);
  const thumb = new Graphics();
  view.addChild(content, mask, thumb);
  view.mask = mask;
  view.eventMode = 'static';
  view.hitArea = new Rectangle(0, 0, w, h);

  let full = h;
  let y = Math.max(0, start);
  const max = (): number => Math.max(0, full - h);
  const apply = (): void => {
    content.y = -y;
    thumb.clear();
    if (full <= h + 1) return;
    const th = Math.max(60, (h * h) / full);
    thumb.roundRect(w - 9, (y / max()) * (h - th), 6, th, 3).fill({ color: P.line, alpha: 0.3 });
  };
  const to = (v: number): void => {
    const c = Math.min(max(), Math.max(0, v));
    if (c !== y) {
      y = c;
      moved(y);
    }
    apply();
  };

  // the press, in the window's units; `v` is the fling's speed in px per ms
  let press: { y0: number; from: number; dragging: boolean; last: number; at: number } | null = null;
  let v = 0;
  const local = (e: FederatedPointerEvent): number => view.toLocal(e.global).y;
  view.on('pointerdown', (e) => {
    const ly = local(e);
    press = { y0: ly, from: y, dragging: false, last: ly, at: performance.now() };
    v = 0;
  });
  view.on('globalpointermove', (e) => {
    if (!press) return;
    const ly = local(e);
    if (!press.dragging && Math.abs(ly - press.y0) < SLOP) return;
    if (!press.dragging) {
      press.dragging = true;
      // the row under the finger lets go of its tap
      content.interactiveChildren = false;
    }
    const now = performance.now();
    if (now > press.at) v = 0.8 * ((press.last - ly) / (now - press.at)) + 0.2 * v;
    press.last = ly;
    press.at = now;
    to(press.from - (ly - press.y0));
  });
  const up = (): void => {
    if (!press) return;
    if (press.dragging) {
      // after this release's tap has found no row
      queueMicrotask(() => {
        if (!content.destroyed) content.interactiveChildren = true;
      });
      // held still before letting go: no fling
      if (performance.now() - press.at > 80) v = 0;
    } else v = 0;
    press = null;
  };
  view.on('pointerup', up);
  view.on('pointerupoutside', up);
  view.on('pointercancel', up);
  view.on('wheel', (e: FederatedWheelEvent) => {
    v = 0;
    to(y + e.deltaY / (Math.hypot(view.worldTransform.c, view.worldTransform.d) || 1));
  });

  let then = 0;
  view.onRender = () => {
    const now = performance.now();
    const dt = then ? Math.min(50, now - then) : 0;
    then = now;
    if (press || v === 0) return;
    to(y + v * dt);
    v = y <= 0 || y >= max() || Math.abs(v) < 0.02 ? 0 : v * COAST ** dt;
  };

  return {
    view,
    content,
    get offset() {
      return y;
    },
    fill(hh: number) {
      full = Math.max(h, hh);
      to(y);
    },
    to(v2: number) {
      v = 0;
      to(v2);
    },
  };
}
