// The codex tab, in two pages a switch at the top turns between. The codex itself: every
// potion with its four star forms (the ones not in the game yet greyed out and locked), and the
// clockwork army with its art, its numbers and what each enemy is weak to or resists; a
// portrait page stacks the two boards, a landscape one sets them side by side. And the
// achievements: each track's next tier, how far along it is and its claim button.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../i18n';
import { achievementsClaimable, nextTier, TRACK_IDS, TRACKS, trackProgress, trackReady, type TrackId } from '../sim/achievements';
import { CHALLENGE_TIERS } from '../sim/challenge';
import { enemyStats, resistLabel, resists } from '../sim/enemies';
import { heroUnlocked, unlockStage, type MetaSave } from '../sim/meta';
import { BALANCE, HERO_KINDS, type EnemyKind, type HeroKind } from '../sim/types';
import { FIRST_STAGE } from '../sim/waves';
import { potionLook } from './art';
import {
  bossTag, bottle, calendarIcon, enemySprite, fit, flask, gearIcon, ink, LIGHT, lightPanel, lightTile, lock, P, PillButton, plate, redDot, stopwatchIcon,
  infinityIcon, swordsIcon, tappable, wallIcon,
} from './kit';
import { codexStage } from './nudges';
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
const WEAK = 0x26732f;
const STRONG = 0xb3352a;
const GREY = 0x8a7d6a;

type CodexPage = 'book' | 'feats';
/** The page shown, kept while the tab is rebuilt. */
let codexPage: CodexPage = 'book';

/** `claim`: the next tier of an achievement track, from the button tapped. */
export function buildCodex(m: MetaSave, a: CodexArea, claim: (id: TrackId, at: Container) => void): Container {
  const root = new Container();
  const page = new Container();
  const bar = new Container();
  root.addChild(page, bar);
  // portrait: the boards move down to make room for the switch; landscape: it sits in the top
  // bar's row, between its buttons and the crystals
  const top = a.wide ? a.y + 50 : a.y + 136;
  const show = (): void => {
    for (const c of [...page.removeChildren(), ...bar.removeChildren()]) c.destroy({ children: true });
    if (codexPage === 'book') bookPage(page, m, a, top);
    else featsBoard(page, m, a, top, claim);
    // rebuilt after the tap, which is still running on the tab about to go
    bar.addChild(pageSwitch(m, a, () => queueMicrotask(show)));
  };
  show();
  return root;
}

/** The two page tabs, the one shown lit; a dot on the achievements while a tier waits. */
function pageSwitch(m: MetaSave, a: CodexArea, turned: () => void): Container {
  const c = new Container();
  c.position.set(a.x + a.w / 2, a.wide ? 70 : a.y + 58);
  const tw = 250;
  const th = 64;
  (['book', 'feats'] as const).forEach((id, i) => {
    const on = codexPage === id;
    const tab = new Container();
    tab.x = (i - 0.5) * (tw + 8);
    tab.addChild(
      new Graphics()
        .roundRect(-tw / 2, -th / 2 + 6, tw, th, th / 2)
        .fill({ color: P.line, alpha: 0.35 })
        .roundRect(-tw / 2, -th / 2, tw, th, th / 2)
        .fill(on ? P.brass : LIGHT.face)
        .stroke({ width: 5, color: on ? P.line : LIGHT.edge }),
      fit(on ? label(t(`codex.page.${id}`), 32, { fill: P.cream, stroke: { color: P.line, width: 6 } }) : ink(t(`codex.page.${id}`), 32, { fill: P.inkSoft }), tw - 50),
    );
    if (id === 'feats' && achievementsClaimable(m)) redDot(tab, tw / 2 - 16, -th / 2 + 6);
    if (!on)
      tappable(tab, () => {
        codexPage = id;
        turned();
      });
    c.addChild(tab);
  });
  return c;
}

/** The potions and the clockwork army. */
function bookPage(root: Container, m: MetaSave, a: CodexArea, top: number): void {
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
    const hh = 770;
    const mh = bottom - top - hh - 30;
    root.addChild(heroBoard(m, pw, hh), monsterBoard(m.stage, pw, mh, false));
    root.children[0].position.set(a.x + a.w / 2, top + hh / 2);
    root.children[1].position.set(a.x + a.w / 2, bottom - mh / 2);
  }
}

