// The codex tab, in three pages tabs at the top turn between, one board each. The potions: each
// with its four star forms (the ones not in the game yet greyed out and locked) under one row of
// stars. The clockwork army: a card per enemy with its art, what it is in a word and the one
// element it fears and the one it shrugs off most; a tap opens its panel with the numbers and
// the whole damage table. And the achievements: each track's next tier, how far along it is and
// its claim button.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../i18n';
import { achievementsClaimable, nextTier, TRACK_IDS, TRACKS, trackProgress, trackReady, type TrackId } from '../sim/achievements';
import { CHALLENGE_TIERS } from '../sim/challenge';
import { enemyStats, extremes, resistLabel, resists } from '../sim/enemies';
import { heroUnlocked, unlockStage, type MetaSave } from '../sim/meta';
import { BALANCE, BOSS_KINDS, ENEMY_KINDS, HERO_KINDS, isBoss, type EnemyKind, type HeroKind } from '../sim/types';
import { endlessBossesMet, FIRST_STAGE } from '../sim/waves';
import { potionLook } from './art';
import {
  bossTag, bottle, calendarIcon, enemySprite, fit, flask, gearIcon, ink, inkWrapped, LIGHT, lightPanel, lightTile, lock, P, PillButton, plate, redDot,
  stopwatchIcon, infinityIcon, swordsIcon, tappable, wallIcon,
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

export const CODEX_PAGES = ['potions', 'enemies', 'feats'] as const;
export type CodexPage = (typeof CODEX_PAGES)[number];
/** The page shown, kept while the tab is rebuilt. */
let codexPage: CodexPage = 'potions';

/** Turns the codex to `p` for its next build (the layout test walks every page). */
export function setCodexPage(p: CodexPage): void {
  codexPage = p;
}

/** `claim`: the next tier of an achievement track, from the button tapped; `open`: an enemy's
 *  panel, from its card. */
export function buildCodex(m: MetaSave, a: CodexArea, claim: (id: TrackId, at: Container) => void, open: (kind: EnemyKind) => void): Container {
  const root = new Container();
  const page = new Container();
  const bar = new Container();
  root.addChild(page, bar);
  // portrait: the board moves down to make room for the tabs; landscape: they sit in the top
  // bar's row, between its buttons and the crystals
  const top = a.wide ? a.y + 50 : a.y + 136;
  const show = (): void => {
    for (const c of [...page.removeChildren(), ...bar.removeChildren()]) c.destroy({ children: true });
    if (codexPage === 'potions') potionsPage(page, m, a, top);
    else if (codexPage === 'enemies') enemiesPage(page, m, a, top, open);
    else featsBoard(page, m, a, top, claim);
    // rebuilt after the tap, which is still running on the tab about to go
    bar.addChild(pageTabs(m, a, () => queueMicrotask(show)));
  };
  show();
  return root;
}

/** The three page tabs, the one shown lit; a dot on the achievements while a tier waits. */
function pageTabs(m: MetaSave, a: CodexArea, turned: () => void): Container {
  const c = new Container();
  // landscape: midway between the top bar's buttons (to a.x + 450) and the crystals (from 360
  // short of the right edge, room for a seven-digit count)
  c.position.set(a.wide ? a.x + (450 + a.w - 360) / 2 : a.x + a.w / 2, a.wide ? 70 : a.y + 58);
  const tw = a.wide ? 250 : Math.min(320, (a.w - 76) / 3);
  const th = 64;
  CODEX_PAGES.forEach((id, i) => {
    const on = codexPage === id;
    const tab = new Container();
    tab.x = (i - 1) * (tw + 8);
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

function board(title: string, w: number, h: number): Container {
  const c = new Container();
  const p = plate(title, 40, 300);
  p.y = -h / 2 + 4;
  c.addChild(lightPanel(w, h), p);
  return c;
}

// ---- potions ----

/** Room the row of stars over the forms takes. */
const STARS = 52;

/** Every potion a row, as tall as the page allows up to a roomy cap; the board ends under the
 *  last one. */
function potionsPage(root: Container, m: MetaSave, a: CodexArea, top: number): void {
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

// ---- the clockwork army ----

/** The army in the order of the cards: the rank and file as they join, then the bosses (the
 *  second row of a landscape page). */
const ARMY: readonly EnemyKind[] = ['grunt', 'runner', 'brute', 'flyer', 'winder', ...BOSS_KINDS];
/** The kinds with a line on what they do, in their panel. */
type TraitKind = Exclude<EnemyKind, 'grunt' | 'runner' | 'brute' | 'boss'>;
const TRAITS: readonly EnemyKind[] = ['flyer', 'winder', 'clock', 'tripod', 'anvil', 'gear'] satisfies TraitKind[];
/** The bosses the best endless run has met: shown in full, whatever stage is picked. */
let met: readonly EnemyKind[] = [];

/** A home panel that is an enemy's. */
export function isEnemy(p: string | null): p is EnemyKind {
  return (ENEMY_KINDS as readonly (string | null)[]).includes(p);
}

/** What the enemy is in a word; every boss just says so. */
function tag(kind: EnemyKind): string {
  return isBoss(kind) ? t('codex.tag.boss') : t(`codex.tag.${kind as 'grunt' | 'runner' | 'brute' | 'flyer' | 'winder'}`);
}

/** Every kind as a card, two to a row on a portrait page, five on a landscape one. */
function enemiesPage(root: Container, m: MetaSave, a: CodexArea, top: number, open: (kind: EnemyKind) => void): void {
  met = endlessBossesMet(m.endless.best);
  const w = a.wide ? a.w - 80 : Math.min(1000, a.w - 60);
  const h = a.y + a.h - 24 - top;
  const c = board(t('codex.monsters'), w, h);
  c.position.set(a.x + a.w / 2, top + h / 2);
  const cols = a.wide ? 5 : 2;
  const rows = Math.ceil(ARMY.length / cols);
  const gap = 18;
  const cw = (w - 80 - gap * (cols - 1)) / cols;
  const ch = Math.min(a.wide ? 420 : 360, (h - HEAD - FOOT - gap * (rows - 1)) / rows);
  ARMY.forEach((kind, i) => {
    const card = tappable(enemyCard(kind, m.stage, cw, ch), () => open(kind));
    card.position.set(-w / 2 + 40 + cw / 2 + (i % cols) * (cw + gap), -h / 2 + HEAD + ch / 2 + Math.floor(i / cols) * (ch + gap));
    c.addChild(card);
  });
  root.addChild(c);
}

/** The art with the element it fears most (+) and the one it shrugs off most (−) in its top
 *  corners, then the name and what it is in a word; a boss ringed red. */
function enemyCard(kind: EnemyKind, stage: number, cw: number, ch: number): Container {
  const c = new Container();
  c.addChild(lightTile(cw, ch, 22));
  const boss = isBoss(kind);
  if (boss) c.addChild(new Graphics().roundRect(-cw / 2 - 3, -ch / 2 - 3, cw + 6, ch + 6, 25).stroke({ width: 6, color: STRONG }));
  const artH = ch - 112;
  c.addChild(art(kind, stage, cw - 40, artH, 0, -ch / 2 + 12 + artH / 2, false));
  const name = fit(ink(t(`enemy.${kind}`), 34), cw - 28);
  name.y = ch / 2 - 74;
  const what = fit(boss ? label(tag(kind), 28, { fill: P.cream, stroke: { color: STRONG, width: 6 } }) : ink(tag(kind), 28, { fill: P.inkSoft }), cw - 28);
  what.y = ch / 2 - 32;
  c.addChild(name, what);
  const { weak, strong } = extremes(kind);
  const r = Math.min(34, cw * 0.08);
  if (weak) c.addChild(element(weak, true, r, -cw / 2 + 14 + r, -ch / 2 + 14 + r));
  if (strong) c.addChild(element(strong, false, r, cw / 2 - 18 - r, -ch / 2 + 14 + r));
  return c;
}

/** An element's potion in a disc of its colour, badged + (it hurts more) or − (less). */
function element(el: HeroKind, weak: boolean, r: number, x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  const b = bottle(el, r * 1.5);
  const badge = new Container();
  badge.position.set(r * 0.75, r * 0.75);
  const bar = r * 0.6;
  const sign = new Graphics().roundRect(-bar / 2, -bar / 8, bar, bar / 4, bar / 8);
  if (weak) sign.roundRect(-bar / 8, -bar / 2, bar / 4, bar, bar / 8);
  badge.addChild(new Graphics().circle(0, 0, r * 0.55).fill(weak ? WEAK : STRONG).stroke({ width: 3, color: P.line }), sign.fill(P.cream));
  c.addChild(new Graphics().circle(0, 0, r).fill(HERO_COLORS[el]).stroke({ width: 4, color: P.line }), b, badge);
  return c;
}

/** One enemy over the page: the big art, what it is, its numbers on the picked stage, what it
 *  does, and every element's damage. `frame` is the home's panel frame. */
export function enemyPanel(m: MetaSave, kind: EnemyKind, frame: (title: string, h: number) => { panel: Container; box: Container }): Container {
  met = endlessBossesMet(m.endless.best);
  const stage = m.stage;
  const long = TRAITS.includes(kind) ? inkWrapped(t(`codex.trait.${kind as TraitKind}`), 32, 820, { fill: P.ink, lineHeight: 42 }) : null;
  const h = 960 + (long ? long.height + 40 : 0);
  const { panel, box } = frame(t(`enemy.${kind}`), h);
  const top = -h / 2;
  box.addChild(new Graphics().roundRect(-440, top + 100, 400, 400, 30).fill({ color: P.paperDark, alpha: 0.55 }));
  box.addChild(art(kind, stage, 360, 360, -240, top + 300, true));
  const x = -10;
  const boss = isBoss(kind);
  const what = fit(boss ? label(tag(kind), 40, { fill: P.cream, stroke: { color: STRONG, width: 7 } }) : ink(tag(kind), 40, { fill: P.brassDark }), 440);
  what.anchor.set(0, 0.5);
  what.position.set(x, top + 150);
  box.addChild(what);
  statLines(kind, stage).forEach((s, i) => {
    const l = fit(ink(s, 36), 440);
    l.anchor.set(0, 0.5);
    l.position.set(x, top + 240 + i * 64);
    box.addChild(l);
  });
  const note = fit(ink(t('codex.stage', { n: stage }), 28, { fill: P.inkSoft }), 440);
  note.anchor.set(0, 0.5);
  note.position.set(x, top + 460);
  box.addChild(note);
  let y = top + 560;
  if (long) {
    long.anchor.set(0.5, 0);
    long.y = y;
    box.addChild(long);
    y += long.height + 40;
  }
  box.addChild(new Graphics().rect(-410, y - 10, 820, 3).fill({ color: P.inkSoft, alpha: 0.5 }));
  const head = ink(t('codex.resist'), 34, { fill: P.inkSoft });
  head.y = y + 40;
  const table = chips(kind, 3);
  table.scale.set(2);
  table.y = y + 200;
  box.addChild(head, table);
  return panel;
}

/** The enemy's art fitted into a box centred on (x, y), a boss tagged when `tagged`, a kind the
 *  picked `stage` does not send yet darkened. */
function art(kind: EnemyKind, stage: number, bw: number, bh: number, x: number, y: number, tagged: boolean): Container {
  const c = new Container();
  c.position.set(x, y);
  const sprite = enemySprite(kind, bw, bh);
  c.addChild(new Graphics().ellipse(0, bh * 0.4, bw * 0.34, bh * 0.07).fill({ color: 0x000000, alpha: 0.2 }), sprite);
  if (tagged && isBoss(kind)) {
    const tag = bossTag(26);
    tag.position.set(bw / 2 - 54, -bh / 2 + 20);
    c.addChild(tag);
  }
  if (stage < FIRST_STAGE[kind] && !met.includes(kind)) {
    // not on the picked stage yet, nor met in endless mode: a dark shape, and the stage it first comes on
    for (const s of sprite.children) if (s instanceof Sprite) s.tint = 0x4a4038;
    const tag = fit(label(t('codex.from', { n: FIRST_STAGE[kind] }), Math.min(30, bh * 0.16), { fill: P.cream, stroke: { color: INK, width: 6 } }), bw);
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
