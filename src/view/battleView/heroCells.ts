// The heroes on the wall as the battle draws them, cell by cell: whose turn it is to throw and
// where at, the one just summoned flying in from the commander's flask, the one just moved landing
// in its new cell, the ones dazed by the anvil, and the one held under the finger.

import type { Graphics } from 'pixi.js';
import { SLOT_COUNT, slotCenter, type Battle } from '../../sim/battle';
import { TICK_RATE } from '../../sim/math/fixed';
import { BALANCE } from '../../sim/types';
import type { SpriteLayer } from '../art';
import { stunStars } from '../effects';
import { aside, drawUpright, isLand } from '../landView';
import { INK, type PotionLayer } from '../potion';
import { COLORS } from '../ui';
import { BREW_COLOR, commanderMid } from './commander';
import { STILL, drawCell, type FigureAnim } from './figures';
import type { MergeAnims } from './merges';

const G = BALANCE.grid;
/** Seconds before a throw that the arm starts drawing back. */
const WIND_UP = 0.25;
/** Seconds a summoned hero flies from the flask to its cell, and a moved one takes to land. */
export const FLIGHT = 0.3;
export const LANDING = 0.25;
/** How far (view units) a throw at a target that far off to the side leans all the way. */
const AIM_SPAN = 400;
/** How much bigger the potions of a level 1-3 cell stand on an upright field, where the cells
 *  are small on the screen; a field on its side keeps them as they are. */
export const UPRIGHT_SCALE = 1.18;

/** The size the figures of a level `star` hero stand at in their cell. */
export function cellScale(star: number): number {
  return isLand() || star >= BALANCE.maxStar ? 1 : UPRIGHT_SCALE;
}

/** The corner badge of a cell centred on (x, y), its hero at level `star`: that many gold stars
 *  on a dark tab, upright on the screen at the cell's top left corner. */
export function starBadge(g: Graphics, x: number, y: number, star: number): void {
  const at = aside(x, y, -G.cellW / 2 + 6, -G.cellH / 2 + 4);
  const w = 12 + star * 18;
  drawUpright(g, at.x, at.y, (ox, oy) => {
    g.roundRect(ox, oy, w, 26, 13).fill({ color: INK, alpha: 0.78 }).stroke({ width: 2, color: COLORS.gold });
    for (let i = 0; i < star; i++) g.star(ox + 15 + i * 18, oy + 13, 5, 8, 3.6, 0).fill(COLORS.gold);
  });
}

/** What the view remembers about the hero in a cell, to animate its throws and arrival. */
export interface CellAnim {
  id: number;
  shots: number;
  /** Battle time (seconds) of its last throw. */
  lastShot: number;
  /** View time it appeared, and it landed after a move. */
  born: number;
  landed: number;
  /** -1 to 1: how far to the left or right on the screen it last threw. */
  aim: number;
}

/** The lean of something that moved `dx` right of where it was on the screen. */
export function aimAt(dx: number): number {
  return Math.max(-1, Math.min(1, dx / AIM_SPAN));
}

/** How a hero moved into its cell `since` seconds ago lands: squashed flat, then springing back. */
export function landing(since: number): number {
  if (since < 0 || since >= LANDING) return 0;
  const k = since / LANDING;
  return 0.3 * (1 - k) ** 2 * Math.cos(k * Math.PI * 2.5);
}

/** Where a hero summoned `k` (0-1) of the way through its flight is, from (x0, y0) to (x1, y1) in
 *  an arc above the straight line. */
export function arc(x0: number, y0: number, x1: number, y1: number, k: number): { x: number; y: number } {
  const lift = Math.sin(Math.PI * k) * 160;
  return { ...aside(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 0, -lift) };
}

/** What marks cell `s` (centred on `c`, its hero at level `star`) besides its heroes: a gold
 *  glow when the held hero can merge into it, a gold ring round a top-level hero, its level on a
 *  badge in the corner (over the heroes), the purple of the commander's brew bubbling while it lasts. */