function board(title: string, w: number, h: number): Container {
  const c = new Container();
  const p = plate(title, 40, 300);
  p.y = -h / 2 + 4;
  c.addChild(lightPanel(w, h), p);
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
  r.addChild(lightTile(rw, rh, 22));
  const sw = Math.min(240, rw * 0.27);
  const sx = -rw / 2 + 10 + sw / 2;
  r.addChild(new Graphics().roundRect(-rw / 2 + 10, -rh / 2 + 10, sw, rh - 30, 16).fill(open ? HERO_COLORS[kind] : GREY).stroke({ width: 4, color: LIGHT.edge }));
  const name = fit(label(t(`hero.${kind}`), Math.min(36, rh * 0.32), { stroke: { color: P.line, width: 7 } }), sw - 24);
  name.position.set(sx, -rh / 2 + 10 + (rh - 30) * 0.3);
  const at = unlockStage(kind);
  const sub = fit(label(open ? `Lv ${m.heroes[kind]}` : at ? t('unlockAt', { n: at }) : t('codex.locked'), Math.min(28, rh * 0.25), { fill: P.cream, stroke: { color: P.line, width: 6 } }), sw - 24);
  sub.position.set(sx, -rh / 2 + 10 + (rh - 30) * 0.76);
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

/** The army in two pages: the four of the first stages, then the ones that join later. */
const PAGES: EnemyKind[][] = [
  ['grunt', 'runner', 'brute', 'boss'],
  ['flyer', 'winder'],
];
/** The page shown, kept while the tab is rebuilt. */
let monsterPage = 0;

/** The first page as four cards side by side on a portrait page, four rows on a landscape one;
 *  the later kinds as rows, with room for what each does. Arrows by the title turn the page.
 *  The numbers are for the stage picked on the battle tab. */
function monsterBoard(stage: number, w: number, h: number, rows: boolean): Container {
  const c = board(t('codex.monsters'), w, h);
  const note = ink(t('codex.stage', { n: stage }), 26, { fill: P.inkSoft });
  note.anchor.set(1, 0.5);
  note.position.set(w / 2 - 34, -h / 2 + 58);
  // between the title plate's ribbon and the board's edge
  fit(note, w / 2 - 34 - (c.children[1] as Container).width / 2 - 6);
  const page = new Container();
  c.addChild(note, page);
  const inner = h - HEAD - FOOT;
  const arrow = (dir: number, on: boolean): Container => {
    const a = new Container();
    a.addChild(
      new Graphics()
        .circle(0, 0, 24)
        .fill(on ? P.brass : P.paperDark)
        .stroke({ width: 4, color: P.line })
        .poly([dir * 10, 0, -dir * 7, -11, -dir * 7, 11])
        .fill(on ? P.cream : P.inkSoft),
    );
    if (on)
      tappable(a, () => {
        monsterPage += dir;
        // rebuilt after the tap, which is still running on the arrow about to go
        queueMicrotask(show);
      });
    return a;
  };
  const show = (): void => {
    page.removeChildren().forEach((p) => p.destroy({ children: true }));
    PAGES[monsterPage].forEach((kind, i) => {
      let card: Container;
      if (monsterPage > 0) {
        const ch = Math.min(rows ? 330 : 300, (inner - GAP) / 2);
        card = monsterRow(kind, stage, w - 60, ch, true);
        card.y = -h / 2 + HEAD + ch / 2 + i * (ch + GAP);
      } else if (rows) {
        const ch = (inner - GAP * 3) / 4;
        card = monsterRow(kind, stage, w - 60, ch);
        card.y = -h / 2 + HEAD + ch / 2 + i * (ch + GAP);
      } else {
        const cw = (w - 50 - GAP * 3) / 4;
        card = monsterCard(kind, stage, cw, inner);
        card.position.set(-w / 2 + 25 + cw / 2 + i * (cw + GAP), -h / 2 + HEAD + inner / 2);
      }
      page.addChild(card);
    });
    const back = arrow(-1, monsterPage > 0);
    const count = ink(`${monsterPage + 1}/${PAGES.length}`, 26, { fill: P.inkSoft });
    const next = arrow(1, monsterPage < PAGES.length - 1);
    back.position.set(-w / 2 + 54, -h / 2 + 58);
    count.position.set(-w / 2 + 114, -h / 2 + 58);
    next.position.set(-w / 2 + 174, -h / 2 + 58);
    // a dot while the picked stage sends a kind from the next page
    if (monsterPage === 0 && PAGES[1].some((k) => stage >= FIRST_STAGE[k])) redDot(next, 22, -22);
    page.addChild(back, count, next);
  };
  show();
  return c;
}

/** A tall card: art, name, the numbers, then the resistances two by two. */
function monsterCard(kind: EnemyKind, stage: number, cw: number, ch: number): Container {
  const c = new Container();
  c.addChild(lightTile(cw, ch, 22));
  const top = -ch / 2;
  const artH = ch - 412;
  c.addChild(art(kind, stage, cw - 30, artH, 0, top + 16 + artH / 2));
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

/** A wide row: art, then name and numbers, then the resistances three by two; with `trait`,
 *  what the enemy does along the bottom. */
function monsterRow(kind: EnemyKind, stage: number, rw: number, rh: number, trait = false): Container {
  const c = new Container();
  c.addChild(lightTile(rw, rh, 22));
  const artW = Math.min(170, rw * 0.24);
  c.addChild(art(kind, stage, artW, rh - 30, -rw / 2 + 14 + artW / 2, -4));
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
  row.position.set(cx, trait ? 0 : 24);
  c.addChild(head, row);
  if (trait) {
    const l = fit(ink(t(`codex.trait.${kind as 'flyer' | 'winder'}`), 26, { fill: P.ink }), rw / 2 - 14 - tx);
    l.anchor.set(0, 0.5);
    l.position.set(tx, rh / 2 - 34);
    c.addChild(l);
  }
  return c;
}

/** The enemy's art fitted into a box centred on (x, y), the boss tagged, a kind the picked
 *  `stage` does not send yet darkened. */
function art(kind: EnemyKind, stage: number, bw: number, bh: number, x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  const sprite = enemySprite(kind, bw, bh);
  c.addChild(new Graphics().ellipse(0, bh * 0.4, bw * 0.34, bh * 0.07).fill({ color: 0x000000, alpha: 0.2 }), sprite);
  if (kind === 'boss') {
    const tag = bossTag(22);
    tag.position.set(bw / 2 - 46, -bh / 2 + 18);
    c.addChild(tag);
  }
  if (stage < FIRST_STAGE[kind]) {
    // not on the picked stage yet: a dark shape, and the stage it first comes on
    for (const s of sprite.children) if (s instanceof Sprite) s.tint = 0x4a4038;
    const tag = fit(label(t('codex.from', { n: FIRST_STAGE[kind] }), 24, { fill: P.cream, stroke: { color: INK, width: 6 } }), bw);
    tag.y = bh * 0.3;
    c.addChild(tag);
  }
  return c;
}

/** Hit points on the first wave it comes in on this stage, speed and how hard it hits the wall.
 *  A kind the picked stage does not send yet is quoted at the stage it first comes on, and says so. */
function statLines(kind: EnemyKind, stage: number): string[] {
  const at = codexStage(kind, stage);
  const e = enemyStats(kind, at);
  const hp = Math.round(e.hp);
  return [
    at === stage ? t('codex.hpWave', { n: hp, w: e.wave }) : t('codex.hpStageWave', { n: hp, s: at, w: e.wave }),
    t('codex.speed', { n: e.speed }),
    t('codex.wallDps', { n: e.wallDps }),
  ];
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
    const text = ink(resistLabel(v), 20, { fill: color });
    text.anchor.set(0, 0.5);
    text.position.set(-cw / 2 + 41, 0);
    fit(text, cw - 41 - 14); // clear of the pill's round end
    chip.addChild(b, text);
    c.addChild(chip);
  });
  return c;
}

