// A living potion. The bottle and its face are art; everything that moves is drawn here (feet,
// arms, the flame from its neck, blinking), so one picture gives idle, throw and merge motion.

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';

export const INK = 0x0e0c12;
/** The ⚡ outline in a unit box centred on 0, top to tip. */
const BOLT: [number, number][] = [[0.16, -0.5], [-0.34, 0.1], [-0.02, 0.1], [-0.2, 0.5], [0.36, -0.12], [0.06, -0.12], [0.4, -0.5]];

/** How one kind of potion looks. Positions are fractions of the body art (0,0 top left). */
export interface PotionLook {
  body: Texture;
  eyes: [number, number][];
  /** Eye half-size as fractions of the art's width and height. */
  eyeSize: [number, number];
  /** Eyelids: the colour of the liquid around the eyes. */
  lid: number;
  limb: number;
  /** What rises from its neck: the element mark. */
  mark: 'flame' | 'frost' | 'spark' | 'star' | 'acid' | 'wind';
  /** Outer, middle and core colour of the mark (and of its thrown vials). */
  glow: [number, number, number];
  neck: [number, number];
  /** Height relative to the other potions, so a wide bottle does not crowd its cell. */
  size?: number;
}

/** Where and how a potion is drawn this frame. */
export interface PotionPose {
  x: number;
  feet: number;
  height: number;
  alpha: number;
  dim: boolean;
  phase: number;
  time: number;
  /** 0-1: how far the throwing arm is drawn back before the next throw. */
  wind: number;
  /** Seconds since its last throw. */
  since: number;
  /** Seconds since it appeared; it pops in over the first 0.4 s. */
  pop: number;
  /** Fixed tilt in radians instead of the idle sway (pouring into another potion). */
  tilt?: number;
}

/** Scale of something appearing `pop` seconds ago: grows from nothing, overshoots, settles. */
export function popScale(pop: number): number {
  if (pop >= 0.4) return 1;
  if (pop <= 0) return 0;
  const p = pop / 0.4;
  return 1 - (1 - p) ** 4 * Math.cos(p * Math.PI * 2.5);
}

/** How hard it is still recoiling from its last throw, 1 at release down to 0. */
export function recoil(since: number): number {
  return since < 0.4 ? (1 - since / 0.4) ** 2 : 0;
}

/** Where the throwing hand is at the moment of release, relative to the feet, for a potion
 *  `height` tall: thrown vials start from here. */
export function throwingHand(look: PotionLook, height: number): { x: number; y: number } {
  height *= look.size ?? 1;
  const bw = (height * look.body.width) / look.body.height;
  return { x: 0.37 * bw - 0.02 * height, y: -height * (0.1 + 0.38 + 0.36 + 0.14) };
}

/**
 * An idle figure redraws its feet, arms and mark every other frame, half of the figures on each:
 * its breathing, sway and hop ride on the transform, which moves every frame, and re-tessellating
 * every figure's strokes each frame was most of a full field's frame. One winding up, recoiling,
 * pouring, blinking or with a new look or size redraws at once.
 */
class PotionFigure extends Container {
  private readonly back = new Graphics();
  private readonly body = new Sprite();
  private readonly front = new Graphics();
  /** Whether this frame is one it may skip redrawing. */
  private beat: boolean;
  private drawnLook: PotionLook | null = null;
  private drawnHeight = 0;
  private drawnDim = false;
  private drawnBlink = false;

  constructor(odd = false) {
    super();
    this.beat = odd;
    this.body.anchor.set(0.5, 1);
    this.addChild(this.back, this.body, this.front);
  }

