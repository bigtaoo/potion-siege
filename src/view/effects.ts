// Hit, chain, kill and frozen effects in the same sticker style as the characters: flat
// colours with a dark ink outline, so they read on the bright field. `p` runs 0 to 1 over
// the effect's life.

import type { Graphics } from 'pixi.js';
import type { HeroKind } from '../sim/types';
import { INK, snowflake, star } from './potion';

const ICE: [number, number, number] = [0x3fb8e6, 0xa8f4ff, 0xffffff];
// deeper than the potion's own stars: pale lilac fades on the stone road
const ARCANE: [number, number, number] = [0x7a1fc4, 0xa45cf5, 0xf0e0ff];
const BOLT_FILL = 0xffe94a;
const WIND: [number, number] = [0x8fe3c8, 0xeafff8];
const LEAF = 0x7cc35a;

/** How long each kind's hit effect lasts, in seconds. */
export const HIT_TIME: Record<HeroKind | 'poison', number> = { fire: 0.4, ice: 0.35, lightning: 0.3, arcane: 0.35, poison: 0.3, wind: 0.3 };

const easeOut = (p: number): number => 1 - (1 - p) * (1 - p);
/** Full strength for most of the life, then fading out. */
const fade = (p: number): number => (p < 0.6 ? 1 : (1 - p) / 0.4);

/** A spiky star polygon: `spikes` points out to `r`, valleys at `r * inner`. */
function burstPoly(x: number, y: number, r: number, inner: number, spikes: number, angle: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = angle + (i * Math.PI) / spikes;
    const d = i % 2 ? r * inner : r;
    out.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  return out;
}

export function hitEffect(g: Graphics, kind: HeroKind | 'poison', x: number, y: number, radius: number, p: number): void {
  const seed = (x * 7 + y * 13) % 6.283;
  const a = fade(p);
  const e = easeOut(Math.min(1, p * 3));
  switch (kind) {
    case 'fire': {
      // a flame splash the size of the blast, with embers thrown out of it
      const r = radius * (0.5 + 0.4 * e);
      g.poly(burstPoly(x, y, r, 0.62, 9, seed)).fill({ color: 0xff6a1f, alpha: a }).stroke({ width: 5, color: INK, alpha: a, join: 'round' });
      g.poly(burstPoly(x, y, r * 0.6, 0.6, 7, -seed)).fill({ color: 0xffd23a, alpha: a });
      g.circle(x, y, r * 0.22).fill({ color: 0xfff3b0, alpha: a });
      for (let i = 0; i < 6; i++) {
        const ang = seed + (i * Math.PI) / 3;
        const d = radius * (0.35 + 0.9 * easeOut(p));
        g.circle(x + Math.cos(ang) * d, y + Math.sin(ang) * d - 30 * p, 4 + 6 * (1 - p)).fill({ color: 0xffb020, alpha: a }).stroke({ width: 3, color: INK, alpha: a });
      }
      break;
    }
    case 'ice': {
      // crystal shards flying out of a snowflake
      for (let i = 0; i < 6; i++) {
        const ang = seed + (i * Math.PI) / 3;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const d = 14 + 60 * e;
        const bx = x + c * d;
        const by = y + s * d;
        const len = 30 * (1 - p * 0.5);
        g.poly([bx + c * len, by + s * len, bx - s * 8, by + c * 8, bx - c * len * 0.4, by - s * len * 0.4, bx + s * 8, by - c * 8])
          .fill({ color: ICE[1], alpha: a })
          .stroke({ width: 3.5, color: INK, alpha: a, join: 'round' });
      }
      if (p < 0.7) snowflake(g, x, y, 30 * (1 - p * 0.6), seed + p * 3, ICE, 3);
      break;
    }
    case 'lightning': {
      // short zigzag sparks radiating from a white flash
      for (let i = 0; i < 5; i++) {
        const ang = seed + (i * 2 * Math.PI) / 5;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const d0 = 10 + 10 * e;
        const d1 = d0 + 50 * (1 - p * 0.5);
        const mid = (d0 + d1) / 2;
        const pts = [x + c * d0, y + s * d0, x + c * mid - s * 11, y + s * mid + c * 11, x + c * mid + s * 8, y + s * mid - c * 8, x + c * d1, y + s * d1];
        g.poly(pts, false).stroke({ width: 13, color: INK, alpha: a, cap: 'round', join: 'round' });
        g.poly(pts, false).stroke({ width: 6.5, color: BOLT_FILL, alpha: a, cap: 'round', join: 'round' });
      }
      g.circle(x, y, 18 * (1 - p)).fill({ color: 0xffffff, alpha: a }).stroke({ width: 3, color: INK, alpha: a });
      break;
    }
    case 'arcane': {
      for (let i = 0; i < 5; i++) {
        const ang = seed + (i * 2 * Math.PI) / 5;
        const d = 10 + 58 * e;
        if (p < 0.85) star(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d, 22 * (1 - p * 0.6), p * 4 + i, ARCANE, 3.5);
      }
      break;
    }
    case 'wind': {
      // three curls of wind spinning out of the hit, and a leaf blown off
      for (let i = 0; i < 3; i++) {
        const ang = seed + (i * 2 * Math.PI) / 3 + p * 2.5;
        curl(g, x + Math.cos(ang) * (8 + 26 * e), y + Math.sin(ang) * (8 + 26 * e), 20 * (1 - p * 0.4), ang, a);
      }
      leaf(g, x + 46 * e, y - 30 * e, 10, seed + p * 6, a);
      break;
    }
    case 'poison': {
      for (let i = 0; i < 4; i++) {
        const ang = seed + (i * Math.PI) / 2;
        const d = 10 + 30 * e;
        g.circle(x + Math.cos(ang) * d, y + Math.sin(ang) * d - 25 * p, 9 * (1 - p * 0.5)).fill({ color: 0x7ed957, alpha: a }).stroke({ width: 3, color: INK, alpha: a });
      }
      break;
    }
  }
}