// ---- achievements ----

/** Every track on one board: a column of rows on a portrait page, two on a landscape one. */
function featsBoard(root: Container, m: MetaSave, a: CodexArea, top: number, claim: (id: TrackId, at: Container) => void): void {
  const bottom = a.y + a.h - 24;
  const w = a.wide ? a.w - 80 : Math.min(1000, a.w - 60);
  const h = bottom - top;
  const c = board(t('ach.title'), w, h);
  c.position.set(a.x + a.w / 2, top + h / 2);
  const tiers = TRACK_IDS.reduce((n, id) => n + TRACKS[id].length, 0);
  const got = TRACK_IDS.reduce((n, id) => n + m.achievements.claimed[id], 0);
  const note = ink(t('ach.count', { n: got, total: tiers }), 26, { fill: P.inkSoft });
  note.anchor.set(1, 0.5);
  note.position.set(w / 2 - 34, -h / 2 + 58);
  fit(note, w / 2 - 34 - (c.children[1] as Container).width / 2 - 6);
  c.addChild(note);
  const cols = a.wide ? 2 : 1;
  const per = Math.ceil(TRACK_IDS.length / cols);
  const rw = (w - 60 - (cols - 1) * 30) / cols;
  const rh = Math.min(150, (h - HEAD - FOOT - GAP * (per - 1)) / per);
  TRACK_IDS.forEach((id, i) => {
    const col = Math.floor(i / per);
    const r = featRow(m, id, rw, rh, claim);
    r.position.set(-w / 2 + 30 + rw / 2 + col * (rw + 30), -h / 2 + HEAD + rh / 2 + (i % per) * (rh + GAP));
    c.addChild(r);
  });
  root.addChild(c);
}

/** A track: its icon over a pip per tier, its name and next goal, how far along, and the button
 *  that claims the tier (or a word once every tier is claimed). */
