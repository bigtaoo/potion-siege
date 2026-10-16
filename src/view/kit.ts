// The alchemist's-workshop look of the menus: walnut panels in brass frames, parchment cards,
// brass name plates and glossy potion buttons, all cel-shaded with the same dark outline as
// the art. Every menu screen is built from these.

import { CanvasTextMetrics, Container, Graphics, Sprite, type Text, type TextStyleOptions } from 'pixi.js';
import { enemyTexture, ultimateTexture } from './art';
import { COLORS, gem, HERO_COLORS, label } from './ui';
import { slab } from './stone';
import type { EnemyKind, HeroKind } from '../sim/types';

export const P = {
  line: 0x24140a,
  wood: 0x5b3a22,
  woodDark: 0x3d2615,
  woodLight: 0x7a5233,
  brass: 0xd9a441,
  brassLight: 0xf7d77e,
  brassDark: 0x8f5c1d,
  paper: 0xf3e2bd,
  paperDark: 0xdcc08a,
  ink: 0x4a2c16,
  inkSoft: 0x8a6a48,
  cream: 0xfff1d6,
  soft: 0xf0dcc0,
  red: 0xe5484d,
} as const;

/** The button colours: body, the darker lip under it, and the glossy band on top. */
const BUTTON = {
  green: [0x4cc35a, 0x2b7c36],
  brass: [P.brass, P.brassDark],
  purple: [0x8f5ce0, 0x5a35a0],
  off: [0xa8987f, 0x6e604f],
} as const;
export type ButtonKind = Exclude<keyof typeof BUTTON, 'off'>;

/** Dark ink on parchment, without the outline the labels on wood need. */
export function ink(text: string, size: number, style: TextStyleOptions = {}): Text {
  return label(text, size, { fill: P.ink, stroke: { color: P.ink, width: 0 }, ...style });
}

/** Closing punctuation stays at the end of a line instead of starting the next one. */
const NO_START = /^[，。、；：！？）」』%,.;:!?)]/;

/** Ink text wrapped to `width`: Latin words and numbers stay whole, and Chinese breaks
 *  between characters but never before closing punctuation (Pixi's own wrap does both). */
export function inkWrapped(text: string, size: number, width: number, style: TextStyleOptions = {}): Text {
  const out = ink(text, size, style);
  const tokens = text.match(/[A-Za-z0-9+%.×-]+|\s+|./gu) ?? [];
  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    const next = line + tok;
    if (line.trim() && !NO_START.test(tok) && CanvasTextMetrics.measureText(next, out.style).width > width) {
      lines.push(line.trimEnd());
      line = tok.trimStart();
    } else {
      line = next;
    }
  }
  lines.push(line);
  out.text = lines.join('\n');
  return out;
}

/** The workshop wall behind the menus (and beside the battle on a wide screen): dark planks,
 *  lit warm in the middle. */
export function workshopWall(w: number, h: number): Graphics {
  const g = new Graphics().rect(0, 0, w, h).fill(0x2e1d10);
  for (let x = 0, i = 0; x < w; x += 150, i++) {
    g.rect(x, 0, 150, h).fill(i % 2 ? 0x34210f : 0x3a2513);
    g.rect(x, 0, 5, h).fill(0x1c1108);
  }
  for (let i = 6; i > 0; i--) g.ellipse(w / 2, h * 0.45, w * 0.1 * i, h * 0.08 * i).fill({ color: 0xffb35a, alpha: 0.035 });
  return g;
}