  draw(look: PotionLook, pose: PotionPose): void {
    const t = pose.time + pose.phase * 0.77;
    const bh = pose.height * (look.size ?? 1);
    const bw = (bh * look.body.width) / look.body.height;
    const lift = bh * 0.1;
    const at = (fx: number, fy: number): [number, number] => [(fx - 0.5) * bw, -lift - (1 - fy) * bh];
    const w = pose.wind;
    const r = recoil(pose.since);

    // idle breathing and sway; drawing back squashes and leans away, the release stretches up
    const breath = Math.sin(t * 3.2);
    const grow = popScale(pose.pop);
    const jiggle = pose.pop < 0.4 ? 1 + 0.1 * (1 - pose.pop / 0.4) * Math.sin(pose.pop * 40) : 1;
    // a little hop as it throws
    this.position.set(pose.x, pose.feet - r * bh * 0.14);
    this.scale.set(grow * jiggle * (1 - breath * 0.025 + w * 0.16 - r * 0.08), (grow / jiggle) * (1 + breath * 0.03 - w * 0.2 + r * 0.16));
    this.rotation = pose.tilt ?? Math.sin(t * 1.7) * 0.04 - w * 0.22 + r * 0.1;
    this.alpha = pose.alpha;
    this.tint = pose.dim ? 0x5a5a5a : 0xffffff;

    this.body.texture = look.body;
    this.body.position.set(0, -lift);
    this.body.scale.set(bh / look.body.height);

    const blink = !pose.dim && (t * 0.31 + pose.phase * 0.17) % 1 < 0.035;
    this.beat = !this.beat;
    const same = look === this.drawnLook && bh === this.drawnHeight && pose.dim === this.drawnDim && blink === this.drawnBlink;
    if (same && this.beat && w === 0 && r === 0 && pose.tilt === undefined) return;
    this.drawnLook = look;
    this.drawnHeight = bh;
    this.drawnDim = pose.dim;
    this.drawnBlink = blink;

    const line = Math.max(2, bh * 0.028);
    const b = this.back.clear();
    // two stubby feet, paddling in turn
    for (const side of [-1, 1]) {
      const up = Math.max(0, Math.sin(t * 3.2 + (side > 0 ? Math.PI : 0))) * bh * 0.025;
      b.ellipse(side * bw * 0.22, -bh * 0.05 - up, bw * 0.14, bh * 0.06).fill(look.limb).stroke({ width: line, color: INK });
    }

    const f = this.front.clear();
    // blink every few seconds, out of step with the others
    if (blink) {
      for (const [ex, ey] of look.eyes) {
        const [cx, cy] = at(ex, ey);
        const rx = look.eyeSize[0] * bw * 1.15;
        const ry = look.eyeSize[1] * bh * 1.15;
        f.ellipse(cx, cy, rx, ry).fill(look.lid);
        f.moveTo(cx - rx * 0.8, cy).quadraticCurveTo(cx, cy + ry * 0.55, cx + rx * 0.8, cy).stroke({ width: line, color: INK, cap: 'round' });
      }
    }

    // the mark out of the neck flares up with a throw; it goes out while pouring
    const [nx, ny] = at(look.neck[0], look.neck[1]);
    if (pose.tilt === undefined) {
      if (look.mark === 'flame') this.drawFlame(f, look, pose, t, nx, ny, bw, bh, w, r, line);
      else if (look.mark === 'frost') this.drawFrost(f, look, pose, t, nx, ny, bw, bh, w, r, line);
      else if (look.mark === 'acid') this.drawAcid(f, look, pose, t, nx, ny, bw, bh, w, r, line);
      else if (look.mark === 'spark') this.drawSpark(f, look, pose, t, nx, ny, bw, bh, w, r, line);
      else if (look.mark === 'wind') this.drawWind(f, look, pose, t, nx, ny, bw, bh, w, r, line);
      else this.drawStars(f, look, pose, t, nx, ny, bw, bh, w, r, line);
    }
    this.drawArms(f, look, t, at, bh, w, r, line);
  }