function featRow(m: MetaSave, id: TrackId, rw: number, rh: number, claim: (id: TrackId, at: Container) => void): Container {
  const r = new Container();
  const tiers = TRACKS[id];
  const next = nextTier(m, id);
  const ready = trackReady(m, id);
  r.addChild(lightTile(rw, rh, 22));
  if (ready) r.addChild(new Graphics().roundRect(-rw / 2 - 3, -rh / 2 - 3, rw + 6, rh + 6, 25).stroke({ width: 6, color: P.brass }));
  const ix = -rw / 2 + 18 + rh * 0.36;
  const icon = new Container();
  icon.position.set(ix, -10);
  icon.addChild(new Graphics().circle(0, 0, rh * 0.32).fill(next === null ? COLORS.gold : LIGHT.inset).stroke({ width: 4, color: LIGHT.edge }), trackIcon(id, rh * 0.42));
  r.addChild(icon);
  const pips = new Graphics();
  tiers.forEach((_, i) => {
    pips.circle(ix + (i - (tiers.length - 1) / 2) * 17, rh / 2 - 14, 6).fill(i < m.achievements.claimed[id] ? P.brass : LIGHT.inset).stroke({ width: 2, color: LIGHT.edge });
  });
  r.addChild(pips);

  const bw = Math.min(200, rw * 0.24);
  const bx = rw / 2 - 16 - bw / 2;
  const barW = Math.min(220, rw * 0.24);
  const barX = bx - bw / 2 - 20 - barW;
  const tx = ix + rh * 0.36 + 18;
  const room = barX - 16 - tx;
  const tier = next ?? tiers.length - 1;
  const goal = tiers[tier].goal;
  const name = fit(ink(t(`ach.${id}.name`), Math.min(34, rh * 0.3)), room);
  name.anchor.set(0, 0.5);
  name.position.set(tx, -rh * 0.18);
  const desc = fit(ink(featDesc(id, tier, goal), Math.min(26, rh * 0.22), { fill: P.inkSoft }), room);
  desc.anchor.set(0, 0.5);
  desc.position.set(tx, rh * 0.2);
  r.addChild(name, desc);

  const have = Math.min(goal, trackProgress(m, id, tier));
  const frac = next === null ? 1 : have / goal;
  const bh = 34;
  const bar = new Graphics().roundRect(barX, -bh / 2, barW, bh, bh / 2).fill(LIGHT.inset);
  if (frac > 0) bar.roundRect(barX, -bh / 2, Math.max(bh, barW * frac), bh, bh / 2).fill(0x5cc66a);
  r.addChild(bar.roundRect(barX, -bh / 2, barW, bh, bh / 2).stroke({ width: 4, color: P.line }));
  const count = fit(label(next === null ? t('ach.done') : `${have}/${goal}`, 24, { stroke: { color: P.line, width: 6 } }), barW - 20);
  count.position.set(barX + barW / 2, 0);
  r.addChild(count);

  if (next === null) {
    r.alpha = 0.8;
  } else {
    const b: PillButton = new PillButton(String(tiers[next].reward), bw, Math.min(84, rh - 30), 'green', () => claim(id, b), 36, true).setEnabled(ready);
    b.position.set(bx, 0);
    r.addChild(b);
  }
  return r;
}

/** The goal of a track's tier in words. */
function featDesc(id: TrackId, tier: number, goal: number): string {
  if (id === 'enemies') return tier === 0 ? t('ach.enemies.boss') : t('ach.enemies.all', { n: goal });
  // the challenge counts reward tiers; the player knows them by their wave
  if (id === 'challenge') return t('ach.challenge.desc', { n: CHALLENGE_TIERS[goal - 1].wave });
  return t(`ach.${id}.desc`, { n: goal });
}

/** A track's picture, about `size` across. */
function trackIcon(id: TrackId, size: number): Container {
  const c = new Container();
  const add = (g: Container, across = 100) => {
    g.scale.set(size / across);
    c.addChild(g);
  };
  switch (id) {
    case 'stages':
      add(swordsIcon());
      break;
    case 'level':
      add(flask(new Graphics(), 0, 45, 90, HERO_COLORS.fire, true), 90);
      break;
    case 'ultimates':
      add(bottle('fire', 100));
      break;
    case 'unlock':
      add(bottle('wind', 100));
      break;
    case 'enemies':
      c.addChild(enemySprite('boss', size * 1.15, size * 1.15));
      break;
    case 'merges':
      add(flask(new Graphics(), 0, 45, 90, HERO_COLORS.arcane, true), 90);
      break;
    case 'kills':
      c.addChild(enemySprite('grunt', size * 1.15, size * 1.15));
      break;
    case 'battles':
      add(wallIcon());
      break;
    case 'challenge':
      add(stopwatchIcon());
      break;
    case 'endless':
      add(infinityIcon());
      break;
    case 'login':
      add(calendarIcon());
      break;
    case 'workshop':
      add(gearIcon());
      break;
  }
  return c;
}
