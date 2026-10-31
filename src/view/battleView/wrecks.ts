// What is left of an enemy for a moment after it dies: its sprite as last drawn flashes white, then
// tips over, slumps and fades while its gears fly (gearBurst); a boss shudders a while before it
// goes. Also the white flash over an enemy that is hit.

import type { Texture } from 'pixi.js';
import type { SpriteLayer } from '../art';
import { aside } from '../landView';

/** Seconds a wreck stays, a boss's longer. */
export const WRECK_TIME = 0.3;
export const BOSS_WRECK_TIME = 0.8;
/** Wrecks on the field at most; a horde's past that just vanish. */
export const MAX_WRECKS = 24;

/** An enemy's sprite as it was last drawn. */
export interface Snapshot {
  tex: Texture;
  x: number;
  y: number;
  sx: number;
  sy: number;
  rot: number;
  tint: number;
}

interface Wreck extends Snapshot {
  at: number;
  ttl: number;
  boss: boolean;
  /** Which way it tips over. */
  side: number;
}

/** A copy of sprite `s` in `flash` (which adds its light) at `alpha`: `s` lit up white. */
export function flashOver(flash: SpriteLayer, s: Snapshot, alpha: number): void {
  const f = flash.put(s.tex, s.x, s.y, s.tex.height);
  f.scale.set(s.sx, s.sy);
  f.rotation = s.rot;
  f.alpha = alpha;
  f.blendMode = 'add';
}

export class Wrecks {
  private list: Wreck[] = [];

  clear(): void {
    this.list = [];
  }

  get count(): number {
    return this.list.length;
  }

  /** An enemy drawn as `snap` died at view time `now`. */
  add(snap: Snapshot, now: number, boss: boolean): void {
    if (this.list.length >= MAX_WRECKS) return;
    this.list.push({ ...snap, at: now, ttl: boss ? BOSS_WRECK_TIME : WRECK_TIME, boss, side: snap.x % 2 < 1 ? 1 : -1 });
  }

  /** Draws the wrecks into `art` (and their flash into `flash`) at view time `now`; `soft` (reduced
   *  motion) keeps them half as long and still. */
  draw(art: SpriteLayer, flash: SpriteLayer, now: number, soft: boolean): void {
    let n = 0;
    for (const w of this.list) {
      const p = (now - w.at) / (soft ? w.ttl / 2 : w.ttl);
      if (p >= 1 || p < 0) continue;
      this.list[n++] = w;
      // a boss shudders through most of it and comes down only at the end
      const fall = w.boss ? Math.max(0, (p - 0.6) / 0.4) : p;
      const shudder = w.boss && !soft ? Math.sin(p * 80) * 6 * (1 - p) : 0;
      const at = aside(w.x, w.y, shudder, 10 * fall);
      const s = art.put(w.tex, at.x, at.y, w.tex.height);
      s.scale.set(w.sx * (1 + 0.15 * fall), w.sy * (1 - 0.45 * fall));
      s.rotation = soft ? w.rot : w.rot + w.side * 0.9 * (1 - (1 - fall) ** 2);
      s.alpha = 1 - fall * fall;
      s.tint = w.tint;
      const lit = w.boss ? 1 - p / 0.6 : 1 - p / 0.35;
      if (lit > 0) flashOver(flash, { ...w, x: s.x, y: s.y, sx: s.scale.x, sy: s.scale.y, rot: s.rotation }, lit * 0.8);
    }
    this.list.length = n;
  }
}
