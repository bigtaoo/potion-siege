// The wall seen from above, in the grey of the stone road it guards, and the workshop floor
// behind it. Every built cell is a flagstone on the wall's top, and the wall is as thick in
// each column as the cells built there: the front edge, with its parapet and merlons, steps
// forward as the column grows. Outlines are a warm grey-brown, never black.

import type { Graphics } from 'pixi.js';

/** Stone, mortar and wood colours, matched to the road and the light workshop UI. */
export const STONE = {
  top: 0xd9d1c2,
  face: 0xa2998b,
  faceDark: 0x8f8678,
  joint: 0x8c8274,
  line: 0x6a5a4a,
  pave: [0xb9b0a0, 0xb1a898, 0xc1b8a8],
  slab: 0xd6cdbd,
  slabLip: 0xa89e8c,
  chalk: 0x9a86c4,
  shadow: 0x3e3128,
  brass: 0xd9a441,
  brassDark: 0x9a6a2a,
  brassLight: 0xf7d77e,
  track: 0x5e4a40,
  plank: [0xd2b78c, 0xc9ad82],
  plankSeam: 0xa4855e,
};

/** One column of the wall: its sides and the y of its front edge. */
export interface WallColumn {
  x0: number;
  x1: number;
  front: number;
}

/** A repeatable 0-1 number for a stone's size and tone. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** A block seen from above and the workshop side: its top face, then the face towards us. */
function block(g: Graphics, x: number, y: number, w: number, top: number, face: number): void {
  g.roundRect(x, y, w, top + face, 4).fill(STONE.face);
  g.rect(x + 2, y + top + face - 6, w - 4, 4).fill({ color: STONE.faceDark, alpha: 0.8 });
  g.roundRect(x, y, w, top, 4).fill(STONE.top);
  // a light chip along the top edge, the cel-shaded highlight
  g.roundRect(x + 5, y + 3, Math.min(w * 0.4, 26), 4, 2).fill({ color: 0xffffff, alpha: 0.55 });
  g.moveTo(x + 2, y + top).lineTo(x + w - 2, y + top).stroke({ width: 2, color: STONE.joint });
  g.roundRect(x, y, w, top + face, 4).stroke({ width: 3, color: STONE.line });
}

/** A paving flagstone: the spot one cell's potions stand on, with a chalk circle to stand in
 *  (left out for the small wall icon). */
export function slab(g: Graphics, x: number, y: number, w: number, h: number, seed: number, ring = true): void {
  g.roundRect(x, y + 4, w, h, 10).fill(STONE.slabLip);
  g.roundRect(x, y, w, h, 10).fill(STONE.slab);
  // two flagstones, the joint a little off-centre
  const j = x + w * (0.38 + (seed % 3) * 0.12);
  g.moveTo(j, y + 6).lineTo(j, y + h - 4).stroke({ width: 2, color: STONE.joint, alpha: 0.7 });
  g.roundRect(x + 6, y + 4, w * 0.3, 5, 2).fill({ color: 0xffffff, alpha: 0.6 });
  // the alchemist's chalk ring where the potions stand
  if (ring) chalkRing(g, x + w / 2, y + h * 0.7, w, h);
  g.roundRect(x, y, w, h + 4, 10).stroke({ width: 3, color: STONE.line });
}

