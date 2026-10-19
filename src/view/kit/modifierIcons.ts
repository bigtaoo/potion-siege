// The daily challenge's modifier icons, one drawing per modifier.

import { Container, Graphics } from 'pixi.js';
import { COLORS, HERO_COLORS } from '../ui';
import type { ModifierId } from '../../sim/challenge';
import type { HeroKind } from '../../sim/types';
import { P } from './palette';
import { flask } from './icons';

// ---- the daily challenge's modifiers ----

/** A five-point star: the points `r` out, the dents `r * dent`. */
function starPoints(x: number, y: number, r: number, n = 5, dent = 0.46): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rr = i % 2 ? r * dent : r;
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  return pts;
}

/** A gold crown, `s` scaled, its base on y 0. */
function crown(g: Graphics, x: number, y: number, s: number, color: number = COLORS.gold): Graphics {
  return g
    .poly([x - 30 * s, y, x - 34 * s, y - 40 * s, x - 15 * s, y - 20 * s, x, y - 46 * s, x + 15 * s, y - 20 * s, x + 34 * s, y - 40 * s, x + 30 * s, y])
    .fill(color)
    .stroke({ width: 5, color: P.line, join: 'round' })
    .roundRect(x - 32 * s, y - 4 * s, 64 * s, 14 * s, 5 * s)
    .fill(P.brassDark)
    .stroke({ width: 4, color: P.line })
    .circle(x, y - 22 * s, 6 * s)
    .fill(P.red)
    .stroke({ width: 3, color: P.line });
}

/** The icon of a challenge modifier, about 100 across; `trial` colours the trial's flask. */
export function modifierIcon(id: ModifierId, trial: HeroKind | null = null): Container {
  const c = new Container();
  const g = new Graphics();
  c.addChild(g);
  switch (id) {
    case 'swift':
      // two chevrons rushing on, with speed lines behind
      for (const [x, y, w] of [[-44, -20, 26], [-50, 0, 34], [-44, 20, 26]]) g.roundRect(x, y - 4, w, 8, 4).fill(P.inkSoft);
      for (const dx of [-8, 22]) g.poly([dx - 10, -34, dx + 18, 0, dx - 10, 34, dx + 4, 34, dx + 32, 0, dx + 4, -34]).fill(0xff9a3d).stroke({ width: 5, color: P.line, join: 'round' });
      break;
    case 'ironWall':
      // a riveted iron shield
      g.poly([0, -48, 40, -34, 36, 10, 0, 48, -36, 10, -40, -34]).fill(0x9aa7b0).stroke({ width: 5, color: P.line, join: 'round' });
      g.poly([0, -34, 26, -25, 24, 6, 0, 32]).fill({ color: 0xffffff, alpha: 0.3 });
      for (const [x, y] of [[-26, -26], [26, -26], [0, 34], [-22, 8], [22, 8]]) g.circle(x, y, 5).fill(P.brassLight).stroke({ width: 3, color: P.line });
      break;
    case 'cheap':
      // a coin with the price coming down
      g.circle(-10, 4, 34).fill(COLORS.gold).stroke({ width: 5, color: P.line });
      g.circle(-10, 4, 22).stroke({ width: 4, color: P.brassDark });
      g.poly([26, -40, 42, -40, 42, 6, 54, 6, 34, 36, 14, 6, 26, 6]).fill(0x3c9a4a).stroke({ width: 5, color: P.line, join: 'round' });
      break;
    case 'twinBoss':
      crown(g, -20, 14, 0.8, P.brassDark);
      crown(g, 16, 40, 1);
      break;
    case 'critDay':
      // a burst with a smaller hot core
      g.poly(starPoints(0, 0, 50, 8, 0.55)).fill(0xff6a3d).stroke({ width: 5, color: P.line, join: 'round' });
      g.poly(starPoints(0, 0, 26, 8, 0.6)).fill(COLORS.gold).stroke({ width: 4, color: P.line, join: 'round' });
      break;
    case 'trial': {
      // a flask of the trial potion with a ticket tag
      flask(g, -6, 46, 92, trial ? HERO_COLORS[trial] : P.brass, true);
      g.roundRect(18, -40, 34, 24, 5).fill(P.paper).stroke({ width: 4, color: P.line });
      g.circle(24, -28, 3).fill(P.line);
      break;
    }
    case 'solo':
      // one sprout in a pot
      g.moveTo(0, 20).quadraticCurveTo(-4, -10, 2, -30).stroke({ width: 7, color: 0x2b7c36, cap: 'round' });
      g.ellipse(-20, -22, 20, 11).fill(0x4cc35a).stroke({ width: 4, color: P.line });
      g.ellipse(20, -34, 20, 11).fill(0x4cc35a).stroke({ width: 4, color: P.line });
      g.poly([-30, 14, 30, 14, 22, 48, -22, 48]).fill(0xb8653a).stroke({ width: 5, color: P.line, join: 'round' });
      g.roundRect(-34, 8, 68, 14, 5).fill(0xcf7a48).stroke({ width: 4, color: P.line });
      break;
    case 'goldRain':
      // coins falling, with streaks above
      for (const [x, y] of [[-28, -10], [24, -26], [2, 26]]) {
        g.roundRect(x - 3, y - 44, 6, 22, 3).fill({ color: P.inkSoft, alpha: 0.7 });
        g.circle(x, y, 20).fill(COLORS.gold).stroke({ width: 5, color: P.line });
        g.circle(x - 5, y - 6, 6).fill({ color: 0xffffff, alpha: 0.5 });
      }
      break;
  }
  return c;
}