/** A walnut board in a brass frame with a rivet in each corner, centred on its position. */
export function woodPanel(w: number, h: number): Graphics {
  const g = new Graphics();
  const x = -w / 2;
  const y = -h / 2;
  g.roundRect(x, y + 12, w, h, 40).fill({ color: P.line, alpha: 0.6 });
  g.roundRect(x, y, w, h, 40).fill(P.brassDark).stroke({ width: 6, color: P.line });
  g.roundRect(x + 6, y + 6, w - 12, h - 18, 34).fill(P.brass);
  g.roundRect(x + 20, y + 12, w - 40, 8, 4).fill({ color: P.brassLight, alpha: 0.8 });
  g.roundRect(x + 22, y + 24, w - 44, h - 46, 24).fill(P.wood).stroke({ width: 4, color: P.line });
  // planks: a seam every so often, and a darker shade along the top under the frame
  g.roundRect(x + 24, y + 26, w - 48, 18, 8).fill({ color: P.woodDark, alpha: 0.7 });
  for (let py = y + 130; py < y + h - 60; py += 110) g.rect(x + 30, py, w - 60, 4).fill({ color: P.woodDark, alpha: 0.55 });
  for (const [rx, ry] of [[x + 22, y + 22], [x + w - 22, y + 22], [x + 22, y + h - 26], [x + w - 22, y + h - 26]]) {
    g.circle(rx, ry, 10).fill(P.brassLight).stroke({ width: 4, color: P.line });
  }
  return g;
}

/** A parchment card with a darker lip along the bottom, centred on its position. */
export function paperCard(w: number, h: number, r = 26): Graphics {
  const x = -w / 2;
  const y = -h / 2;
  return new Graphics()
    .roundRect(x, y + 8, w, h, r)
    .fill({ color: P.line, alpha: 0.45 })
    .roundRect(x, y, w, h, r)
    .fill(P.paperDark)
    .roundRect(x, y, w, h - 10, r)
    .fill(P.paper)
    .roundRect(x, y, w, h, r)
    .stroke({ width: 5, color: P.line });
}

/** The plate colours: body, its darker edge and the highlight. */
const PLATE = {
  brass: [P.brass, P.brassDark, P.brassLight],
  red: [0xc9463d, 0x7e2421, 0xf08a7a],
} as const;

/** A brass (or red) name plate with ribbon tails, its text in cream. */
export function plate(text: string, size = 56, minW = 360, tone: keyof typeof PLATE = 'brass'): Container {
  const [body, dark, light] = PLATE[tone];
  const c = new Container();
  const t = label(text, size, { fill: P.cream, stroke: { color: P.line, width: Math.max(5, size / 8) } });
  const w = Math.max(minW, t.width + 120);
  const h = size + 44;
  const g = new Graphics();
  for (const s of [-1, 1]) {
    const x0 = (s * w) / 2;
    g.poly([x0 - s * 30, -h / 2 + 18, x0 + s * 44, -h / 2 + 18, x0 + s * 24, 8, x0 + s * 44, h / 2 + 10, x0 - s * 30, h / 2 + 10])
      .fill(dark)
      .stroke({ width: 5, color: P.line, join: 'round' });
  }
  g.roundRect(-w / 2, -h / 2 + 6, w, h, 18).fill({ color: P.line, alpha: 0.5 });
  g.roundRect(-w / 2, -h / 2, w, h, 18).fill(dark);
  g.roundRect(-w / 2, -h / 2, w, h - 8, 18).fill(body);
  g.roundRect(-w / 2 + 16, -h / 2 + 8, w - 32, 8, 4).fill({ color: light, alpha: 0.9 });
  g.roundRect(-w / 2, -h / 2, w, h, 18).stroke({ width: 5, color: P.line });
  t.y = -3;
  c.addChild(g, t);
  return c;
}

/** A glossy capsule button centred on its position, with an optional crystal price. */
export class PillButton extends Container {
  private readonly bg = new Graphics();
  private enabled = true;