  private drawFlame(f: Graphics, look: PotionLook, pose: PotionPose, t: number, nx: number, ny: number, bw: number, bh: number, w: number, r: number, line: number): void {
    const fh = bh * 0.34 * (1 + 0.1 * Math.sin(t * 13) + 0.06 * Math.sin(t * 23 + 1)) * (1 + 0.5 * r + 0.2 * w);
    const fw = bw * 0.26 * (1 + 0.05 * Math.sin(t * 17));
    const tip = Math.sin(t * 4.1) * bh * 0.05 - this.rotation * bh * 0.4;
    flame(f, nx, ny + bh * 0.03, fw, fh, tip, look.glow[0], line);
    flame(f, nx, ny + bh * 0.03, fw * 0.68, fh * 0.7, tip * 0.7, look.glow[1]);
    flame(f, nx, ny + bh * 0.03, fw * 0.4, fh * 0.42, tip * 0.4, look.glow[2]);
    // embers drifting up from it
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.9 + i / 3 + pose.phase * 0.37) % 1;
      const ex = nx + Math.sin(i * 7.3 + pose.phase) * bw * 0.12 + Math.sin(t * 5 + i) * bh * 0.03;
      f.circle(ex, ny - bh * 0.15 - p * bh * 0.45, bh * 0.028 * (1 - p)).fill({ color: look.glow[2], alpha: 1 - p });
    }
  }

  /** A cartoon lightning bolt hovering over the neck, redrawn a few times a second, with little
   *  arcs jumping off it. */
  private drawSpark(f: Graphics, look: PotionLook, pose: PotionPose, t: number, nx: number, ny: number, bw: number, bh: number, w: number, r: number, line: number): void {
    const tick = Math.floor(t * 9 + pose.phase * 3);
    const rand = (k: number): number => {
      const v = Math.sin(tick * 12.9898 + k * 78.233 + pose.phase * 37.7) * 43758.5453;
      return v - Math.floor(v);
    };
    // a chunky cartoon bolt hovering over the neck, jittering every redraw
    const size = bh * 0.4 * (1 + 0.45 * r + 0.2 * w) * (0.94 + rand(0) * 0.12);
    const cx = nx + (rand(1) - 0.5) * bw * 0.05;
    const cy = ny - bh * 0.3 - r * bh * 0.08;
    const lean = -0.12 + (rand(2) - 0.5) * 0.18;
    const cos = Math.cos(lean), sin = Math.sin(lean);
    const bolt = (k: number): number[] =>
      BOLT.flatMap(([x, y]) => [cx + (x * cos - y * sin) * size * k, cy + (x * sin + y * cos) * size * k]);
    f.poly(bolt(1)).fill(look.glow[1]).stroke({ width: line * 1.2, color: INK, join: 'round' });
    f.poly(bolt(0.45)).fill(look.glow[2]);
    // two short arcs flickering on and off around it
    for (let i = 0; i < 2; i++) {
      if (rand(i + 1) < 0.45) continue;
      const side = i === 0 ? -1 : 1;
      const sx = cx + side * size * (0.38 + rand(i + 3) * 0.12);
      const sy = cy + (rand(i + 5) - 0.5) * size * 0.6;
      const step = size * 0.12;
      f.moveTo(sx, sy).lineTo(sx + side * step, sy - step).lineTo(sx + side * step, sy + step * 0.3).lineTo(sx + side * step * 2, sy - step * 0.7).stroke({ width: line * 1.6, color: look.glow[0], cap: 'round', join: 'round' });
    }
  }

  /** Acid bubbling up out of the neck and popping, with a drip running down the shoulder. */
  private drawAcid(f: Graphics, look: PotionLook, pose: PotionPose, t: number, nx: number, ny: number, bw: number, bh: number, w: number, r: number, line: number): void {
    // a fat drip creeping down from the rim, then falling off and starting over
    const d = (t * 0.35 + pose.phase * 0.41) % 1;
    const dx = nx + bw * 0.24;
    const dy = ny + bh * 0.04 + d * bh * 0.16;
    const dr = bh * 0.03 * (0.6 + d * 0.6);
    f.moveTo(dx - dr, dy).quadraticCurveTo(dx, dy - dr * 3, dx + dr, dy).arc(dx, dy, dr, 0, Math.PI).closePath().fill(look.glow[1]).stroke({ width: line * 0.7, color: INK });
    // bubbles rising out of the neck, wobbling, swelling, popping; faster on a throw
    const speed = 0.7 + 0.8 * w + 0.6 * r;
    for (let i = 0; i < 3; i++) {
      const p = (t * speed * 0.5 + i / 3 + pose.phase * 0.23) % 1;
      const bx = nx + Math.sin(p * 6 + i * 2.4 + pose.phase) * bw * 0.1 + (i - 1) * bw * 0.08;
      const by = ny - bh * 0.04 - p * bh * 0.34;
      const size = bh * (0.035 + 0.045 * p) * (i === 1 ? 1.25 : 1);
      if (p < 0.88) {
        f.circle(bx, by, size).fill(look.glow[1]).stroke({ width: line * 0.8, color: INK });
        f.circle(bx - size * 0.35, by - size * 0.35, size * 0.3).fill(look.glow[2]);
      } else {
        // pop: a ring of four specks
        const k = (p - 0.88) / 0.12;
        for (let s = 0; s < 4; s++) {
          const a = s * (Math.PI / 2) + 0.6;
          f.circle(bx + Math.cos(a) * size * (1 + k), by + Math.sin(a) * size * (1 + k), size * 0.25 * (1 - k)).fill(look.glow[0]);
        }
      }
    }
  }

  /** A little whirlwind spinning up out of the neck, wider at the top, with a leaf caught in it
   *  going round; it spins faster and flares on a throw. */
  private drawWind(f: Graphics, look: PotionLook, pose: PotionPose, t: number, nx: number, ny: number, bw: number, bh: number, w: number, r: number, line: number): void {
    const spin = t * (3 + 4 * w + 3 * r) + pose.phase;
    const lean = Math.sin(t * 1.9) * bw * 0.04 - this.rotation * bh * 0.3;
    const flare = 1 + 0.35 * r + 0.15 * w;
    // three rings, small at the neck and wide at the top, each a broken stroke so it reads as turning
    for (let i = 0; i < 3; i++) {
      const k = i / 2;
      const cx = nx + lean * k;
      const cy = ny - bh * (0.06 + 0.11 * i) * flare;
      const rx = bw * (0.1 + 0.09 * i) * flare;
      const ry = bh * (0.025 + 0.012 * i);
      const a0 = spin * (1 + 0.2 * i) + i * 1.7;
      const pts: number[] = [];
      for (let j = 0; j <= 16; j++) {
        const a = a0 + (j / 16) * Math.PI * 1.35;
        pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      }
      f.poly(pts, false).stroke({ width: line * 2.4, color: INK, cap: 'round', join: 'round' });
      f.poly(pts, false).stroke({ width: line * 1.1, color: i === 1 ? look.glow[2] : look.glow[1], cap: 'round', join: 'round' });
    }
    // the leaf riding round the top ring
    const a = spin * 1.2;
    const depth = Math.sin(a);
    const lx = nx + lean + Math.cos(a) * bw * 0.26 * flare;
    const ly = ny - bh * 0.25 * flare + depth * bh * 0.03;
    const size = bh * 0.04 * (0.8 + 0.25 * depth);
    const c = Math.cos(a * 1.5);
    const sn = Math.sin(a * 1.5);
    const pts: number[] = [];
    for (let j = 0; j < 12; j++) {
      const u = (j / 12) * Math.PI * 2;
      const px = Math.cos(u) * size * 1.6;
      const py = Math.sin(u) * size * 0.7;
      pts.push(lx + px * c - py * sn, ly + px * sn + py * c);
    }
    f.poly(pts).fill(0x7fcf4a).stroke({ width: line * 0.7, color: INK, join: 'round' });
  }

  /** Three little stars circling over the neck, twinkling; they spin faster on a throw. */
  private drawStars(f: Graphics, look: PotionLook, pose: PotionPose, t: number, nx: number, ny: number, bw: number, bh: number, w: number, r: number, line: number): void {
    const cy = ny - bh * 0.2 - r * bh * 0.06;
    const spin = t * (1.6 + 2.5 * w) + pose.phase;
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI * 2) / 3;
      // a flat orbit: stars at the front are bigger than the ones going round the back
      const depth = 0.75 + 0.25 * Math.sin(a);
      const twinkle = 1 + 0.15 * Math.sin(t * 7 + i * 2.1);
      const size = bh * 0.13 * depth * twinkle * (1 + 0.4 * r + 0.2 * w);
      star(f, nx + Math.cos(a) * bw * 0.3, cy + Math.sin(a) * bh * 0.06, size, Math.sin(t * 2 + i) * 0.3, look.glow, line);
    }
  }

  /** Cold mist curling out of the neck, and an ice crystal turning above it. */
  private drawFrost(f: Graphics, look: PotionLook, pose: PotionPose, t: number, nx: number, ny: number, bw: number, bh: number, w: number, r: number, line: number): void {
    for (let i = 0; i < 4; i++) {
      const p = (t * 0.55 + i / 4 + pose.phase * 0.29) % 1;
      const mx = nx + Math.sin(p * 5 + i * 2.1 + pose.phase) * bw * 0.1 * (0.3 + p);
      f.circle(mx, ny - p * bh * 0.32, bh * (0.035 + 0.05 * p)).fill({ color: i % 2 ? look.glow[1] : look.glow[2], alpha: 0.75 * (1 - p) });
    }
    const size = bh * 0.1 * (1 + 0.5 * r + 0.25 * w);
    snowflake(f, nx, ny - bh * 0.24 - Math.sin(t * 2.3) * bh * 0.025 - r * bh * 0.08, size, t * 1.3 + pose.phase, look.glow, line);
  }

  private drawArms(f: Graphics, look: PotionLook, t: number, at: (fx: number, fy: number) => [number, number], bh: number, w: number, r: number, line: number): void {
    // arms: the right one draws back over the head and flings up; the left one balances
    const [lx, ly] = at(0.13, 0.62);
    const [rx, ry] = at(0.87, 0.62);
    const swing = Math.sin(t * 3.2) * bh * 0.02;
    const left = lerp2([lx - bh * 0.13, ly + bh * 0.12 + swing], [lx - bh * 0.2, ly - bh * 0.04], w);
    const idleRight: [number, number] = [rx + bh * 0.13, ry + bh * 0.12 - swing];
    const right = lerp2(lerp2(idleRight, [rx + bh * 0.16, ry - bh * 0.3], w), [rx - bh * 0.02, ry - bh * 0.36], r);
    arm(f, lx, ly, left[0], left[1], bh, look.limb, line);
    arm(f, rx, ry, right[0], right[1], bh, look.limb, line);
    // the vial it is about to throw
    if (w > 0.25) {
      const vx = right[0];
      const vy = right[1] - bh * 0.08;
      f.roundRect(vx - bh * 0.06, vy - bh * 0.08, bh * 0.12, bh * 0.14, bh * 0.05).fill(look.glow[1]).stroke({ width: line * 0.8, color: INK });
      f.circle(vx, vy - bh * 0.12, bh * 0.04 * w).fill(look.glow[2]);
    }
  }
}

