// A merge as the battle plays it: the potion the player drops leaps from the finger and dives into
// the other, the two swirl together, then a flash and a splash as the result pops out.

import type { Graphics } from 'pixi.js';
import { slotCenter, type Battle } from '../../sim/battle';
import type { HeroKind } from '../../sim/types';
import { potionLook, type SpriteLayer } from '../art';
import { INK, type PotionLayer } from '../potion';
import { COLORS } from '../ui';
import { drawCell, STILL, type FigureAnim } from './figures';
import type { FxLayer } from './fxLayer';

/** Seconds a dropped potion takes to leap from the finger and dive head first into the other. */
const FLY = 0.15;
/** Seconds from the drop until the result pops out: after the dive the two swirl together. */
const FUSE = 0.3;

/** A merge the player dropped, still fusing: the potion dropped (the one it lands on is the
 *  same), into which slot, where the finger let go, when, and whether it has landed yet. */
interface Merge {
  slot: number;
  kind: HeroKind;
  star: number;
  from: { x: number; y: number };
  start: number;
  landed: boolean;
}

export class MergeAnims {
  private list: Merge[] = [];

  /** `fx`: where the ripples, flashes and splashes go. */
  constructor(private readonly fx: FxLayer) {}

  clear(): void {
    this.list = [];
  }

  /** Whether a merge the player dropped into `slot` is still fusing. */
  fusing(slot: number): boolean {
    return this.list.some((m) => m.slot === slot);
  }

  /** When the result in `slot` pops out: once its merge has fused, else `now`. */
  bornAt(slot: number, now: number): number {
    const merge = this.list.find((m) => m.slot === slot);
    return merge ? merge.start + FUSE : now;
  }

  /** The player dropped `kind` at level `star` from slot `from` onto slot `to`, the finger at
   *  `at`, at `now` seconds into the battle. */
  drop(from: number, to: number, kind: HeroKind, star: number, at: { x: number; y: number }, now: number): void {
    this.list = this.list.filter((m) => m.slot !== to && m.slot !== from);
    this.list.push({ slot: to, kind, star, from: { ...at }, start: now, landed: false });
  }

  /** A dropped potion leaps up from the finger, tips over and dives head first into the one it
   *  merges with, shrinking into its neck, with drops trailing behind; drawn over the grid. */
  dives(over: Graphics, art: SpriteLayer, potions: PotionLayer, time: number): void {
    for (const m of this.list) {
      const f = (time - m.start) / FLY;
      if (f >= 1) continue;
      const c = slotCenter(m.slot);
      // it speeds up as it dives, on an arc rising above both ends, and ends with its necks over
      // the mouths of the ones below
      const side = m.from.x <= c.x ? 1 : -1;
      const x2 = c.x - side * 34;
      const y2 = c.y - 118;
      const x1 = (m.from.x + x2) / 2;
      const y1 = Math.min(m.from.y, y2) - 170;
      const at = (k: number): [number, number] => {
        const e = k * k;
        return [(1 - e) ** 2 * m.from.x + 2 * (1 - e) * e * x1 + e * e * x2, (1 - e) ** 2 * m.from.y + 2 * (1 - e) * e * y1 + e * e * y2];
      };
      const color = potionLook(m.kind)?.lid ?? COLORS.gold;
      for (let j = 1; j <= 3; j++) {
        const [dx, dy] = at(Math.max(0, f - j * 0.12));
        over.circle(dx, dy + 30, 10 - j * 2).fill(color).stroke({ width: 3, color: INK });
      }
      // head over heels, stretched by the speed, gone as it goes in
      const [x, y] = at(f);
      const tilt = side * 2.3 * Math.min(1, f * 1.5);
      const anim = (): FigureAnim => ({ ...STILL, tilt, squash: -0.18 * Math.sin(f * Math.PI) });
      drawCell(time, over, over, art, potions, m.kind, m.star, x, y, 1.15 - 0.6 * f * f, Math.min(1, (1 - f) * 4), 0, false, anim);
    }
  }

