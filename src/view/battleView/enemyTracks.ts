// What the view remembers about each enemy from frame to frame, to show what the sim does not draw:
// the blow that just hit it, the HP it just lost (left as a trail on its bar), the wind that threw it
// back, the blows it beats on the wall, and the sprite it last stood as, for its wreck.

import type { Sprite } from 'pixi.js';
import type { Enemy } from '../../sim/types';
import { BASH_IMPACT, bashPhase } from '../enemyGait';
import type { Reaction } from '../enemyPose';
import type { Snapshot } from './wrecks';

/** Seconds a hit shows on an enemy, a knock back takes, its lost HP waits before draining. */
export const HIT_TIME = 0.12;
export const PUSH_TIME = 0.35;
const TRAIL_WAIT = 0.25;
/** Fraction of its bar the trail drains a second. */
const TRAIL_DRAIN = 1.5;
/** How far (world units) from where it was last drawn a kill may be and still be this enemy's. */
const DIED_NEAR = 60;

interface Track {
  /** Where it was last drawn, world units. */
  x: number;
  y: number;
  hp: number;
  hitAt: number;
  pushAt: number;
  trail: number;
  /** Its blow on the wall last frame, -1 when it was not beating on it. */
  bash: number;
  snap: Snapshot;
  boss: boolean;
  frame: number;
}

const NONE: Snapshot = { tex: undefined as never, x: 0, y: 0, sx: 1, sy: 1, rot: 0, tint: 0xffffff };

/** Where `s` stands now, kept in `into`. */
export function keep(s: Sprite, into: Snapshot): void {
  into.tex = s.texture;
  into.x = s.x;
  into.y = s.y;
  into.sx = s.scale.x;
  into.sy = s.scale.y;
  into.rot = s.rotation;
  into.tint = s.tint as number;
}

export class EnemyTracks {
  private tracks = new Map<number, Track>();
  /** Where blows landed (and how wide) since the last frame. */
  private strikes: number[] = [];
  /** Where enemies died since the last frame. */
  private deaths: number[] = [];
  private frame = 0;
  private now = 0;
  private dt = 0;

  clear(): void {
    this.tracks.clear();
    this.strikes.length = 0;
    this.deaths.length = 0;
  }

  /** A blow landed on everything within `r` of (x, y). */
  strike(x: number, y: number, r: number): void {
    this.strikes.push(x, y, r);
  }

  /** An enemy died at (x, y). */
  died(x: number, y: number): void {
    this.deaths.push(x, y);
  }

  /** The enemy `id` was thrown back by the wind. */
  pushed(id: number): void {
    const t = this.tracks.get(id);
    if (t) t.pushAt = this.now;
  }

  /** A new frame at view time `now`. */
  begin(now: number): void {
    this.frame++;
    this.dt = Math.max(0, Math.min(0.1, now - this.now));
    this.now = now;
  }

  /** The track of `e` (as drawn) this frame, hit if it lost HP where a blow landed. */
  see(e: Enemy, boss: boolean): Track {
    let t = this.tracks.get(e.id);
    if (!t) {
      t = { x: e.x, y: e.y, hp: e.hp, hitAt: -99, pushAt: -99, trail: e.hp, bash: -1, snap: { ...NONE }, boss, frame: 0 };
      this.tracks.set(e.id, t);
    }
    if (e.hp < t.hp && this.struck(e)) t.hitAt = this.now;
    t.hp = e.hp;
    t.x = e.x;
    t.y = e.y;
    t.frame = this.frame;
    if (t.trail <= e.hp) t.trail = e.hp;
    else if (this.now - t.hitAt > TRAIL_WAIT) t.trail = Math.max(e.hp, t.trail - e.maxHp * TRAIL_DRAIN * this.dt);
    return t;
  }

  /** How `e`'s track shows on it now. */
  reaction(t: Track, spin: number): Reaction {
    const hit = Math.max(0, 1 - (this.now - t.hitAt) / HIT_TIME);
    const push = Math.max(0, 1 - (this.now - t.pushAt) / PUSH_TIME);
    return { hit, push, spin };
  }

  /** Whether `e` (at the wall when `atWall`) brought a blow down on it since last frame at battle
   *  time `bt`. */
  blow(t: Track, e: Enemy, bt: number, atWall: boolean): boolean {
    const was = t.bash;
    t.bash = atWall ? bashPhase(e, bt) : -1;
    if (was < 0 || t.bash < 0) return false;
    // through the impact, or round past it (the phase wraps at 1)
    return was < t.bash ? was < BASH_IMPACT && t.bash >= BASH_IMPACT : was < BASH_IMPACT || t.bash >= BASH_IMPACT;
  }

  /** Ends the frame: each enemy gone since that died near where it was last drawn goes to
   *  `wreck`. */
  end(wreck: (snap: Snapshot, boss: boolean) => void): void {
    for (const [id, t] of this.tracks) {
      if (t.frame === this.frame) continue;
      this.tracks.delete(id);
      if (t.snap.tex && this.diedAt(t.x, t.y)) wreck(t.snap, t.boss);
    }
    this.strikes.length = 0;
    this.deaths.length = 0;
  }

  private struck(e: Enemy): boolean {
    const s = this.strikes;
    for (let i = 0; i < s.length; i += 3) {
      const r = s[i + 2] + e.radius;
      if ((e.x - s[i]) ** 2 + (e.y - s[i + 1]) ** 2 <= r * r) return true;
    }
    return false;
  }

  private diedAt(x: number, y: number): boolean {
    const d = this.deaths;
    for (let i = 0; i < d.length; i += 2) {
      if ((x - d[i]) ** 2 + (y - d[i + 1]) ** 2 <= DIED_NEAR * DIED_NEAR) {
        d.splice(i, 2);
        return true;
      }
    }
    return false;
  }
}