  constructor(
    caption: string,
    private readonly w: number,
    private readonly h: number,
    private readonly kind: ButtonKind,
    onTap: () => void,
    size = 52,
    price = false,
  ) {
    super();
    const text = label(caption, size, { stroke: { color: P.line, width: Math.max(4, size / 8) } });
    text.y = -4;
    this.addChild(this.bg, text);
    if (price) {
      // the crystal to the left of the number, the pair centred
      text.x = 22;
      this.addChild(gem(new Graphics(), 22 - text.width / 2 - 30, -4, size * 0.48));
    }
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', (e) => {
      e.stopPropagation();
      if (this.enabled) onTap();
    });
    this.draw();
  }

  setEnabled(on: boolean): this {
    if (on !== this.enabled) {
      this.enabled = on;
      this.cursor = on ? 'pointer' : 'default';
      this.draw();
    }
    return this;
  }

  private draw(): void {
    const { w, h } = this;
    const r = h / 2;
    const [body, lip] = BUTTON[this.enabled ? this.kind : 'off'];
    this.bg
      .clear()
      .roundRect(-w / 2, -h / 2 + 8, w, h, r)
      .fill({ color: P.line, alpha: 0.5 })
      .roundRect(-w / 2, -h / 2, w, h, r)
      .fill(lip)
      .roundRect(-w / 2, -h / 2, w, h - 10, r)
      .fill(body)
      .roundRect(-w / 2 + r * 0.6, -h / 2 + 8, w - r * 1.2, Math.max(8, h * 0.14), 6)
      .fill({ color: 0xffffff, alpha: 0.35 })
      .roundRect(-w / 2, -h / 2, w, h, r)
      .stroke({ width: 6, color: P.line });
  }
}

/** A round brass medallion, the frame for icon buttons; the icon goes on top of it. */
export function medal(r: number, face: number = P.wood): Graphics {
  return new Graphics()
    .circle(0, 6, r)
    .fill({ color: P.line, alpha: 0.5 })
    .circle(0, 0, r)
    .fill(P.brassDark)
    .stroke({ width: 5, color: P.line })
    .circle(0, -3, r - 6)
    .fill(P.brass)
    .circle(0, 0, r * 0.72)
    .fill(face)
    .stroke({ width: 4, color: P.line });
}

/** Makes a container tappable. */
export function tappable<T extends Container>(c: T, onTap: () => void): T {
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.on('pointertap', onTap);
  return c;
}

/** The red dot that says something is waiting. */
export function redDot(c: Container, x: number, y: number): void {
  c.addChild(new Graphics().circle(x, y, 17).fill(P.red).stroke({ width: 5, color: P.line }));
}

/** A hero's ultimate bottle, `h` tall. */
export function bottle(kind: HeroKind, h: number): Container {
  const c = new Container();
  const tex = ultimateTexture(kind);
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(h / Math.max(tex.width, tex.height));
    c.addChild(s);
  } else {
    c.addChild(flask(new Graphics(), 0, h * 0.45, h * 0.9, HERO_COLORS[kind], true));
  }
  return c;
}

/** A round flask standing on `feet`, `h` tall, filled with `color`: the stand-in for a potion
 *  whose art is not drawn yet. With `face` it gets the eyes of a living potion. */
export function flask(g: Graphics, x: number, feet: number, h: number, color: number, face = false): Graphics {
  const r = h * 0.36;
  const cy = feet - r;
  const nw = r * 0.62;
  g.roundRect(x - nw / 2, feet - h, nw, h - 2 * r + r * 0.4, 4).fill(0xcfeef5).stroke({ width: Math.max(2, h * 0.03), color: P.line });
  g.roundRect(x - nw * 0.65, feet - h - h * 0.02, nw * 1.3, h * 0.08, 4).fill(P.woodLight).stroke({ width: Math.max(2, h * 0.025), color: P.line });
  g.circle(x, cy, r).fill(color).stroke({ width: Math.max(2, h * 0.035), color: P.line });
  g.ellipse(x - r * 0.4, cy - r * 0.45, r * 0.22, r * 0.12).fill({ color: 0xffffff, alpha: 0.6 });
  if (face) {
    for (const s of [-1, 1]) {
      g.circle(x + s * r * 0.32, cy + r * 0.05, r * 0.13).fill(P.line);
      g.circle(x + s * r * 0.32 - r * 0.04, cy + r * 0.01, r * 0.045).fill(0xffffff);
    }
    g.moveTo(x - r * 0.14, cy + r * 0.32).quadraticCurveTo(x, cy + r * 0.44, x + r * 0.14, cy + r * 0.32).stroke({ width: Math.max(2, h * 0.025), color: P.line, cap: 'round' });
  }
  return g;
}