  /** Under the dive, the potion it lands on stretches up to meet it, flattens as it lands, then
   *  wobbles and shrinks as the two liquids swirl round it and it glows white; then the flash, and
   *  the result pops out (its pop is held back until FUSE). */
  swirls(under: Graphics, over: Graphics, art: SpriteLayer, potions: PotionLayer, b: Battle, time: number): void {
    const t = time;
    for (const m of this.list) {
      const k = t - m.start;
      if (k >= FUSE) continue;
      const c = slotCenter(m.slot);
      const look = potionLook(m.kind);
      const color = look?.lid ?? COLORS.gold;
      if (!m.landed && k >= FLY) {
        m.landed = true;
        this.ripple(c.x, c.y - 62, color);
      }
      // 0 until the dive lands, then 0-1 through the swirl
      const e = Math.max(0, (k - FLY) / (FUSE - FLY));
      const squash = k < FLY ? -0.1 * (k / FLY) : 0.32 * Math.cos(e * Math.PI * 3) * (1 - e);
      const spin = 0.2 * Math.sin(e * Math.PI * 4) * (1 - e);
      const anim = (i: number): FigureAnim => ({ ...STILL, squash, spin: i % 2 ? -spin : spin });
      drawCell(time, under, over, art, potions, m.kind, m.star, c.x, c.y - 10, 1 - 0.4 * e * e, 1, m.slot, false, anim);
      if (e <= 0) continue;
      // three ribbons of liquid spiralling in round it, and a white glow swelling over it
      const cy = c.y - 20;
      const r = 96 * (1 - 0.5 * e);
      const ribbons = [color, look?.glow[1] ?? COLORS.gold, 0xfff3c0];
      ribbons.forEach((rc, i) => {
        const a0 = e * Math.PI * 3.4 + (i * Math.PI * 2) / 3;
        const pts: number[] = [];
        for (let j = 0; j <= 8; j++) {
          const a = a0 + (j / 8) * 1.5;
          const rr = r * (1 - 0.25 * (j / 8));
          pts.push(c.x + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7);
        }
        over.poly(pts, false).stroke({ width: 15, color: INK, cap: 'round', join: 'round' });
        over.poly(pts, false).stroke({ width: 8, color: rc, cap: 'round', join: 'round' });
      });
      over.circle(c.x, cy - 10, 40 + 50 * e).fill({ color: 0xffffff, alpha: 0.5 * e * e });
    }
    for (const m of this.list) if (t - m.start >= FUSE) this.fused(b, m.slot);
    this.list = this.list.filter((m) => t - m.start < FUSE);
  }

  /** A merge in `slot` of `b` is done: a white flash with golden rays, and a splash in the new
   *  potion's colour. */
  fused(b: Battle | null, slot: number): void {
    const c = slotCenter(slot);
    const h = b?.slots[slot];
    const color = (h && potionLook(h.kind)?.lid) ?? COLORS.gold;
    const x = c.x;
    const y = c.y - 20;
    const ttl = 0.25;
    this.fx.push({
      ttl,
      max: ttl,
      top: true,
      draw: (g, life) => {
        const s = 1 - life;
        // the disc is gone in a few frames so the new potion is seen popping out; the ring runs on
        g.circle(x, y, 50 + 90 * s).fill({ color: 0xffffff, alpha: 0.9 * life ** 4 });
        g.circle(x, y, 60 + 130 * s).stroke({ width: 14 * life, color: 0xffffff, alpha: life });
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + 0.2;
          const r0 = 70 + 90 * s;
          const r1 = r0 + 40 * life;
          g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0).lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1).stroke({ width: 10 * life + 2, color: COLORS.gold, cap: 'round' });
        }
      },
    });
    this.fx.burst(c.x, c.y, 110, COLORS.gold, 0.35);
    this.splash(c.x, c.y + 10, color);
  }

  /** A ring of liquid spreading where a dive lands, with a few drops kicked up. */
  private ripple(x: number, y: number, color: number): void {
    const ttl = 0.22;
    this.fx.push({
      ttl,
      max: ttl,
      top: true,
      draw: (g, life) => {
        const s = 1 - life;
        g.ellipse(x, y, 26 + 80 * s, 10 + 26 * s).stroke({ width: 4 + 8 * life, color, alpha: life });
        for (let i = 0; i < 4; i++) {
          g.circle(x + (i - 1.5) * 40 * s, y - 160 * s + 300 * s * s, 7 * life + 2).fill(color).stroke({ width: 2, color: INK });
        }
      },
    });
  }

  /** Droplets flying out in arcs and puffs of coloured smoke rising. */
  private splash(x: number, y: number, color: number): void {
    const drops = Array.from({ length: 9 }, (_, i) => ({ a: -Math.PI / 2 + (i - 4) * 0.3 + (Math.random() - 0.5) * 0.2, v: 380 + Math.random() * 260 }));
    const puffs = Array.from({ length: 5 }, (_, i) => ({ dx: (i - 2) * 26 + (Math.random() - 0.5) * 12, r: 22 + Math.random() * 12 }));
    const ttl = 0.6;
    this.fx.push({
      ttl,
      max: ttl,
      top: true,
      draw: (g, life) => {
        const s = (1 - life) * ttl;
        for (const p of puffs) g.circle(x + p.dx, y - 20 - s * 140, p.r * (1 + s * 2)).fill({ color, alpha: life * 0.35 });
        for (const d of drops) {
          // from a rim round the new potion, so they do not hide its face as it pops out
          const dx = x + Math.cos(d.a) * (45 + d.v * s);
          const dy = y + Math.sin(d.a) * (45 + d.v * s) + 900 * s * s;
          g.circle(dx, dy, 6 * life + 2).fill(color).stroke({ width: 2, color: 0x0e0c12 });
        }
      },
    });
  }
}