function cellMarks(g: Graphics, ho: Graphics, b: Battle, s: number, c: { x: number; y: number }, match: boolean, star: number, t: number): void {
  const x = c.x - G.cellW / 2 + 8;
  const y = c.y - G.cellH / 2 + 8;
  const w = G.cellW - 16;
  const ht = G.cellH - 16;
  if (match) g.roundRect(x - 10, y - 10, w + 20, ht + 20, 32).fill({ color: COLORS.gold, alpha: 0.3 + 0.2 * Math.sin(t * 10) });
  // the cell's slab is part of the wall (drawWall)
  if (star >= BALANCE.maxStar) g.roundRect(x, y, w, ht, 12).stroke({ width: 6, color: COLORS.gold });
  if (match) g.roundRect(x, y, w, ht, 20).stroke({ width: 6, color: COLORS.gold });
  if (star) starBadge(ho, c.x, c.y, star);
  if (!star || b.brewTime <= 0) return;
  const fade = Math.min(1, b.brewTime / TICK_RATE / 0.5);
  g.ellipse(c.x, c.y + 38, 58 + 6 * Math.sin(t * 8 + s), 22).fill({ color: BREW_COLOR, alpha: 0.45 * fade });
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.9 + i / 3 + s * 0.37) % 1;
    ho.circle(c.x + Math.sin(s * 3 + i * 2.1) * 40, c.y + 40 - k * 110, 7 * (1 - k) + 3).fill({ color: BREW_COLOR, alpha: (1 - k) * 0.8 * fade });
  }
}

export class HeroCells {
  private anims: (CellAnim | null)[] = [];
  /** View time each slot's summon left the flask. */
  private flights = new Map<number, number>();
  /** View time each hero (by id) was moved to another cell. */
  private moves = new Map<number, number>();
  /** The held hero's lean and stretch, eased toward how fast the finger moves. */
  private lean = 0;
  private stretch = 0;
  private last = { x: 0, y: 0 };

  constructor(private readonly merges: MergeAnims) {}

  clear(): void {
    this.anims = [];
    this.flights.clear();
    this.moves.clear();
  }

  /** The hero in `slot` threw at (tx, ty) (view units) at battle time `bt`: its anim, to place
   *  the throw. */
  shot(slot: number, bt: number, tx: number, ty: number): CellAnim | null {
    const a = this.anims[slot];
    if (!a) return null;
    a.shots++;
    a.lastShot = bt;
    const c = slotCenter(slot);
    a.aim = aimAt(isLand() ? c.y - ty : tx - c.x);
    return a;
  }

  /** A hero was summoned into `slot` at view time `now`. */
  summoned(slot: number, now: number): void {
    this.flights.set(slot, now);
  }

  /** The hero `id` was moved to another cell at view time `now`. */
  moved(id: number, now: number): void {
    this.moves.set(id, now);
  }

  /** The held hero, its finger at `at`, `dt` seconds after the last frame: it leans and
   *  stretches the way it is dragged. */
  held(at: { x: number; y: number }, dt: number): FigureAnim {
    const vx = dt > 0 ? (isLand() ? this.last.y - at.y : at.x - this.last.x) / dt : 0;
    const vy = dt > 0 ? (isLand() ? at.x - this.last.x : at.y - this.last.y) / dt : 0;
    this.last = { ...at };
    const ease = Math.min(1, dt * 14);
    this.lean += (Math.max(-0.4, Math.min(0.4, vx / 2500)) - this.lean) * ease;
    this.stretch += (Math.min(0.15, Math.hypot(vx, vy) / 12000) - this.stretch) * ease;
    return { ...STILL, spin: this.lean, squash: -this.stretch };
  }

  /** Lets go of the held hero: it starts from rest next time. */
  drop(at: { x: number; y: number }): void {
    this.last = { ...at };
    this.lean = this.stretch = 0;
  }

