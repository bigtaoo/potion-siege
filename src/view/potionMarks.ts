// The strokes of a living potion: its feet, its arms, its blink and the element mark out of its
// neck. Every idle motion repeats over LOOP seconds (each rate a whole number of turns in it), so
// the mark, and an idle potion's feet and arms, can be drawn once per frame of the loop and kept
// (potionFrames.ts).

import type { Graphics } from 'pixi.js';
import type { PotionLook } from './potion';

export const INK = 0x0e0c12;
/** The idle loop in seconds: one breath, one paddle of the feet, one swing of the arms. */
export const LOOP = (2 * Math.PI) / 3.2;
/** Its rate in radians a second; the idle motions run at whole multiples of it. */
const W = 3.2;
/** The ⚡ outline in a unit box centred on 0, top to tip. */
const BOLT: [number, number][] = [[0.16, -0.5], [-0.34, 0.1], [-0.02, 0.1], [-0.2, 0.5], [0.36, -0.12], [0.06, -0.12], [0.4, -0.5]];

/** What the strokes are drawn from: `t` the figure's time, `bh` its body height, `w` how far
 *  it is wound up, `r` how hard it recoils. */
export interface Strokes {
  t: number;
  bh: number;
  w: number;
  r: number;
  blink: boolean;
}

/** Where `t` is in the loop, 0 to 1. */
function inLoop(t: number, turns = 1): number {
  const k = (t / LOOP) * turns;
  return k - Math.floor(k);
}

/** Where a point of the art (in fractions of it, 0,0 top left) is on a potion `bh` tall, from
 *  its feet. */
function artAt(look: PotionLook, bh: number, fx: number, fy: number): [number, number] {
  const bw = (bh * look.body.width) / look.body.height;
  return [(fx - 0.5) * bw, -bh * 0.1 - (1 - fy) * bh];
}

/** Where its mark stands: the middle of its neck, from its feet. */
export function neckAt(look: PotionLook, bh: number): [number, number] {
  return artAt(look, bh, look.neck[0], look.neck[1]);
}

function lineFor(bh: number): number {
  return Math.max(2, bh * 0.028);
}

/** Two stubby feet, paddling in turn: they go on paddling through a throw. */
export function drawFeet(g: Graphics, look: PotionLook, t: number, bh: number): void {
  const bw = (bh * look.body.width) / look.body.height;
  const b = g.clear();
  for (const side of [-1, 1]) {
    const up = Math.max(0, Math.sin(t * W + (side > 0 ? Math.PI : 0))) * bh * 0.025;
    b.ellipse(side * bw * 0.22, -bh * 0.05 - up, bw * 0.14, bh * 0.06).fill(look.limb).stroke({ width: lineFor(bh), color: INK });
  }
}

/** The lids, while blinking, and the arms. */
export function drawFront(g: Graphics, look: PotionLook, s: Strokes): void {
  const { t, bh, w, r } = s;
  const bw = (bh * look.body.width) / look.body.height;
  const at = (fx: number, fy: number): [number, number] => artAt(look, bh, fx, fy);
  const line = lineFor(bh);
  const f = g.clear();
  if (s.blink) {
    for (const [ex, ey] of look.eyes) {
      const [cx, cy] = at(ex, ey);
      const rx = look.eyeSize[0] * bw * 1.15;
      const ry = look.eyeSize[1] * bh * 1.15;
      f.ellipse(cx, cy, rx, ry).fill(look.lid);
      f.moveTo(cx - rx * 0.8, cy).quadraticCurveTo(cx, cy + ry * 0.55, cx + rx * 0.8, cy).stroke({ width: line, color: INK, cap: 'round' });
    }
  }
  drawArms(f, look, t, at, bh, w, r, line);
}

/** The element mark out of the neck of a potion `bh` tall, at rest, around (0, 0): the neck. A
 *  throw only scales it up around there (PotionFigure). */
export function drawMark(g: Graphics, look: PotionLook, t: number, bh: number): void {
  const m: Mark = { f: g.clear(), look, t, bw: (bh * look.body.width) / look.body.height, bh, line: lineFor(bh) };
  if (look.mark === 'flame') drawFlame(m);
  else if (look.mark === 'frost') drawFrost(m);
  else if (look.mark === 'acid') drawAcid(m);
  else if (look.mark === 'spark') drawSpark(m);
  else if (look.mark === 'wind') drawWind(m);
  else if (look.mark === 'ray') drawRay(m);
  else if (look.mark === 'drop') drawDrop(m);
  else if (look.mark === 'sprout') drawSprout(m);
  else drawStars(m);
}

interface Mark {
  f: Graphics;
  look: PotionLook;
  t: number;
  bw: number;
  bh: number;
  line: number;
}

