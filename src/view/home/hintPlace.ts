// Where the guide's hand and line go (guideMark.ts): of a few places for each, the one that covers
// least of the rest of the screen. The pointed button, the hand and the line never cover each
// other, and the start button, the hard switch, the stage's name, the claim-all on the
// achievements and a panel's close are kept clear harder than any other button.

import type { Container } from 'pixi.js';
import type { MenuFit } from '../viewport';
import type { Box } from './guideMark';

/** Something on the screen the hand or the line should not cover, and how much it counts. */
export interface Obstacle {
  box: Box;
  weight: number;
}

/** Buttons, and the stage's name, a hint never sits on if there is any other room. */
const KEEP_CLEAR = new Set(['start', 'hardToggle', 'panel_close', 'stagePlate', 'plateStars', 'claim_all']);
/** What covering the pointed button or the hand counts, per unit of area. */
const HARD = 1000;
/** What each unit of distance from the pointed button counts, so the line stays near it. */
const NEAR = 40;

/** `c`'s bounds in `root`'s units. */
export function boxIn(root: Container, c: Container): Box {
  const b = c.getBounds();
  const a = root.toLocal({ x: b.x, y: b.y });
  const z = root.toLocal({ x: b.x + b.width, y: b.y + b.height });
  return { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
}

/** The area two boxes share. */
export function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Everything on `root` that takes taps, other than `target`, what holds it and what fills the
 *  whole page (a panel's shade, which also hides what is under it), and the hands already drawn
 *  (the tabs' own pointers). */
export function obstacles(root: Container, target: Container, fit: MenuFit): Obstacle[] {
  const out: Obstacle[] = [];
  const page = fit.w * fit.h;
  const walk = (c: Container) => {
    if (!c.visible || c === target) return;
    if (c.label === 'hintHand') {
      out.push({ box: boxIn(root, c), weight: HARD });
      return;
    }
    if ((c.eventMode === 'static' || KEEP_CLEAR.has(c.label)) && !holds(c, target)) {
      const box = boxIn(root, c);
      if (box.w * box.h < page * 0.9) out.push({ box, weight: KEEP_CLEAR.has(c.label) ? 10 : 1 });
      // a panel's shade: what lies under it is out of play, but for the hands drawn on it
      else out.splice(0, out.length, ...out.filter((o) => o.weight >= HARD));
    }
    for (const child of c.children) walk(child as Container);
  };
  for (const child of root.children) walk(child as Container);
  return out;
}

function holds(c: Container, target: Container): boolean {
  for (let p: Container | null = target; p; p = p.parent) if (p === c) return true;
  return false;
}

/** What a box covers: the obstacles by their weight, and `hard` boxes by far more. */
export function cost(b: Box, obs: Obstacle[], hard: Box[]): number {
  let sum = 0;
  for (const h of hard) sum += overlap(b, h) * HARD;
  for (const o of obs) sum += overlap(b, o.box) * o.weight;
  return sum;
}

/** The cheapest of `options` (the first on a tie), each scored by `score`. */
export function cheapest<T>(options: T[], score: (o: T) => number): T {
  let best = options[0];
  let low = Infinity;
  for (const o of options) {
    const s = score(o);
    if (s < low) [best, low] = [o, s];
  }
  return best;
}

/** The centre for a `cw` x `ch` line pointing at `r`: past the hand (`first`), else over or
 *  under it, else down the page, wherever it covers least and stays near; never on `r` or the
 *  hands. */
export function placeCard(r: Box, first: { x: number; y: number }, cw: number, ch: number, fit: MenuFit, obs: Obstacle[], hands: Box[]): { x: number; y: number } {
  const clampX = (v: number) => Math.max(cw / 2 + 20, Math.min(fit.w - cw / 2 - 20, v));
  const clampY = (v: number) => Math.max(ch / 2 + 20, Math.min(fit.h - ch / 2 - 20, v));
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const spots = [first, { x: cx, y: r.y - 40 - ch / 2 }, { x: cx, y: r.y + r.h + 40 + ch / 2 }];
  if (fit.wide) spots.push({ x: r.x + r.w + 60 + cw / 2, y: cy }, { x: r.x - 60 - cw / 2, y: cy });
  for (let y = ch / 2 + 20; y <= fit.h - ch / 2 - 20; y += 30) spots.push({ x: cx, y });
  const placed = spots.map((s) => ({ x: clampX(s.x), y: clampY(s.y) }));
  const pad: Box = { x: r.x - 14, y: r.y - 14, w: r.w + 28, h: r.h + 28 };
  return cheapest(placed, (p) => {
    const b = { x: p.x - cw / 2, y: p.y - ch / 2, w: cw, h: ch };
    return cost(b, obs, [pad, ...hands]) + Math.hypot(p.x - cx, p.y - cy) * NEAR;
  });
}