function lerp2(a: [number, number], b: [number, number], k: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

function arm(g: Graphics, sx: number, sy: number, hx: number, hy: number, bh: number, color: number, line: number): void {
  const width = bh * 0.06;
  g.moveTo(sx, sy).lineTo(hx, hy).stroke({ width: width + line * 2, color: INK, cap: 'round' });
  g.moveTo(sx, sy).lineTo(hx, hy).stroke({ width, color, cap: 'round' });
  g.circle(hx, hy, bh * 0.055).fill(color).stroke({ width: line, color: INK });
}

/** A teardrop flame standing on (x, base), its tip `tip` to the side. */
function flame(g: Graphics, x: number, base: number, w: number, h: number, tip: number, color: number, outline = 0): void {
  const top = base - h;
  g.moveTo(x - w / 2, base)
    .bezierCurveTo(x - w / 2, base - h * 0.45, x + tip * 0.3 - w * 0.25, base - h * 0.7, x + tip, top)
    .bezierCurveTo(x + tip * 0.3 + w * 0.25, base - h * 0.7, x + w / 2, base - h * 0.45, x + w / 2, base)
    .bezierCurveTo(x + w / 2, base + w * 0.55, x - w / 2, base + w * 0.55, x - w / 2, base)
    .closePath()
    .fill(color);
  if (outline) g.stroke({ width: outline, color: INK });
}

/** A chubby five-pointed star centred on (x, y), `size` to its tips, with a pale core. */
export function star(g: Graphics, x: number, y: number, size: number, angle: number, glow: [number, number, number], line: number): void {
  const pts = (k: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = angle - Math.PI / 2 + (i * Math.PI) / 5;
      const d = (i % 2 ? size * 0.5 : size) * k;
      out.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    return out;
  };
  g.poly(pts(1)).fill(glow[1]).stroke({ width: line, color: INK, join: 'round' });
  g.poly(pts(0.45)).fill(glow[2]);
}

/** A six-armed ice crystal centred on (x, y), arms `size` long, turned by `angle`. */
export function snowflake(g: Graphics, x: number, y: number, size: number, angle: number, glow: [number, number, number], line: number): void {
  const draw = (width: number, color: number): void => {
    for (let k = 0; k < 6; k++) {
      const a = angle + (k * Math.PI) / 3;
      const cx = Math.cos(a);
      const sy = Math.sin(a);
      g.moveTo(x, y).lineTo(x + cx * size, y + sy * size);
      // a little V on each arm
      const bx = x + cx * size * 0.55;
      const by = y + sy * size * 0.55;
      for (const s of [-1, 1]) {
        const b = a + s * 0.8;
        g.moveTo(bx, by).lineTo(bx + Math.cos(b) * size * 0.32, by + Math.sin(b) * size * 0.32);
      }
    }
    g.stroke({ width, color, cap: 'round', join: 'round' });
  };
  draw(size * 0.22 + line * 2, INK);
  draw(size * 0.22, glow[1]);
  g.circle(x, y, size * 0.2).fill(glow[2]).stroke({ width: line * 0.8, color: INK });
}

/** One potion drawn once in a pose, for a page that does not animate it. */
export function stillPotion(look: PotionLook, pose: PotionPose): Container {
  const p = new PotionFigure();
  p.draw(look, pose);
  return p;
}

/** Potions reused frame to frame: begin(), put() each one, end(). */
export class PotionLayer extends Container {
  private used = 0;

  begin(): void {
    this.used = 0;
  }

  put(look: PotionLook, pose: PotionPose): void {
    let p = this.children[this.used] as PotionFigure | undefined;
    if (!p) {
      p = new PotionFigure(this.children.length % 2 === 1);
      this.addChild(p);
    }
    this.used++;
    p.visible = true;
    p.draw(look, pose);
  }

  end(): void {
    for (let i = this.used; i < this.children.length; i++) this.children[i].visible = false;
  }
}