/** Shrinks a text to fit `w` across. */
export function fit<T extends Text>(text: T, w: number): T {
  if (text.width > w) text.scale.set(w / text.width);
  return text;
}

/** An enemy's art fitted into `w` by `h`, centred; empty until the art has loaded. */
export function enemySprite(kind: EnemyKind, w: number, h: number = w): Container {
  const c = new Container();
  const tex = enemyTexture(kind);
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.min(w / tex.width, h / tex.height));
    c.addChild(s);
  }
  return c;
}

/** The red BOSS tag, its text `size` high. */
export function bossTag(size: number): Container {
  const c = new Container();
  const w = size * 4.1;
  const h = size * 1.6;
  c.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, size * 0.5).fill(P.red).stroke({ width: 4, color: P.line }), label('BOSS', size));
  return c;
}

/** The padlock drawn on locked things. */
export function lock(color: number = P.inkSoft, bg: number = P.paper): Graphics {
  return new Graphics()
    .roundRect(-22, -36, 44, 36, 14)
    .stroke({ width: 8, color })
    .roundRect(-32, -14, 64, 48, 10)
    .fill(color)
    .circle(0, 6, 7)
    .fill(bg)
    .rect(-3, 8, 6, 14)
    .fill(bg);
}

// ---- icons, about 100 units across, centred ----

export function gearIcon(r = 46, color: number = P.brass): Graphics {
  const g = new Graphics();
  const pts: number[] = [];
  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const step = Math.PI / teeth;
    for (const [da, rr] of [[-step * 0.95, 0.74], [-step * 0.45, 1], [step * 0.45, 1], [step * 0.95, 0.74]] as const) {
      pts.push(Math.cos(a + da) * r * rr, Math.sin(a + da) * r * rr);
    }
  }
  return g
    .poly(pts)
    .fill(color)
    .stroke({ width: 5, color: P.line, join: 'round' })
    .circle(-r * 0.12, -r * 0.12, r * 0.42)
    .fill({ color: 0xffffff, alpha: 0.25 })
    .circle(0, 0, r * 0.26)
    .fill(P.woodDark)
    .stroke({ width: 5, color: P.line });
}

export function bookIcon(): Graphics {
  return new Graphics()
    .roundRect(-36, -44, 72, 88, 10)
    .fill(0x8a3b2a)
    .stroke({ width: 5, color: P.line })
    .rect(24, -38, 10, 76)
    .fill(P.paper)
    .rect(-36, -44, 14, 88)
    .fill(0x6a2a1d)
    .circle(4, -4, 16)
    .fill(P.brass)
    .stroke({ width: 4, color: P.line })
    .roundRect(-36, -44, 72, 88, 10)
    .stroke({ width: 5, color: P.line });
}

export function chestIcon(): Graphics {
  return new Graphics()
    .roundRect(-46, -8, 92, 50, 8)
    .fill(P.woodLight)
    .stroke({ width: 5, color: P.line })
    .roundRect(-46, -40, 92, 38, 18)
    .fill(0x9a6a3e)
    .stroke({ width: 5, color: P.line })
    .rect(-30, -40, 12, 82)
    .fill(P.brass)
    .rect(18, -40, 12, 82)
    .fill(P.brass)
    .roundRect(-12, -14, 24, 28, 6)
    .fill(P.brassLight)
    .stroke({ width: 4, color: P.line });
}

