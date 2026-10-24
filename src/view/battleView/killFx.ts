// The kills' share of the battle's bustle: each death's gold pops out as a coin that flies up to the
// HUD's counter, and kills close together count up a streak (a gear and "×N", no words to
// translate) over the field, popping bigger at each milestone.

import { Container, Graphics, type Text } from 'pixi.js';
import { INK } from '../potion';
import { COLORS, label } from '../ui';
import { DESIGN_W } from '../viewport';

/** Where the coins fly to: the centre of the HUD's coin (Hud.ts), which shares the view's space. */
export const COIN_TARGET = { x: 90, y: 60 };
/** Seconds a coin hops out of the wreck, then flies to the counter. */
const HOP = 0.28;
const FLY = 0.5;
/** Coins in the air at most; past it a kill's gold goes straight on the counter. */
const MAX_COINS = 48;
/** Seconds between kills that still keep a streak going, and the kills it takes to show. */
export const STREAK_GAP = 1;
export const STREAK_SHOWN = 5;
/** Streaks that pop bigger and shake the board a little. */
export const MILESTONES = [10, 25, 50, 100, 200];
/** Seconds the counter stays after the last kill of a streak. */
const STREAK_LINGER = 1.1;
/** Where the streak counter's gear stands: on the grass right of the road halfway down, clear of
 *  the hint banner (Hud.ts) and of where the road bends in at the top; "×200" still fits. */
const STREAK_POS = { x: DESIGN_W - 290, y: 700 };

interface Coin {
  x: number;
  y: number;
  /** Where its hop lands before it flies, and seconds since the kill. */
  hx: number;
  hy: number;
  t: number;
}

const easeOut = (p: number): number => 1 - (1 - p) * (1 - p);

/** A coin `r` across, its face tipped by `turn` (0..1 of a spin) so it seems to tumble. */
function coin(g: Graphics, x: number, y: number, r: number, turn: number, alpha: number): void {
  const w = r * Math.max(0.25, Math.abs(Math.cos(turn * Math.PI * 2)));
  g.ellipse(x, y, w, r).fill({ color: COLORS.gold, alpha }).stroke({ width: 4, color: INK, alpha });
  g.ellipse(x - w * 0.25, y - r * 0.3, w * 0.3, r * 0.22).fill({ color: 0xfff3b0, alpha });
}

/** A small gear, the streak counter's icon. */
function gearIcon(g: Graphics, x: number, y: number, r: number, angle: number): void {
  const pts: number[] = [];
  for (let i = 0; i < 32; i++) {
    const a = angle + (i * Math.PI * 2) / 32;
    const d = i % 4 < 2 ? r : r * 0.74;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill(0x9aa6b8).stroke({ width: 5, color: INK, join: 'bevel' });
  g.circle(x, y, r * 0.3).fill(0x3a4250).stroke({ width: 3, color: INK });
}

export class KillFx extends Container {
  private readonly coins: Coin[] = [];
  private readonly g = new Graphics();
  private readonly icon = new Graphics();
  private readonly count: Text;
  private streak = 0;
  /** Seconds since the last kill, and since the counter last popped. */
  private sinceKill = 99;
  private sincePop = 99;
  private pop = 1;
  private time = 0;
  /** A coin reached the counter (the HUD bumps its coin). */
  landed: () => void = () => {};

  constructor() {
    super();
    this.count = label('', 72, { fill: COLORS.gold, stroke: { color: INK, width: 10 } });
    this.count.anchor.set(0, 0.5);
    this.addChild(this.g, this.icon, this.count);
    this.clear();
  }

  clear(): void {
    this.coins.length = 0;
    this.streak = 0;
    this.sinceKill = 99;
    this.g.clear();
    this.icon.visible = this.count.visible = false;
  }

  /** An enemy died at (x, y) worth `gold`; returns the streak's milestone it reached, else 0. */
  kill(x: number, y: number, gold: number): number {
    if (gold > 0 && this.coins.length < MAX_COINS) {
      // a hop up and to one side, the wreck's x decides which, so it needs no dice
      const side = (Math.floor(x * 7 + y * 3) % 2 ? 1 : -1) * (30 + ((x * 13) % 40));
      this.coins.push({ x, y, hx: x + side, hy: y - 70 - ((y * 11) % 40), t: 0 });
    }
    this.streak = this.sinceKill <= STREAK_GAP ? this.streak + 1 : 1;
    this.sinceKill = 0;
    if (this.streak < STREAK_SHOWN) return 0;
    const milestone = MILESTONES.includes(this.streak) ? this.streak : 0;
    this.pop = milestone ? 1.8 : 1.25;
    this.sincePop = 0;
    this.count.text = `×${this.streak}`;
    return milestone;
  }

  update(dt: number): void {
    this.time += dt;
    this.sinceKill += dt;
    this.sincePop += dt;
    const g = this.g.clear();
    let n = 0;
    for (const c of this.coins) {
      c.t += dt;
      if (c.t >= HOP + FLY) {
        this.landed();
        continue;
      }
      this.coins[n++] = c;
      if (c.t < HOP) {
        const p = c.t / HOP;
        // up out of the wreck and over in an arc
        coin(g, c.x + (c.hx - c.x) * p, c.y + (c.hy - c.y) * easeOut(p) - 40 * Math.sin(p * Math.PI), 22, c.t * 3, 1);
      } else {
        const p = (c.t - HOP) / FLY;
        const k = p * p;
        coin(g, c.hx + (COIN_TARGET.x - c.hx) * k, c.hy + (COIN_TARGET.y - c.hy) * k, 22 - 6 * p, c.t * 3, 1);
      }
    }
    this.coins.length = n;
    const shown = this.streak >= STREAK_SHOWN && this.sinceKill < STREAK_GAP + STREAK_LINGER;
    this.icon.visible = this.count.visible = shown;
    if (!shown) return;
    // the pop settles back over a quarter second; it fades once the streak is broken
    const s = 1 + (this.pop - 1) * Math.max(0, 1 - this.sincePop / 0.25);
    const alpha = this.sinceKill <= STREAK_GAP ? 1 : 1 - (this.sinceKill - STREAK_GAP) / STREAK_LINGER;
    this.count.scale.set(s);
    this.count.alpha = this.icon.alpha = alpha;
    this.icon.clear();
    gearIcon(this.icon, STREAK_POS.x, STREAK_POS.y, 30 * s, this.time * 2);
    this.count.position.set(STREAK_POS.x + 36 * s, STREAK_POS.y);
  }
}
