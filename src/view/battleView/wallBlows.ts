// An enemy's blow landing on the wall: a puff of dust at the wall's foot and chips of stone
// jumping off it. Only a few a frame, so a horde beating on the wall stays readable.

import type { Graphics } from 'pixi.js';
import type { EnemyKind } from '../../sim/types';
import { aside } from '../landView';
import type { FxLayer } from './fxLayer';

/** Blows a frame that get dust and chips; the rest land unseen. */
export const BLOWS_PER_FRAME = 4;
/** The kinds whose blows shake the screen a little. */
export const HEAVY: ReadonlySet<EnemyKind> = new Set<EnemyKind>(['brute', 'boss', 'clock', 'tripod', 'gear']);
const DUST = 0xc8b89a;
const STONE = 0x9a8f86;

/** Three chips jumping off the wall at (x, y) and falling back, `k` going 0 to 1. */
export function chips(g: Graphics, x: number, y: number, size: number, seed: number, k: number): void {
  for (let i = 0; i < 3; i++) {
    const a = seed + i * 2.1;
    const p = aside(x, y, Math.cos(a) * 40 * size * k, -Math.abs(Math.sin(a)) * 50 * size * k * (1 - k) * 2);
    g.rect(p.x - 4 * size, p.y - 4 * size, 8 * size, 8 * size).fill({ color: STONE, alpha: 1 - k });
  }
}

/** The blow of an enemy of `kind` and `radius` at (x, y) (the middle of its feet), on `fx`. */
export function wallBlow(fx: FxLayer, x: number, y: number, radius: number, kind: EnemyKind): void {
  // where it meets the wall: in front of it
  const size = Math.min(2, radius / 30);
  const wy = y + radius;
  const seed = x * 0.37;
  fx.burst(x, wy, 18 + radius * 0.6, DUST, HEAVY.has(kind) ? 0.35 : 0.22);
  fx.effect(0.3, (g, life) => chips(g, x, wy, size, seed, 1 - life));
}