/** One sword, point up, about 110 long. */
function sword(): Graphics {
  return new Graphics()
    .poly([-9, 22, -9, -40, 0, -54, 9, -40, 9, 22])
    .fill(0xe4edf2)
    .stroke({ width: 5, color: P.line, join: 'round' })
    .rect(-2, -44, 4, 60)
    .fill({ color: 0xffffff, alpha: 0.8 })
    .roundRect(-26, 20, 52, 12, 6)
    .fill(P.brass)
    .stroke({ width: 4, color: P.line })
    .roundRect(-6, 32, 12, 22, 4)
    .fill(P.woodDark)
    .stroke({ width: 4, color: P.line })
    .circle(0, 58, 8)
    .fill(P.brass)
    .stroke({ width: 4, color: P.line });
}

export function swordsIcon(): Container {
  const c = new Container();
  for (const s of [-1, 1]) {
    const g = sword();
    g.rotation = (s * Math.PI) / 4;
    c.addChild(g);
  }
  return c;
}

export function swordIcon(): Graphics {
  const g = sword();
  g.rotation = Math.PI / 4;
  return g;
}

/** A stopwatch: attack speed. */
export function stopwatchIcon(): Graphics {
  return new Graphics()
    .roundRect(-10, -56, 20, 14, 4)
    .fill(P.brass)
    .stroke({ width: 4, color: P.line })
    .circle(0, 4, 44)
    .fill(P.brass)
    .stroke({ width: 5, color: P.line })
    .circle(0, 4, 34)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line })
    .poly([0, 4, 0, -22])
    .stroke({ width: 6, color: P.line, cap: 'round' })
    .poly([0, 4, 18, 14])
    .stroke({ width: 6, color: P.red, cap: 'round' })
    .circle(0, 4, 6)
    .fill(P.line);
}

/** Two courses of wall stone. */
export function wallIcon(): Graphics {
  const g = new Graphics();
  slab(g, -46, -30, 92, 30, 0);
  slab(g, -46, 0, 92, 30, 1);
  return g;
}

/** A little heap of gold coins. */
export function coinsIcon(): Graphics {
  const g = new Graphics();
  for (const [x, y] of [[-14, 14], [16, 10], [0, -12]]) g.circle(x, y, 24).fill(COLORS.gold).stroke({ width: 5, color: P.line });
  return g;
}

export function calendarIcon(): Graphics {
  return new Graphics()
    .roundRect(-34, -30, 68, 64, 10)
    .fill(P.paper)
    .stroke({ width: 5, color: P.line })
    .roundRect(-34, -30, 68, 22, 10)
    .fill(P.red)
    .stroke({ width: 5, color: P.line })
    .roundRect(-20, -40, 10, 20, 4)
    .fill(P.brass)
    .stroke({ width: 3, color: P.line })
    .roundRect(10, -40, 10, 20, 4)
    .fill(P.brass)
    .stroke({ width: 3, color: P.line })
    .poly([-12, 10, -4, 18, 14, -2])
    .stroke({ width: 7, color: 0x3c9a4a, cap: 'round', join: 'round' });
}

export function scrollIcon(): Graphics {
  return new Graphics()
    .roundRect(-28, -36, 56, 72, 6)
    .fill(P.paper)
    .stroke({ width: 5, color: P.line })
    .roundRect(-36, -44, 72, 16, 8)
    .fill(P.paperDark)
    .stroke({ width: 4, color: P.line })
    .roundRect(-36, 28, 72, 16, 8)
    .fill(P.paperDark)
    .stroke({ width: 4, color: P.line })
    .rect(-16, -14, 32, 5)
    .fill(P.inkSoft)
    .rect(-16, 0, 32, 5)
    .fill(P.inkSoft)
    .rect(-16, 14, 20, 5)
    .fill(P.inkSoft);
}