  /** Draws the heroes of `b` at view time `now` and battle time `bt`: cells on `g`, over them
   *  on `ho`, figures into `art` and `potions`. `from` is the cell being dragged, `hint` the cells
   *  to hop, `foes` whether there is anything to throw at. */
  draw(b: Battle, g: Graphics, ho: Graphics, art: SpriteLayer, potions: PotionLayer, now: number, bt: number, from: number | null, hint: number[] | null, foes: boolean): void {
    for (let s = 0; s < SLOT_COUNT; s++) {
      const h = b.slots[s];
      // cells not built yet are just ground
      if (!b.isOpen(s)) continue;
      const c = slotCenter(s);
      const match = from !== null && b.canMerge(from, s);
      cellMarks(g, ho, b, s, c, match, h ? h.star : 0, now);
      if (!h) {
        this.anims[s] = null;
        continue;
      }
      let a = this.anims[s];
      if (!a || a.id !== h.id) a = this.anims[s] = this.arrive(h.id, s, now);
      // the figures of a cell take turns to throw; the next one draws back just before
      const cell = a;
      const n = h.star >= BALANCE.maxStar ? 1 : h.star;
      // the cooldown is in thousandths of a tick
      const left = h.cooldown / (TICK_RATE * 1000);
      const stunned = (h.stunTime ?? 0) > 0;
      // with nothing to shoot at the cooldown keeps resetting to a few hundredths: no wind-up then;
      // a dazed one lets its arm down and sways
      const wind = foes && !stunned && left > 0 && left < WIND_UP ? 1 - left / WIND_UP : 0;
      const daze = stunned ? Math.sin(bt * 9 + s) * 0.12 : undefined;
      const squash = landing(now - cell.landed) || undefined;
      const anim = (i: number): FigureAnim => ({
        wind: i === cell.shots % n ? wind : 0,
        since: cell.shots > 0 && i === (cell.shots - 1) % n ? bt - cell.lastShot : Infinity,
        pop: now - cell.born,
        aim: cell.aim,
        spin: daze !== undefined ? daze + i * 0.03 : undefined,
        squash,
      });
      const hop = hint?.includes(s) ? Math.abs(Math.sin(now * 7)) * 16 : 0;
      const mid = aside(c.x, c.y, 0, -10 - hop);
      // while dragging, the heroes it can merge with glow and everything else steps back
      const dim = from !== null && s !== from && !match;
      drawCell(now, g, ho, art, potions, h.kind, h.star, mid.x, mid.y, cellScale(h.star), s === from ? 0.35 : 1, s, dim, anim);
      if (stunned) stunStars(ho, c.x, c.y - G.cellH / 2 - 6, now);
    }
    this.flying(b, g, ho, art, potions, now);
  }

  /** The anim of hero `id` new in `slot` at view time `now`: it pops in once its merge has
   *  fused or its summon has flown in, or lands if it was only moved. */
  private arrive(id: number, slot: number, now: number): CellAnim {
    const a: CellAnim = { id, shots: 0, lastShot: -99, born: this.merges.bornAt(slot, now), landed: -99, aim: 0 };
    const moved = this.moves.get(id);
    this.moves.delete(id);
    const flew = this.flights.get(slot);
    if (moved !== undefined && now - moved < 1) {
      a.born = -99;
      a.landed = now;
    } else if (flew !== undefined) a.born = Math.max(a.born, flew + FLIGHT);
    return a;
  }

  /** The summoned heroes on their way from the commander's flask to their cells. */
  private flying(b: Battle, g: Graphics, ho: Graphics, art: SpriteLayer, potions: PotionLayer, now: number): void {
    for (const [slot, at] of this.flights) {
      const k = (now - at) / FLIGHT;
      const h = b.slots[slot];
      if (k >= 1 || !h) {
        this.flights.delete(slot);
        continue;
      }
      if (k < 0) continue;
      const from = commanderMid();
      const to = slotCenter(slot);
      const p = arc(from.x, from.y, to.x, to.y - 10, k);
      // a spark trails it
      g.circle(p.x, p.y, 10 * (1 - k) + 4).fill({ color: COLORS.gold, alpha: 0.6 });
      const spin = (1 - k) * Math.PI * 2;
      drawCell(now, g, ho, art, potions, h.kind, h.star, p.x, p.y, (0.5 + 0.5 * k) * cellScale(h.star), 1, slot, false, () => ({ ...STILL, spin }));
    }
  }
}
