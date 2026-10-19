// The potions page: each potion a row, its name and level, then its four star forms from one star
// to the ultimate (the ones not in the game yet greyed out and locked) under one row of stars.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { heroUnlocked, unlockStage, type MetaSave } from '../../sim/meta';
import { BALANCE, HERO_KINDS, type HeroKind } from '../../sim/types';
import { potionLook } from '../art';
import { bottle, fit, flask, LIGHT, lightTile, lock, P } from '../kit';
import { INK, star, stillPotion } from '../potion';
import { COLORS, HERO_COLORS, label } from '../ui';
import { board, FOOT, GAP, GREY, HEAD, type CodexArea } from './common';

/** Room the row of stars over the forms takes. */
const STARS = 52;

/** Every potion a row, as tall as the page allows up to a roomy cap; the board ends under the
 *  last one. */
export function potionsPage(root: Container, m: MetaSave, a: CodexArea, top: number): void {
  const w = a.wide ? Math.min(1400, a.w - 80) : Math.min(1000, a.w - 60);
  const gap = a.wide ? GAP : 22;
  const n = HERO_KINDS.length;
  const rh = Math.min(250, (a.y + a.h - 24 - top - HEAD - STARS - FOOT - gap * (n - 1)) / n);
  const h = HEAD + STARS + n * rh + (n - 1) * gap + FOOT;
  const c = board(t('codex.heroes'), w, h);
  c.position.set(a.x + a.w / 2, top + h / 2);
  const rw = w - 60;
  const { x0, slotW } = slots(rw, rh);
  const g = new Graphics();
  for (let s = 1; s <= BALANCE.maxStar; s++) stars(g, x0 + slotW * (s - 0.5), -h / 2 + HEAD + STARS / 2 - 6, s);
  c.addChild(g);
  HERO_KINDS.forEach((kind, i) => {
    const r = heroRow(m, kind, rw, rh);
    r.y = -h / 2 + HEAD + STARS + rh / 2 + i * (rh + gap);
    c.addChild(r);
  });
  root.addChild(c);
}

/** How wide a row's name plate is, where its forms start and how wide each form's slot is:
 *  shared by the rows and the stars over them. */
function slots(rw: number, rh: number): { sw: number; x0: number; slotW: number } {
  const sw = Math.min(240, rw * 0.27, rh * 1.6);
  const x0 = -rw / 2 + 20 + sw;
  return { sw, x0, slotW: (rw / 2 - 10 - x0) / BALANCE.maxStar };
}

/** A potion's name and level, then its forms from one star to the ultimate. */
function heroRow(m: MetaSave, kind: HeroKind, rw: number, rh: number): Container {
  const look = potionLook(kind);
  const open = heroUnlocked(m, kind);
  const r = new Container();
  r.addChild(lightTile(rw, rh, 22));
  const { sw, x0, slotW } = slots(rw, rh);
  const sx = -rw / 2 + 10 + sw / 2;
  const ph = rh - 20;
  r.addChild(new Graphics().roundRect(-rw / 2 + 10, -ph / 2, sw, ph, 16).fill(open ? HERO_COLORS[kind] : GREY).stroke({ width: 4, color: LIGHT.edge }));
  const name = fit(label(t(`hero.${kind}`), Math.min(38, rh * 0.3), { stroke: { color: P.line, width: 7 } }), sw - 24);
  name.position.set(sx, -ph * 0.17);
  const at = unlockStage(kind);
  const sub = fit(label(open ? `Lv ${m.heroes[kind]}` : at ? t('unlockAt', { n: at }) : t('codex.locked'), Math.min(30, rh * 0.25), { fill: P.cream, stroke: { color: P.line, width: 6 } }), sw - 24);
  sub.position.set(sx, ph * 0.23);
  r.addChild(name, sub);

  // the forms go by the slot's size, its narrow side on a portrait page
  const u = Math.min(ph, slotW * 1.1);
  const feet = u * 0.38;
  const potions = new Container();
  const over = new Container();
  for (let s = 1; s <= BALANCE.maxStar; s++) {
    const cx = x0 + slotW * (s - 0.5);
    r.addChild(new Graphics().roundRect(cx - slotW / 2 + 6, -ph / 2, slotW - 12, ph, 14).fill({ color: P.paperDark, alpha: 0.55 }));
    if (!open || (!look && s < BALANCE.maxStar)) {
      // a potion still waiting for its art stands in coloured flasks
      flasks(r, cx, feet, s, u, open ? HERO_COLORS[kind] : undefined);
    } else if (look && s < BALANCE.maxStar) {
      const fh = u * 0.46;
      const step = fh * 0.58;
      for (let i = 0; i < s; i++) {
        // the middle one of three stands a little behind the others
        const back = s === 3 && i === 1;
        r.addChild(new Graphics().ellipse(cx + (i - (s - 1) / 2) * step, feet - 2, fh * 0.32, fh * 0.08).fill({ color: 0x000000, alpha: 0.22 }));
        potions.addChild(stillPotion(look, { x: cx + (i - (s - 1) / 2) * step, feet: feet - (back ? 6 : 0), height: fh, alpha: 1, dim: false, phase: i + 1, time: 0, wind: 0, since: 9, pop: 1 }));
      }
    } else {
      // the ultimate, big, in its golden aura
      const cy = feet - u * 0.3;
      over.addChild(new Graphics().circle(cx, cy, u * 0.34).fill({ color: COLORS.gold, alpha: 0.35 }).circle(cx, cy, u * 0.24).fill({ color: 0xfff3c0, alpha: 0.4 }));
      const b = bottle(kind, u * 0.72);
      b.position.set(cx, cy);
      over.addChild(b);
    }
  }
  r.addChild(potions, over);
  if (!open) {
    const l = lock(P.cream, GREY);
    l.scale.set(0.5);
    l.position.set(sx - sub.width / 2 - 22, sub.y + 4);
    r.addChild(l);
    r.alpha = 0.75;
  }
  return r;
}

/** A form's star count, over its column. */
function stars(g: Graphics, cx: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) star(g, cx + (i - (n - 1) / 2) * 30, y, 15, 0, [P.brass, P.brass, P.brassLight], 3);
}

/** Grey flask silhouettes standing in for a locked potion: one to three small ones, then one
 *  big one. With `color`, an unlocked potion without its art yet, filled and with faces. */
function flasks(r: Container, cx: number, feet: number, n: number, rh: number, color?: number): void {
  const g = new Graphics();
  const one = (x: number, h: number) => {
    if (color !== undefined) {
      flask(g, x, feet, h, color, true);
      return;
    }
    const bw = h * 0.36;
    g.roundRect(x - bw * 0.3, feet - h, bw * 0.6, h * 0.34, 4).fill(GREY).stroke({ width: 3, color: INK });
    g.circle(x, feet - h * 0.36, bw).fill(GREY).stroke({ width: 3, color: INK });
  };
  if (n === BALANCE.maxStar) one(cx, rh * 0.62);
  else for (let i = 0; i < n; i++) one(cx + (i - (n - 1) / 2) * rh * 0.24, rh * 0.42);
  r.addChild(g);
  if (color !== undefined) return;
  const q = label('?', rh * 0.2, { fill: P.cream, stroke: { color: INK, width: 4 } });
  q.position.set(cx, feet - (n === BALANCE.maxStar ? rh * 0.22 : rh * 0.15));
  r.addChild(q);
}