/** A forked bolt through the chain's points: ink, then yellow, then a white core. Jitters every frame. */
export function chainBolt(g: Graphics, points: { x: number; y: number }[], life: number): void {
  const pts: number[] = [points[0].x, points[0].y];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    for (let k = 1; k < 5; k++) {
      const off = (Math.random() - 0.5) * 32;
      pts.push(a.x + ((b.x - a.x) * k) / 5 + nx * off, a.y + ((b.y - a.y) * k) / 5 + ny * off);
    }
    pts.push(b.x, b.y);
  }
  // solid while it lasts, getting thinner, rather than see-through (half-faded ink and yellow turn olive)
  const k = 0.45 + 0.55 * life;
  for (const [width, color] of [[26, INK], [15, BOLT_FILL], [6, 0xffffff]] as const) {
    g.poly(pts, false).stroke({ width: width * k, color, cap: 'round', join: 'round' });
  }
}

/** A gear outline: `teeth` square teeth round a disc, with a hole. */
function gear(g: Graphics, x: number, y: number, r: number, angle: number, color: number, alpha: number): void {
  const teeth = 8;
  const pts: number[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = angle + (i * Math.PI * 2) / (teeth * 4);
    const d = i % 4 < 2 ? r : r * 0.74;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill({ color, alpha }).stroke({ width: 3.5, color: INK, alpha, join: 'round' });
  g.circle(x, y, r * 0.3).fill({ color: 0x3a4250, alpha }).stroke({ width: 2.5, color: INK, alpha });
}

/** A clockwork enemy coming apart: a puff of smoke, gears and springs thrown up and falling. */
export function gearBurst(g: Graphics, x: number, y: number, boss: boolean, p: number): void {
  const k = boss ? 2.2 : 1;
  const a = fade(p);
  const e = easeOut(Math.min(1, p * 2.5));
  if (p < 0.5) {
    const q = 1 - p * 2;
    for (const [dx, dy, r] of [[-18, 4, 26], [18, 2, 24], [0, -16, 30]]) {
      g.circle(x + dx * k * (0.6 + e), y + dy * k * (0.6 + e), r * k * (0.5 + 0.6 * e) * q).fill({ color: 0xe8e4dc, alpha: q }).stroke({ width: 4, color: INK, alpha: q });
    }
  }
  const pieces = boss ? 9 : 5;
  for (let i = 0; i < pieces; i++) {
    const ang = -Math.PI / 2 + (i - (pieces - 1) / 2) * 0.55;
    const v = (160 + (i % 3) * 50) * k;
    const px = x + Math.cos(ang) * v * p;
    const py = y + Math.sin(ang) * v * p + 420 * p * p;
    const spin = p * 9 * (i % 2 ? 1 : -1);
    if (i % 3 === 2) {
      // a spring: a short zigzag
      const pts: number[] = [];
      for (let j = 0; j < 6; j++) {
        const t = j / 5 - 0.5;
        const side = j % 2 ? 6 : -6;
        pts.push(px + Math.cos(spin) * t * 36 * k - Math.sin(spin) * side * 1.4 * k, py + Math.sin(spin) * t * 36 * k + Math.cos(spin) * side * 1.4 * k);
      }
      g.poly(pts, false).stroke({ width: 10, color: INK, alpha: a, join: 'round', cap: 'round' });
      g.poly(pts, false).stroke({ width: 4.5, color: 0xb8c2d0, alpha: a, join: 'round', cap: 'round' });
    } else {
      gear(g, px, py, (i % 2 ? 17 : 23) * k, spin, i % 4 === 1 ? 0xc9a24a : 0x9aa6b8, a);
    }
  }
}

/** A block of ice round a frozen enemy whose sprite stands with its feet at (x, feet), `h` tall. */
export function iceShell(g: Graphics, x: number, feet: number, w: number, h: number): void {
  const top = feet - h - 6;
  g.roundRect(x - w / 2, top, w, h + 12, w * 0.22).fill({ color: 0xbff4ff, alpha: 0.42 }).stroke({ width: 5, color: 0x1f5f8a });
  g.moveTo(x - w * 0.3, top + h * 0.18).lineTo(x - w * 0.3, top + h * 0.45).stroke({ width: 5, color: 0xffffff, alpha: 0.85, cap: 'round' });
  g.moveTo(x - w * 0.18, top + h * 0.14).lineTo(x - w * 0.1, top + h * 0.22).stroke({ width: 5, color: 0xffffff, alpha: 0.85, cap: 'round' });
}

/** A winder winding back the enemies round it: a clock face spreading over the ground out to
 *  `radius`, its ticks and a hand sweeping backwards. */
export function rewindWave(g: Graphics, x: number, y: number, radius: number, p: number): void {
  const a = fade(p);
  const r = radius * (0.35 + 0.65 * easeOut(Math.min(1, p * 2)));
  // seen from above at a slant, like the field: squashed into an ellipse
  const sy = 0.55;
  g.ellipse(x, y, r, r * sy).fill({ color: 0x3f9a96, alpha: 0.18 * a }).stroke({ width: 6, color: 0xc9a24a, alpha: a });
  g.ellipse(x, y, r, r * sy).stroke({ width: 2, color: INK, alpha: 0.6 * a });
  for (let i = 0; i < 12; i++) {
    const ang = (i * Math.PI) / 6;
    const c = Math.cos(ang);
    const s = Math.sin(ang) * sy;
    const inner = i % 3 === 0 ? 0.8 : 0.88;
    g.moveTo(x + c * r * inner, y + s * r * inner).lineTo(x + c * r, y + s * r).stroke({ width: i % 3 === 0 ? 6 : 4, color: 0xc9a24a, alpha: a, cap: 'round' });
  }
  // the hand turns back from twelve o'clock, and a short arc behind it shows which way
  const back = -Math.PI / 2 - p * Math.PI * 1.5;
  const hx = x + Math.cos(back) * r * 0.75;
  const hy = y + Math.sin(back) * r * 0.75 * sy;
  g.moveTo(x, y).lineTo(hx, hy).stroke({ width: 10, color: INK, alpha: a, cap: 'round' });
  g.moveTo(x, y).lineTo(hx, hy).stroke({ width: 5, color: 0xe8d9a8, alpha: a, cap: 'round' });
  const arc: number[] = [];
  for (let j = 0; j <= 10; j++) {
    const ang = back + (j / 10) * 0.9;
    arc.push(x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.6 * sy);
  }
  g.poly(arc, false).stroke({ width: 5, color: 0x3f9a96, alpha: a, cap: 'round' });
  g.circle(x, y, 9).fill({ color: 0xc9a24a, alpha: a }).stroke({ width: 3, color: INK, alpha: a });
}

/** A curl of wind: a spiral stroke, ink under a pale mint line. */
function curl(g: Graphics, x: number, y: number, r: number, angle: number, alpha: number): void {
  const pts: number[] = [];
  for (let j = 0; j <= 14; j++) {
    const t = j / 14;
    const ang = angle + t * Math.PI * 1.6;
    const d = r * (0.25 + 0.75 * t);
    pts.push(x + Math.cos(ang) * d, y + Math.sin(ang) * d);
  }
  g.poly(pts, false).stroke({ width: 9, color: INK, alpha, cap: 'round', join: 'round' });
  g.poly(pts, false).stroke({ width: 4.5, color: WIND[1], alpha, cap: 'round', join: 'round' });
}

/** A small green leaf tumbling in the wind. */
function leaf(g: Graphics, x: number, y: number, r: number, angle: number, alpha: number): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const pts: number[] = [];
  for (let j = 0; j < 12; j++) {
    const t = (j / 12) * Math.PI * 2;
    const lx = Math.cos(t) * r * 1.6;
    const ly = Math.sin(t) * r * 0.7;
    pts.push(x + lx * c - ly * s, y + lx * s + ly * c);
  }
  g.poly(pts).fill({ color: LEAF, alpha }).stroke({ width: 3, color: INK, alpha, join: 'round' });
}

