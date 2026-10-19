// Finding enemies on the field for the battle: who is within a reach, the nearest, the front of
// the crowd, and the living front first.

import type { Battle } from './battle';
import { dist2 } from './math/fixed';
import type { Enemy } from './types';

/** The y of the frontmost enemy that is not a winder, or -Infinity with none on the field. */
export function frontY(b: Battle): number {
  let y = -Infinity;
  for (const e of b.enemies) if (e.kind !== 'winder' && e.hp > 0) y = Math.max(y, e.y);
  return y;
}

/** Whether `o` is within `range` (FP) of (x, y), counting its own radius. */
export function within(o: Enemy, x: number, y: number, range: number): boolean {
  const r = range + o.radius;
  return dist2(o.x - x, o.y - y) <= r * r;
}

/** Alive enemies, front (closest to the wall) first. */
export function targets(b: Battle): Enemy[] {
  return b.enemies.filter((e) => e.hp > 0).sort((a, b) => b.y - a.y);
}

export function nearest(b: Battle, from: Enemy, range: number, skip: Set<number>): Enemy | undefined {
  let best: Enemy | undefined;
  let bestD = range * range;
  for (const e of b.enemies) {
    if (e.hp <= 0 || skip.has(e.id)) continue;
    const d = dist2(e.x - from.x, e.y - from.y);
    if (d <= bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}
