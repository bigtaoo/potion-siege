// Aiming the commander's spell: press its badge and drag onto the road, a ring of the spell's
// reach under the finger and every enemy it would catch outlined white; let go there to cast it.
// Back on the badge or off the road, nothing is cast and the charge stays. A tap with no drag
// throws it at the thickest crowd as before. With a mouse a click on the badge picks the spell up
// instead: the ring follows the pointer, a click on the road casts it there, a second click on the
// badge throws it at the thickest crowd, a click anywhere else puts it down.

import { Graphics } from 'pixi.js';
import type { Battle } from '../../sim/battle';
import { FP } from '../../sim/math/fixed';
import { BALANCE } from '../../sim/types';
import { onCommander } from './commander';
import { SPELL_COLOR } from './spellLook';
import { WALL_TOP } from './wall';

const F = BALANCE.field;
/** How far the finger goes from where it pressed before a press is a drag, not a tap. */
export const DRAG_MIN = 30;
/** The ring's colour where letting go would cast nothing. */
const NOWHERE = 0x9a8f80;
const WHITE = 0xffffff;

/** Whether (x, y) in the field's frame is on the road, where a spell can land. */
export function onRoad(x: number, y: number): boolean {
  return x >= F.left && x <= F.right && y >= F.top && y <= WALL_TOP;
}

type Point = { x: number; y: number };

export class CastAim {
  /** The ring and the outlines, over the enemies. */
  readonly g = new Graphics();
  /** Off; held down on the badge (a drag or a tap to come); or picked up by a mouse click. */
  private state: 'off' | 'held' | 'armed' = 'off';
  private from: Point = { x: 0, y: 0 };
  private at: Point = { x: 0, y: 0 };
  private moved = false;

  /** Whether the aim takes every press and move, not only those on the badge. */
  get active(): boolean {
    return this.state !== 'off';
  }

  /** Whether the ring shows: a drag under way, or a picked-up spell. */
  get showing(): boolean {
    return (this.state === 'held' && this.moved) || this.state === 'armed';
  }

  /** Nothing aimed, as a new battle starts. */
  reset(): void {
    this.state = 'off';
    this.g.clear();
  }

  /** A press at `p`: whether it was the aim's to take. */
  down(b: Battle | null, p: Point): boolean {
    if (this.state === 'armed') {
      this.state = 'off';
      if (b?.canCast()) {
        if (onCommander(p.x, p.y)) b.cast();
        else if (onRoad(p.x, p.y)) b.cast(toFpPoint(p));
      }
      return true;
    }
    if (!onCommander(p.x, p.y)) return false;
    if (b?.canCast() && !b.paused) {
      this.state = 'held';
      this.from = { ...p };
      this.at = { ...p };
      this.moved = false;
    }
    return true;
  }

  move(p: Point): void {
    if (this.state === 'off') return;
    this.at = { ...p };
    if (Math.hypot(p.x - this.from.x, p.y - this.from.y) > DRAG_MIN) this.moved = true;
  }

  /** The press lets go at `p`; `mouse` for a mouse, where a click picks the spell up. */
  up(b: Battle | null, p: Point, mouse: boolean): void {
    if (this.state !== 'held') return;
    this.at = { ...p };
    if (!this.moved) {
      if (mouse) {
        this.state = 'armed';
        return;
      }
      b?.cast();
    } else if (b && castsAt(p)) b.cast(toFpPoint(p));
    this.state = 'off';
  }

  /** Draws the ring and the outlines for this frame; the aim drops if the spell went off by itself. */
  draw(b: Battle): void {
    const g = this.g.clear();
    if (this.state !== 'off' && !b.canCast()) this.state = 'off';
    if (!this.showing) return;
    const { x, y } = this.at;
    const skill = b.nextCast;
    const radius = BALANCE.commander[skill].radius;
    if (!castsAt(this.at)) {
      g.circle(x, y, radius).stroke({ width: 5, color: NOWHERE, alpha: 0.7 });
      return;
    }
    const color = SPELL_COLOR[skill];
    g.circle(x, y, radius).fill({ color, alpha: 0.18 }).stroke({ width: 6, color, alpha: 0.9 });
    g.moveTo(x - 20, y).lineTo(x + 20, y).moveTo(x, y - 20).lineTo(x, y + 20).stroke({ width: 5, color: WHITE, alpha: 0.85 });
    for (const e of b.enemies) {
      if (e.hp <= 0) continue;
      const ex = e.x / FP;
      const ey = e.y / FP;
      const er = e.radius / FP;
      if (Math.hypot(ex - x, ey - y) > radius + er) continue;
      g.circle(ex, ey, er + 8).stroke({ width: 5, color: WHITE, alpha: 0.95 });
    }
  }
}

/** Whether letting go at `p` casts there: on the road and off the badge. */
function castsAt(p: Point): boolean {
  return onRoad(p.x, p.y) && !onCommander(p.x, p.y);
}

function toFpPoint(p: Point): Point {
  return { x: Math.round(p.x * FP), y: Math.round(p.y * FP) };
}