/** A gale gust: wind streaks sweeping across the field from `left` to `right`, `depth` deep
 *  either side of y, with leaves carried along. */
export function gustWave(g: Graphics, left: number, right: number, y: number, depth: number, p: number): void {
  const a = fade(p);
  const span = right - left;
  for (let i = 0; i < 7; i++) {
    const row = y + ((i / 6) * 2 - 1) * depth * 0.8;
    // each streak runs out from the left, staggered, bending a little as the wind would
    const head = left + span * Math.min(1, easeOut(Math.min(1, p * 1.8)) * 1.15 - (i % 3) * 0.08);
    const tail = Math.max(left, head - span * 0.45);
    if (head <= tail) continue;
    const pts: number[] = [];
    for (let j = 0; j <= 10; j++) {
      const x = tail + ((head - tail) * j) / 10;
      pts.push(x, row + Math.sin(x / 90 + i) * 10);
    }
    g.poly(pts, false).stroke({ width: 12, color: INK, alpha: a * 0.8, cap: 'round', join: 'round' });
    g.poly(pts, false).stroke({ width: 6, color: i % 2 ? WIND[0] : WIND[1], alpha: a, cap: 'round', join: 'round' });
    if (i % 2 === 0) leaf(g, head + 12, row - 6, 9, p * 9 + i, a);
  }
}

