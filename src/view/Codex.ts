// The codex tab: every potion with its four star forms (the ones not in the game yet greyed
// out and locked), and the clockwork army with its art, its numbers and what each enemy is
// weak to or resists. A portrait page stacks the two boards; a landscape one sets them side
// by side.

import { Container, Graphics } from 'pixi.js';
import { t } from '../i18n';
import { enemyStats, resistLabel, resists } from '../sim/enemies';
import { heroUnlocked, unlockStage, type MetaSave } from '../sim/meta';
import { BALANCE, ENEMY_KINDS, HERO_KINDS, type EnemyKind, type HeroKind } from '../sim/types';
import { potionLook } from './art';
import { bossTag, bottle, enemySprite, fit, flask, ink, lock, P, paperCard, plate, woodPanel } from './kit';
import { INK, star, stillPotion } from './potion';
import { COLORS, HERO_COLORS, label } from './ui';

/** The part of the page the tab fills. */
export interface CodexArea {
  x: number;
  y: number;
  w: number;
  h: number;
  wide: boolean;
}

/** Room a board's title plate takes at its top, and its bottom margin. */
const HEAD = 76;
const FOOT = 34;
const GAP = 14;
const WEAK = 0x2f8a3a;
const STRONG = 0xc0392b;
const GREY = 0x8a7d6a;

export function buildCodex(m: MetaSave, a: CodexArea): Container {
  const root = new Container();
  const top = a.y + 50;
  const bottom = a.y + a.h - 24;
  if (a.wide) {
    const gap = 40;
    const hw = Math.min(840, (a.w - 3 * gap) * 0.52);
    const mw = a.w - 3 * gap - hw;
    const ph = bottom - top;
    root.addChild(heroBoard(m, hw, ph), monsterBoard(m.stage, mw, ph, true));
    root.children[0].position.set(a.x + gap + hw / 2, top + ph / 2);
    root.children[1].position.set(a.x + 2 * gap + hw + mw / 2, top + ph / 2);
  } else {
    const pw = Math.min(1000, a.w - 60);
    const hh = 820;
    const mh = bottom - top - hh - 56;
    root.addChild(heroBoard(m, pw, hh), monsterBoard(m.stage, pw, mh, false));
    root.children[0].position.set(a.x + a.w / 2, top + hh / 2);
    root.children[1].position.set(a.x + a.w / 2, bottom - mh / 2);
  }
  return root;
}

function board(title: string, w: number, h: number): Container {
  const c = new Container();
  const p = plate(title, 40, 300);
  p.y = -h / 2 + 4;
  c.addChild(woodPanel(w, h), p);
  return c;
}

// ---- potions ----

function heroBoard(m: MetaSave, w: number, h: number): Container {
  const c = board(t('codex.heroes'), w, h);
  const rw = w - 60;
  const rh = (h - HEAD - FOOT - GAP * (HERO_KINDS.length - 1)) / HERO_KINDS.length;
  HERO_KINDS.forEach((kind, i) => {
    const r = heroRow(m, kind, rw, rh);
    r.y = -h / 2 + HEAD + rh / 2 + i * (rh + GAP);
    c.addChild(r);
  });
  return c;
}