function drawFlame({ f, look, t, bw, bh, line }: Mark): void {
  const fh = bh * 0.34 * (1 + 0.1 * Math.sin(t * W * 4) + 0.06 * Math.sin(t * W * 7 + 1));
  const fw = bw * 0.26 * (1 + 0.05 * Math.sin(t * W * 5));
  const tip = Math.sin(t * W) * bh * 0.05;
  flame(f, 0, bh * 0.03, fw, fh, tip, look.glow[0], line);
  flame(f, 0, bh * 0.03, fw * 0.68, fh * 0.7, tip * 0.7, look.glow[1]);
  flame(f, 0, bh * 0.03, fw * 0.4, fh * 0.42, tip * 0.4, look.glow[2]);
  // embers drifting up from it, two a loop each
  for (let i = 0; i < 3; i++) {
    const p = inLoop(t + (i / 3) * (LOOP / 2), 2);
    const ex = Math.sin(i * 7.3) * bw * 0.12 + Math.sin(t * W * 2 + i) * bh * 0.03;
    f.circle(ex, -bh * 0.15 - p * bh * 0.45, bh * 0.028 * (1 - p)).fill({ color: look.glow[2], alpha: 1 - p });
  }
}

/** A cartoon lightning bolt hovering over the neck, redrawn 18 times a loop, with little arcs
 *  jumping off it. */
