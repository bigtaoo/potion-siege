// Pictures in the workshop menus: a hero's bottle, the stand-in flask, enemy art, the BOSS tag,
// the padlock and the drawn icons.

import { Container, Graphics, Sprite } from 'pixi.js';
import { enemyTexture, ultimateTexture } from '../art';
import { COLORS, HERO_COLORS, label } from '../ui';
import { slab } from '../stone';
import type { EnemyKind, HeroKind } from '../../sim/types';
import { P } from './palette';

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

/** A brass infinity loop: endless mode. */
export function infinityIcon(): Graphics {
  const g = new Graphics();
  // the loop as a lemniscate, traced once in the outline colour and once in brass over it
  const pts: number[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const d = 1 + Math.sin(a) ** 2;
    pts.push((46 * Math.cos(a)) / d, (46 * Math.sin(a) * Math.cos(a)) / d);
  }
  return g
    .poly(pts)
    .stroke({ width: 24, color: P.line, join: 'round' })
    .poly(pts)
    .stroke({ width: 14, color: P.brass, join: 'round' })
    .poly(pts.map((v, i) => (i % 2 ? v - 2 : v)))
    .stroke({ width: 4, color: P.brassLight, join: 'round', alpha: 0.8 });
}

/** Two courses of wall stone. */
export function wallIcon(): Graphics {
  const g = new Graphics();
  slab(g, -46, -30, 92, 30, 0, false);
  slab(g, -46, 0, 92, 30, 1, false);
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
    .stroke({ width: 7, color: P.greenOn, cap: 'round', join: 'round' });
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