/** A potion's name and level, then its forms from one star to the ultimate. */
function heroRow(m: MetaSave, kind: HeroKind, rw: number, rh: number): Container {
  const look = potionLook(kind);
  const open = heroUnlocked(m, kind);
  const r = new Container();
  r.addChild(paperCard(rw, rh, 22));
  const sw = Math.min(240, rw * 0.27);
  const sx = -rw / 2 + 10 + sw / 2;
  r.addChild(new Graphics().roundRect(-rw / 2 + 10, -rh / 2 + 10, sw, rh - 30, 16).fill(open ? HERO_COLORS[kind] : GREY).stroke({ width: 4, color: P.line }));
  const name = fit(label(t(`hero.${kind}`), 36, { stroke: { color: P.line, width: 7 } }), sw - 24);
  name.position.set(sx, -rh / 2 + 10 + (rh - 30) * 0.34);
  const at = unlockStage(kind);
  const sub = fit(label(open ? `Lv ${m.heroes[kind]}` : at ? t('unlockAt', { n: at }) : t('codex.locked'), 28, { fill: P.cream, stroke: { color: P.line, width: 6 } }), sw - 24);
  sub.position.set(sx, -rh / 2 + 10 + (rh - 30) * 0.72);
  r.addChild(name, sub);

  const x0 = -rw / 2 + 20 + sw;
  const slotW = (rw / 2 - 10 - x0) / BALANCE.maxStar;
  const feet = rh / 2 - 40;
  const potions = new Container();
  const over = new Container();
  for (let s = 1; s <= BALANCE.maxStar; s++) {
    const cx = x0 + slotW * (s - 0.5);
    r.addChild(new Graphics().roundRect(cx - slotW / 2 + 6, -rh / 2 + 10, slotW - 12, rh - 30, 14).fill({ color: P.paperDark, alpha: 0.55 }));
    stars(r, cx, rh / 2 - 26, s, open);
    if (!open || (!look && s < BALANCE.maxStar)) {
      // a potion still waiting for its art stands in coloured flasks
      flasks(r, cx, feet, s, rh, open ? HERO_COLORS[kind] : undefined);
    } else if (look && s < BALANCE.maxStar) {
      const fh = rh * 0.46;
      const step = fh * 0.58;
      for (let i = 0; i < s; i++) {
        // the middle one of three stands a little behind the others
        const back = s === 3 && i === 1;
        r.addChild(new Graphics().ellipse(cx + (i - (s - 1) / 2) * step, feet - 2, fh * 0.32, fh * 0.08).fill({ color: 0x000000, alpha: 0.22 }));
        potions.addChild(stillPotion(look, { x: cx + (i - (s - 1) / 2) * step, feet: feet - (back ? 6 : 0), height: fh, alpha: 1, dim: false, phase: i + 1, time: 0, wind: 0, since: 9, pop: 1 }));
      }
    } else {
      // the ultimate, big, in its golden aura
      const cy = feet - rh * 0.3;
      over.addChild(new Graphics().circle(cx, cy, rh * 0.34).fill({ color: COLORS.gold, alpha: 0.35 }).circle(cx, cy, rh * 0.24).fill({ color: 0xfff3c0, alpha: 0.4 }));
      const b = bottle(kind, rh * 0.72);
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

/** The star count under a form. */
function stars(r: Container, cx: number, y: number, n: number, on: boolean): void {
  const g = new Graphics();
  const glow: [number, number, number] = on ? [P.brass, P.brass, P.brassLight] : [GREY, GREY, P.paperDark];
  for (let i = 0; i < n; i++) star(g, cx + (i - (n - 1) / 2) * 24, y, 12, 0, glow, 3);
  r.addChild(g);
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

// ---- the clockwork army ----

/** Four cards side by side on a portrait page; four rows on a landscape one. The numbers are
 *  for the stage picked on the battle tab. */
function monsterBoard(stage: number, w: number, h: number, rows: boolean): Container {
  const c = board(t('codex.monsters'), w, h);
  const note = ink(t('codex.stage', { n: stage }), 26, { fill: P.cream });
  note.anchor.set(1, 0.5);
  note.position.set(w / 2 - 34, -h / 2 + 52);
  c.addChild(note);
  const inner = h - HEAD - FOOT;
  ENEMY_KINDS.forEach((kind, i) => {
    let card: Container;
    if (rows) {
      const ch = (inner - GAP * 3) / 4;
      card = monsterRow(kind, stage, w - 60, ch);
      card.y = -h / 2 + HEAD + ch / 2 + i * (ch + GAP);
    } else {
      const cw = (w - 50 - GAP * 3) / 4;
      card = monsterCard(kind, stage, cw, inner);
      card.position.set(-w / 2 + 25 + cw / 2 + i * (cw + GAP), -h / 2 + HEAD + inner / 2);
    }
    c.addChild(card);
  });
  return c;
}

/** A tall card: art, name, the numbers, then the resistances two by two. */
function monsterCard(kind: EnemyKind, stage: number, cw: number, ch: number): Container {
  const c = new Container();
  c.addChild(paperCard(cw, ch, 22));
  const top = -ch / 2;
  const artH = ch - 412;
  c.addChild(art(kind, cw - 30, artH, 0, top + 16 + artH / 2));
  let y = top + artH + 46;
  const name = fit(ink(t(`enemy.${kind}`), 36), cw - 24);
  name.y = y;
  c.addChild(name);
  y += 46;
  for (const s of statLines(kind, stage)) {
    const l = fit(ink(s, 27, { fill: P.inkSoft }), cw - 24);
    l.y = y;
    c.addChild(l);
    y += 36;
  }
  c.addChild(new Graphics().rect(-cw / 2 + 18, y - 8, cw - 36, 3).fill({ color: P.inkSoft, alpha: 0.5 }));
  const head = fit(ink(t('codex.resist'), 24, { fill: P.inkSoft }), cw - 24);
  head.y = y + 14;
  const ch2 = chips(kind, 2);
  ch2.position.set(0, y + 120);
  c.addChild(head, ch2);
  return c;
}

/** A wide row: art, then name and numbers, then the resistances three by two. */
function monsterRow(kind: EnemyKind, stage: number, rw: number, rh: number): Container {
  const c = new Container();
  c.addChild(paperCard(rw, rh, 22));
  const artW = Math.min(170, rw * 0.24);
  c.addChild(art(kind, artW, rh - 30, -rw / 2 + 14 + artW / 2, -4));
  const tx = -rw / 2 + 26 + artW;
  const cx = rw / 2 - 14 - CHIP_W * 1.5;
  const room = cx - CHIP_W * 1.5 - 12 - tx;
  const name = fit(ink(t(`enemy.${kind}`), 34), room);
  name.anchor.set(0, 0.5);
  name.position.set(tx, -rh / 2 + 34);
  c.addChild(name);
  statLines(kind, stage).forEach((s, i) => {
    const l = fit(ink(s, 25, { fill: P.inkSoft }), room);
    l.anchor.set(0, 0.5);
    l.position.set(tx, -rh / 2 + 74 + i * 31);
    c.addChild(l);
  });
  const head = ink(t('codex.resist'), 24, { fill: P.inkSoft });
  head.position.set(cx, -rh / 2 + 32);
  const row = chips(kind, 3);
  row.position.set(cx, 24);
  c.addChild(head, row);
  return c;
}

/** The enemy's art fitted into a box centred on (x, y), the boss tagged. */
function art(kind: EnemyKind, bw: number, bh: number, x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.addChild(new Graphics().ellipse(0, bh * 0.4, bw * 0.34, bh * 0.07).fill({ color: 0x000000, alpha: 0.2 }), enemySprite(kind, bw, bh));
  if (kind === 'boss') {
    const tag = bossTag(22);
    tag.position.set(bw / 2 - 46, -bh / 2 + 18);
    c.addChild(tag);
  }
  return c;
}

/** Hit points on the first wave it comes in on this stage, speed and how hard it hits the wall. */
function statLines(kind: EnemyKind, stage: number): string[] {
  const e = enemyStats(kind, stage);
  return [t('codex.hpWave', { n: Math.round(e.hp), w: e.wave }), t('codex.speed', { n: e.speed }), t('codex.wallDps', { n: e.wallDps })];
}

const CHIP_W = 106;

/** One chip per element, potions not in the game yet too: its potion and how much more or
 *  less it hurts. */
function chips(kind: EnemyKind, cols: number): Container {
  const c = new Container();
  const cw = CHIP_W;
  const all = resists(kind);
  const rows = Math.ceil(all.length / cols);
  all.forEach(({ element: el, value: v }, i) => {
    const chip = new Container();
    chip.position.set(((i % cols) - (cols - 1) / 2) * cw, (Math.floor(i / cols) - (rows - 1) / 2) * 56);
    const color = v > 1 ? WEAK : v < 1 ? STRONG : P.inkSoft;
    chip.addChild(new Graphics().roundRect(-cw / 2 + 4, -24, cw - 8, 48, 24).fill({ color: v === 1 ? P.paperDark : color, alpha: v === 1 ? 0.6 : 0.18 }).stroke({ width: 3, color: v === 1 ? P.inkSoft : color }));
    chip.addChild(new Graphics().circle(-cw / 2 + 22, 0, 17).fill(HERO_COLORS[el]).stroke({ width: 3, color: P.line }));
    const b = bottle(el, 28);
    b.position.set(-cw / 2 + 22, 0);
    const text = ink(resistLabel(v), 21, { fill: color });
    text.anchor.set(0, 0.5);
    text.position.set(-cw / 2 + 42, 0);
    chip.addChild(b, text);
    c.addChild(chip);
  });
  return c;
}