function drawSpark({ f, look, t, bw, bh, line }: Mark): void {
  const tick = Math.floor(inLoop(t) * 18);
  const rand = (k: number): number => {
    const v = Math.sin(tick * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  // a chunky cartoon bolt hovering over the neck, jittering every redraw
  const size = bh * 0.4 * (0.94 + rand(0) * 0.12);
  const cx = (rand(1) - 0.5) * bw * 0.05;
  const cy = -bh * 0.3;
  const tilt = -0.12 + (rand(2) - 0.5) * 0.18;
  const cos = Math.cos(tilt), sin = Math.sin(tilt);
  const bolt = (k: number): number[] => BOLT.flatMap(([x, y]) => [cx + (x * cos - y * sin) * size * k, cy + (x * sin + y * cos) * size * k]);
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
function drawAcid({ f, look, t, bw, bh, line }: Mark): void {
  // a fat drip creeping down from the rim, then falling off and starting over
  const d = inLoop(t);
  const dx = bw * 0.24;
  const dy = bh * 0.04 + d * bh * 0.16;
  const dr = bh * 0.03 * (0.6 + d * 0.6);
  f.moveTo(dx - dr, dy).quadraticCurveTo(dx, dy - dr * 3, dx + dr, dy).arc(dx, dy, dr, 0, Math.PI).closePath().fill(look.glow[1]).stroke({ width: line * 0.7, color: INK });
  // bubbles rising out of the neck, wobbling, swelling, popping
  for (let i = 0; i < 3; i++) {
    const p = (inLoop(t) + i / 3) % 1;
    const bx = Math.sin(p * 6 + i * 2.4) * bw * 0.1 + (i - 1) * bw * 0.08;
    const by = -bh * 0.04 - p * bh * 0.34;
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
 *  going round. */
function drawWind({ f, look, t, bw, bh, line }: Mark): void {
  const spin = t * W;
  const lean = Math.sin(t * W) * bw * 0.04;
  // three rings, small at the neck and wide at the top, each a broken stroke so it reads as turning
  for (let i = 0; i < 3; i++) {
    const cx = (lean * i) / 2;
    const cy = -bh * (0.06 + 0.11 * i);
    const rx = bw * (0.1 + 0.09 * i);
    const ry = bh * (0.025 + 0.012 * i);
    const a0 = spin + i * 1.7;
    const pts: number[] = [];
    for (let j = 0; j <= 16; j++) {
      const a = a0 + (j / 16) * Math.PI * 1.35;
      pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    f.poly(pts, false).stroke({ width: line * 2.4, color: INK, cap: 'round', join: 'round' });
    f.poly(pts, false).stroke({ width: line * 1.1, color: i === 1 ? look.glow[2] : look.glow[1], cap: 'round', join: 'round' });
  }
  // the leaf riding round the top ring
  const a = spin;
  const depth = Math.sin(a);
  const lx = lean + Math.cos(a) * bw * 0.26;
  const ly = -bh * 0.25 + depth * bh * 0.03;
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

/** A little sun over the neck: a bright disc, its rays turning slowly and pulsing. */
function drawRay({ f, look, t, bh, line }: Mark): void {
  const cy = -bh * 0.24 - Math.sin(t * W) * bh * 0.02;
  const r = bh * 0.07;
  // an eighth of a turn a loop: the rays look the same again
  const spin = (t * W) / 4;
  const pulse = 1 + 0.12 * Math.sin(t * W * 2);
  for (let i = 0; i < 8; i++) {
    const a = spin + (i * Math.PI) / 4;
    const len = r * (i % 2 ? 1.6 : 2.2) * pulse;
    const pts = [Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25, Math.cos(a) * len, cy + Math.sin(a) * len];
    f.poly(pts, false).stroke({ width: line * 2.4, color: INK, cap: 'round' });
    f.poly(pts, false).stroke({ width: line * 1.1, color: look.glow[1], cap: 'round' });
  }
  f.circle(0, cy, r).fill(look.glow[1]).stroke({ width: line, color: INK });
  f.circle(-r * 0.3, cy - r * 0.3, r * 0.35).fill(look.glow[2]);
}

/** A bead of quicksilver bobbing over the neck, and a smaller one dripping off it. */
function drawDrop({ f, look, t, bw, bh, line }: Mark): void {
  const cy = -bh * 0.2 - Math.sin(t * W) * bh * 0.03;
  const r = bh * 0.07 * (1 + 0.06 * Math.sin(t * W * 2));
  f.moveTo(-r, cy).quadraticCurveTo(0, cy - r * 2.6, r, cy).arc(0, cy, r, 0, Math.PI).closePath().fill(look.glow[1]).stroke({ width: line, color: INK });
  f.circle(-r * 0.35, cy - r * 0.2, r * 0.3).fill(look.glow[2]);
  // the small one falls back into the neck once a loop
  const p = inLoop(t);
  const dr = bh * 0.025 * (1 - p * 0.5);
  f.circle(bw * 0.06, cy + r + p * bh * 0.14, dr).fill(look.glow[0]).stroke({ width: line * 0.6, color: INK });
}

/** A sprout curling up out of the neck, two leaves on it swaying. */
function drawSprout({ f, look, t, bh, line }: Mark): void {
  const sway = Math.sin(t * W) * bh * 0.04;
  const top: [number, number] = [sway, -bh * 0.3];
  const stem = [0, 0, sway * 0.3 - bh * 0.05, -bh * 0.15, top[0], top[1]];
  f.moveTo(stem[0], stem[1]).quadraticCurveTo(stem[2], stem[3], stem[4], stem[5]).stroke({ width: line * 2.6, color: INK, cap: 'round' });
  f.moveTo(stem[0], stem[1]).quadraticCurveTo(stem[2], stem[3], stem[4], stem[5]).stroke({ width: line * 1.2, color: look.glow[0], cap: 'round' });
  // a curl at the tip
  f.arc(top[0] + bh * 0.03, top[1], bh * 0.03, Math.PI, Math.PI * 2.6).stroke({ width: line * 1.2, color: look.glow[0], cap: 'round' });
  for (const side of [-1, 1]) {
    const lx = sway * 0.6 + side * bh * 0.07;
    const ly = -bh * (side < 0 ? 0.16 : 0.22);
    const a = side * (0.5 + 0.15 * Math.sin(t * W * 2 + side));
    const c = Math.cos(a), sn = Math.sin(a);
    const pts: number[] = [];
    for (let j = 0; j < 12; j++) {
      const u = (j / 12) * Math.PI * 2;
      const px = Math.cos(u) * bh * 0.065;
      const py = Math.sin(u) * bh * 0.03;
      pts.push(lx + px * c - py * sn, ly + px * sn + py * c);
    }
    f.poly(pts).fill(look.glow[1]).stroke({ width: line * 0.8, color: INK, join: 'round' });
  }
}

/** Three little stars circling over the neck, twinkling. */
function drawStars({ f, look, t, bw, bh, line }: Mark): void {
  const cy = -bh * 0.2;
  // a third of a turn a loop: the three stars swap places
  const spin = (t * W * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI * 2) / 3;
    // a flat orbit: stars at the front are bigger than the ones going round the back
    const depth = 0.75 + 0.25 * Math.sin(a);
    // twinkle and turn by where the star is on the orbit, not which star it is, so the loop
    // closes after the stars swap places
    const twinkle = 1 + 0.15 * Math.sin(a * 3 + t * W * 2);
    star(f, Math.cos(a) * bw * 0.3, cy + Math.sin(a) * bh * 0.06, bh * 0.13 * depth * twinkle, Math.sin(a * 3 + t * W) * 0.3, look.glow, line);
  }
}

/** Cold mist curling out of the neck, and an ice crystal turning above it. */
function drawFrost({ f, look, t, bw, bh, line }: Mark): void {
  for (let i = 0; i < 4; i++) {
    const p = (inLoop(t) + i / 4) % 1;
    const mx = Math.sin(p * 5 + i * 2.1) * bw * 0.1 * (0.3 + p);
    f.circle(mx, -p * bh * 0.32, bh * (0.035 + 0.05 * p)).fill({ color: i % 2 ? look.glow[1] : look.glow[2], alpha: 0.75 * (1 - p) });
  }
  // a sixth of a turn a loop: the crystal looks the same again
  snowflake(f, 0, -bh * 0.24 - Math.sin(t * W) * bh * 0.025, bh * 0.1, (t * W) / 3, look.glow, line);
}

function drawArms(f: Graphics, look: PotionLook, t: number, at: (fx: number, fy: number) => [number, number], bh: number, w: number, r: number, line: number): void {
  // arms: the right one draws back over the head and flings up; the left one balances
  const [lx, ly] = at(0.13, 0.62);
  const [rx, ry] = at(0.87, 0.62);
  const swing = Math.sin(t * W) * bh * 0.02;
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