/** Speed lines under an enemy that has just been knocked back up the field. */
export function pushLines(g: Graphics, x: number, y: number, r: number, p: number): void {
  const a = fade(p);
  for (let i = -1; i <= 1; i++) {
    const lx = x + i * r * 0.55;
    const y0 = y + r * (0.9 + 0.4 * p);
    const y1 = y0 + r * (1.1 - 0.5 * p) * (i === 0 ? 1.2 : 0.8);
    g.moveTo(lx, y0).lineTo(lx, y1).stroke({ width: 10, color: INK, alpha: a, cap: 'round' });
    g.moveTo(lx, y0).lineTo(lx, y1).stroke({ width: 5, color: WIND[1], alpha: a, cap: 'round' });
  }
}

/** A whirlwind on the ground, turning: spiral arms round an eye, squashed like the field. */
export function vortexSwirl(g: Graphics, x: number, y: number, radius: number, time: number, alpha: number): void {
  const sy = 0.55;
  g.ellipse(x, y, radius, radius * sy).fill({ color: WIND[0], alpha: 0.16 * alpha });
  for (let k = 0; k < 3; k++) {
    const pts: number[] = [];
    for (let j = 0; j <= 16; j++) {
      const t = j / 16;
      const ang = time * 5 + (k * 2 * Math.PI) / 3 + t * Math.PI * 1.5;
      const d = radius * (0.15 + 0.85 * t);
      pts.push(x + Math.cos(ang) * d, y + Math.sin(ang) * d * sy);
    }
    g.poly(pts, false).stroke({ width: 10, color: INK, alpha: alpha * 0.8, cap: 'round', join: 'round' });
    g.poly(pts, false).stroke({ width: 5, color: k % 2 ? WIND[0] : WIND[1], alpha, cap: 'round', join: 'round' });
  }
}