/** A chalk ellipse with four dots on it, centred on (cx, cy), sized to a `w` x `h` slab. */
function chalkRing(g: Graphics, cx: number, cy: number, w: number, h: number): void {
  g.ellipse(cx, cy, w * 0.36, h * 0.13).stroke({ width: 3, color: STONE.chalk, alpha: 0.5 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    g.circle(cx + Math.cos(a) * w * 0.36, cy + Math.sin(a) * h * 0.13, 3).fill({ color: STONE.chalk, alpha: 0.55 });
  }
}

/** Courses of paving between `y0` and `y1` across `x0`-`x1`, cut at the column's sides. */
function paving(g: Graphics, x0: number, x1: number, y0: number, y1: number): void {
  const H = 34;
  for (let y = y1; y > y0; y -= H) {
    const row = Math.round(y / H);
    const top = Math.max(y0, y - H);
    let x = -hash(row) * 60;
    for (let k = 0; x < x1; k++) {
      const w = 54 + hash(row * 31 + k) * 46;
      const a = Math.max(x, x0);
      const b = Math.min(x + w, x1);
      if (b > a) {
        g.rect(a, top, b - a, y - top).fill(STONE.pave[Math.floor(hash(row * 7 + k * 13) * 3)]);
        g.rect(a + 2, top + 2, b - a - 4, 3).fill({ color: 0xffffff, alpha: 0.25 });
        if (x > x0) g.moveTo(x, top).lineTo(x, y).stroke({ width: 2, color: STONE.joint });
      }
      x += w;
    }
    g.moveTo(x0, top).lineTo(x1, top).stroke({ width: 2, color: STONE.joint });
  }
}

/** The wall's top from each column's front edge back to `back`: paving, then the parapet and
 *  merlons along the front, and along any side where the next column is thinner. */
export function wallTop(g: Graphics, columns: WallColumn[], back: number): void {
  // the wall's shadow on the road at its foot, showing between the merlons
  for (const c of columns) g.rect(c.x0, c.front - 26, c.x1 - c.x0, 16).fill({ color: STONE.shadow, alpha: 0.22 });
  for (const c of columns) paving(g, c.x0, c.x1, c.front, back);
  // the back edge, the coping where the wall drops to the workshop floor
  const w = columns[columns.length - 1].x1;
  g.rect(0, back - 8, w, 14).fill(STONE.top).stroke({ width: 3, color: STONE.line });
  columns.forEach((c, i) => {
    for (const [n, side] of [[columns[i - 1], c.x0], [columns[i + 1], c.x1]] as const) {
      if (n && n.front > c.front) block(g, side - 11, c.front, 22, n.front - c.front + 6, 10);
    }
  });
  for (const c of columns) {
    block(g, c.x0, c.front - 10, c.x1 - c.x0, 12, 16);
    const w = c.x1 - c.x0;
    const m = 50;
    const n = Math.max(1, Math.round(w / 70));
    for (let k = 0; k < n; k++) block(g, c.x0 + ((k + 0.5) * w) / n - m / 2, c.front - 54, m, 22, 34);
  }
}

/** The wall's inner face from `back` down to the floor at `floor`: two courses of stone and a
 *  brass-framed glass tube set into them for the health bar (`bar`: its x, y, width, height). */
export function innerFace(g: Graphics, width: number, back: number, floor: number, bar: { x: number; y: number; w: number; h: number }): void {
  g.rect(0, back + 6, width, floor - back - 6).fill(STONE.face);
  const mid = (back + 6 + floor) / 2;
  g.moveTo(0, mid).lineTo(width, mid).stroke({ width: 2, color: STONE.joint });
  for (let x = 40, k = 0; x < width; x += 110, k++) {
    g.moveTo(x, back + 6).lineTo(x, mid).stroke({ width: 2, color: STONE.joint });
    g.moveTo(x + 55, mid).lineTo(x + 55, floor).stroke({ width: 2, color: STONE.joint });
  }
  g.rect(0, floor - 5, width, 5).fill(STONE.faceDark);
  // the tube's brass frame, bolted at both ends
  const { x, y, w, h } = bar;
  g.roundRect(x - 16, y - 10, w + 32, h + 20, (h + 20) / 2).fill(STONE.brassDark).stroke({ width: 3, color: STONE.line });
  g.roundRect(x - 11, y - 6, w + 22, h + 12, (h + 12) / 2).fill(STONE.brass);
  g.roundRect(x + 20, y - 5, w - 40, 3, 1.5).fill({ color: STONE.brassLight, alpha: 0.9 });
  for (const bx of [x - 4, x + w + 4]) g.circle(bx, y + h / 2, 5).fill(STONE.brassLight).stroke({ width: 2, color: STONE.brassDark });
}

/** The glass and the potion in the tube: `frac` of it full, green until the wall is low. */
export function healthTube(g: Graphics, x: number, y: number, w: number, h: number, frac: number): void {
  const r = h / 2;
  g.roundRect(x, y, w, h, r).fill(STONE.track);
  const fw = Math.max(h, w * frac);
  const [body, light] = frac > 0.3 ? [0x5fcf5a, 0xa6ee8c] : [0xe5484d, 0xff9a8a];
  g.roundRect(x, y, fw, h, r).fill(body);
  g.roundRect(x + r * 0.6, y + 4, Math.max(0, fw - r * 1.2), h * 0.22, 3).fill({ color: light, alpha: 0.9 });
  // the glass's shine over the whole tube
  g.roundRect(x + r, y + h * 0.62, w - r * 2, 3, 1.5).fill({ color: 0xffffff, alpha: 0.18 });
  g.roundRect(x, y, w, h, r).stroke({ width: 2, color: STONE.line, alpha: 0.6 });
}

/** The workshop floor below the wall from `floor` to `bottom`: light planks, the wall's shadow
 *  along the top. */
export function workshopFloor(g: Graphics, width: number, floor: number, bottom: number): void {
  const H = 48;
  for (let y = floor, row = 0; y < bottom; y += H, row++) {
    g.rect(0, y, width, H).fill(STONE.plank[row % 2]);
    g.moveTo(0, y).lineTo(width, y).stroke({ width: 2, color: STONE.plankSeam });
    let x = -hash(row + 50) * 200;
    for (let k = 0; x < width; k++) {
      x += 180 + hash(row * 17 + k) * 160;
      g.moveTo(x, y).lineTo(x, y + H).stroke({ width: 2, color: STONE.plankSeam });
      // a knot or a streak of grain now and then
      if (hash(row * 5 + k * 3) > 0.6) g.moveTo(x - 120, y + H * 0.45).lineTo(x - 60, y + H * 0.45).stroke({ width: 2, color: STONE.plankSeam, alpha: 0.45 });
    }
  }
  g.rect(0, floor, width, 26).fill({ color: STONE.shadow, alpha: 0.16 });
  g.rect(0, floor, width, 10).fill({ color: STONE.shadow, alpha: 0.14 });
}

/** The chalk summoning circle the alchemist stands in. */
export function summonCircle(g: Graphics, x: number, y: number, rx: number, ry: number): void {
  g.ellipse(x, y, rx, ry).fill({ color: STONE.chalk, alpha: 0.14 });
  g.ellipse(x, y, rx, ry).stroke({ width: 4, color: STONE.chalk, alpha: 0.7 });
  g.ellipse(x, y, rx * 0.78, ry * 0.72).stroke({ width: 2, color: STONE.chalk, alpha: 0.6 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.circle(x + Math.cos(a) * rx * 0.89, y + Math.sin(a) * ry * 0.86, 3.5).fill({ color: STONE.chalk, alpha: 0.75 });
  }
}
