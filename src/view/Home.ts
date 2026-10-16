// The home screen between battles, in the alchemist's-workshop look: a top bar with the daily
// login, the daily tasks and the crystals, five tabs (potions, workshop, battle, codex, shop;
// the codex is built in Codex.ts)
// and the daily login reward, the daily tasks and a hero's milestones as panels over it.
// Laid out on the whole screen: a portrait page with the tabs along the bottom, or on a wide
// (desktop) screen a landscape page with the tabs down the left side. Built afresh after every
// purchase, claim or resize.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../i18n';
import {
  bestToday, canPlayAd, canPlayFree, CHALLENGE_TIERS, challengeFresh, msToTomorrow, streak, tierOf, todaysChallenge,
} from '../sim/challenge';
import { canClaimLogin, loginDay, loginReward, taskDone, taskGoal, taskReward, tasksClaimable } from '../sim/daily';
import { BALANCE, ENEMY_KINDS, HERO_KINDS } from '../sim/types';
import { baseSkills, MILESTONES, skillHeroes } from '../sim/skills';
import { onStage } from '../sim/waves';
import {
  AD_CRYSTALS, adsLeft, ADS_PER_DAY, benched, CHEST_CRYSTALS, chestReady, heroCost, heroDamage, heroUnlocked, maxStage, stageHp, unlockPrice, unlockStage,
  WORKSHOP_IDS, workshopCost, workshopValue, type MetaSave, type WorkshopId,
} from '../sim/meta';
import type { HeroKind } from '../sim/types';
import { commanderTexture } from './art';
import { buildCodex } from './Codex';
import {
  bookIcon,
  bossTag,
  bottle,
  coinsIcon,
  fit as fitText,
  flask,
  calendarIcon,
  chestIcon,
  enemySprite,
  gearIcon,
  ink,
  inkWrapped,
  LIGHT,
  lightPanel,
  lightTile,
  lock,
  medal,
  modifierIcon,
  P,
  paperCard,
  PillButton,
  plate,
  redDot,
  scrollIcon,
  swordsIcon,
  tappable,
  workshopWall,
  wallIcon,
} from './kit';
import { gem, HERO_COLORS, label } from './ui';
import type { MenuFit } from './viewport';

export type HomeTab = 'potions' | 'workshop' | 'battle' | 'codex' | 'shop';
export const HOME_TABS: readonly HomeTab[] = ['potions', 'workshop', 'battle', 'codex', 'shop'];
export type HomePanel = 'login' | 'tasks' | HeroKind | null;

export interface HomeActions {
  tab(tab: HomeTab): void;
  panel(p: HomePanel): void;
  claimLogin(): void;
  claimTask(index: number): void;
  stage(delta: number): void;
  hero(kind: HeroKind): void;
  /** A potion on the battle tab's lineup row was tapped. */
  lineup(kind: HeroKind): void;
  workshop(id: WorkshopId): void;
  claimChest(): void;
  /** The shop's rewarded ad for crystals. */
  watchAd(): void;
  /** Buys a locked potion early. */
  unlock(kind: HeroKind): void;
  play(): void;
  /** Today's challenge: the free attempt, and the one a rewarded ad buys. */
  challenge(): void;
  challengeAd(): void;
}

/** The part of the page a tab fills. */
interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
  wide: boolean;
}

/** Bottom bar height on a portrait page, side rail width on a landscape one, top bar height. */
const NAV = 210;
const RAIL = 230;
const TOP = 150;

/** `picked`: a reserve potion tapped on the lineup row, waiting for the one it replaces; `ads`:
 *  a rewarded ad can be offered. */
export function buildHome(
  m: MetaSave,
  act: HomeActions,
  tab: HomeTab,
  panel: HomePanel,
  today: string,
  fit: MenuFit,
  picked: HeroKind | null = null,
  ads = false,
): Container {
  const root = new Container();
  const { w, h, wide } = fit;
  root.addChild(workshopWall(w, h));
  const left = wide ? RAIL : 0;
  const top = wide ? TOP - 20 : TOP;
  const area: Area = { x: left, y: top, w: w - left, h: (wide ? h : h - NAV) - top, wide };
  if (tab === 'battle') battleTab(root, m, act, area, picked, today, ads);
  else if (tab === 'potions') potionsTab(root, m, act, area);
  else if (tab === 'workshop') workshopTab(root, m, act, area);
  else if (tab === 'codex') root.addChild(buildCodex(m, area));
  else shopTab(root, m, act, area, today, ads);
  topBar(root, m, act, today, left, w, wide);
  nav(root, act, tab, fit, { shop: chestReady(m, today), battle: challengeFresh(m, today) });
  if (panel === 'login') root.addChild(loginPanel(m, act, today, fit));
  else if (panel === 'tasks') root.addChild(tasksPanel(m, act, fit));
  else if (panel) root.addChild(heroPanel(m, act, panel, fit));
  return root;
}

function topBar(root: Container, m: MetaSave, act: HomeActions, today: string, left: number, w: number, wide: boolean): void {
  const y = wide ? 70 : 80;
  const button = (x: number, icon: Container, text: string, dot: boolean, onTap: () => void) => {
    const c = tappable(new Container(), onTap);
    c.position.set(x, y);
    icon.scale.set(0.72);
    // the caption sits on its own cream plate below the medal, clear of the brass rim
    const cap = fitText(ink(text, 24), 112);
    const plate = new Graphics()
      .roundRect(-cap.width / 2 - 12, -17, cap.width + 24, 34, 17)
      .fill(LIGHT.face)
      .stroke({ width: 3, color: LIGHT.edge });
    plate.y = cap.y = 74;
    c.addChild(medal(56), icon, plate, cap);
    if (dot) redDot(c, 42, -42);
    root.addChild(c);
  };
  button(left + 90, calendarIcon(), t('login'), canClaimLogin(m, today), () => act.panel('login'));
  button(left + 240, scrollIcon(), t('tasks'), tasksClaimable(m), () => act.panel('tasks'));

  // the crystals in a dark inset, top right
  const count = ink(String(m.crystals), 50, { fill: LIGHT.crystal });
  const pw = Math.max(240, count.width + 120);
  const purse = new Container();
  purse.position.set(w - 40 - pw / 2, y);
  purse.addChild(
    new Graphics().roundRect(-pw / 2, -40, pw, 80, 40).fill(LIGHT.inset).stroke({ width: 4, color: LIGHT.edge }),
    gem(new Graphics(), -pw / 2 + 40, 0, 34),
  );
  count.x = 22;
  purse.addChild(count);
  root.addChild(purse);
}

/** The five tabs: along the bottom of a portrait page, down the left of a landscape one; the
 *  battle tab in the middle is a big raised medallion. */
function nav(root: Container, act: HomeActions, tab: HomeTab, fit: MenuFit, dots: Partial<Record<HomeTab, boolean>>): void {
  const { w, h, wide } = fit;
  const bar = new Graphics();
  if (wide) {
    bar.rect(0, 0, RAIL, h).fill(LIGHT.bar).rect(RAIL - 14, 0, 14, h).fill(P.brass).rect(RAIL - 14, 0, 4, h).fill(P.brassLight);
    bar.rect(RAIL, 0, 4, h).fill(LIGHT.edge);
  } else {
    bar.rect(0, h - NAV, w, NAV).fill(LIGHT.bar).rect(0, h - NAV, w, 14).fill(P.brass).rect(0, h - NAV + 2, w, 4).fill(P.brassLight);
    bar.rect(0, h - NAV - 4, w, 4).fill(LIGHT.edge);
  }
  root.addChild(bar);
  HOME_TABS.forEach((id, i) => {
    const slot = tappable(new Container(), () => act.tab(id));
    const span = wide ? h / HOME_TABS.length : w / HOME_TABS.length;
    if (wide) slot.position.set(RAIL / 2 - 6, span * (i + 0.5));
    else slot.position.set(span * (i + 0.5), h - NAV / 2 + 8);
    const on = id === tab;
    const big = id === 'battle';
    if (on && !big) {
      slot.addChild(
        new Graphics()
          .roundRect(-span / 2 + 14, -NAV / 2 + 18, span - 28, NAV - 40, 26)
          .fill({ color: P.brass, alpha: 0.25 })
          .stroke({ width: 4, color: P.brass, alpha: 0.8 }),
      );
    }
    const icon = navIcon(id);
    if (big) {
      // clear of its caption below, and in portrait of the challenge card above
      const lift = wide ? -12 : -26;
      const md = medal(92, on ? 0x3c9a4a : P.wood);
      md.y = lift - 14;
      icon.y = lift - 14;
      icon.scale.set(0.95);
      slot.addChild(md);
    } else {
      icon.y = -22;
      icon.scale.set(on ? 0.95 : 0.8);
    }
    const cap = ink(t(`tabs.${id}`), 34, { fill: on ? P.brassDark : P.ink });
    cap.y = big ? (wide ? 108 : 74) : 58;
    slot.addChild(icon, cap);
    if (dots[id]) redDot(slot, big ? 70 : 46, big ? (wide ? -96 : -110) : -62);
    if (!on) slot.alpha = big ? 1 : 0.85;
    root.addChild(slot);
  });
}

function navIcon(id: HomeTab): Container {
  if (id === 'potions') return bottle('fire', 110);
  if (id === 'workshop') return gearIcon();
  if (id === 'battle') return swordsIcon();
  if (id === 'codex') return bookIcon();
  return chestIcon();
}

// ---- tabs ----

/** The stage to fight, the enemies on it, the lineup and the button into battle. */
function battleTab(root: Container, m: MetaSave, act: HomeActions, a: Area, picked: HeroKind | null, today: string, ads: boolean): void {
  const stageAt = (x: number, y: number, ax = 340) => {
    const p = plate(t('stage', { n: m.stage }), 64, 420);
    p.position.set(x, y);
    const arrow = (dx: number, text: string, on: boolean, d: number) => {
      const c = tappable(new Container(), () => on && act.stage(d));
      c.position.set(x + dx, y);
      const sign = label(text, 46, { fill: on ? P.cream : P.inkSoft, stroke: { color: P.line, width: 6 } });
      c.addChild(medal(52), sign);
      if (!on) c.alpha = 0.6;
      root.addChild(c);
    };
    root.addChild(p);
    arrow(-ax, '◀', m.stage > 1, -1);
    arrow(ax, '▶', m.stage < maxStage(m), 1);
    const hp = ink(t('stageHp', { n: stageHp(m.stage).toFixed(2) }), 38);
    hp.position.set(x, y + 100);
    root.addChild(hp);
  };
  const start = (x: number, y: number, h: number) => {
    const b = new PillButton(t('start'), 620, h, 'green', act.play, 72);
    b.position.set(x, y);
    root.addChild(b);
  };
  const pw = Math.min(960, a.w - 80);
  if (a.wide) {
    // panels down the right, the stage, commander and button centred in what is left
    const rw = Math.min(820, a.w * 0.5);
    const rx = a.x + a.w - 40 - rw / 2;
    const lx = a.x + (a.w - rw - 40) / 2;
    stageAt(lx, a.y + 100, 300);
    const tex = commanderTexture();
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5, 1);
      s.scale.set(Math.min(400, a.h - 690) / tex.height);
      s.position.set(lx, a.y + a.h - 450);
      root.addChild(new Graphics().ellipse(lx, a.y + a.h - 455, 150, 30).fill({ color: 0x000000, alpha: 0.2 }), s);
    }
    start(lx, a.y + a.h - 360, 140);
    challengeBanner(root, m, act, today, ads, lx, a.y + a.h - 126, Math.min(960, a.w - rw - 70));
    enemiesPanel(root, m.stage, rx, a.y + 235, rw);
    lineupPanel(root, m, act, picked, rx, a.y + 700, rw);
  } else {
    stageAt(a.x + a.w / 2, a.y + 80);
    // the panels share the room between the stage and the button, the challenge under it
    const eh = 310;
    const gap = Math.max(20, (a.h - 660 - eh - LINEUP_H) / 3);
    enemiesPanel(root, m.stage, a.x + a.w / 2, a.y + 210 + gap + eh / 2, pw, eh);
    lineupPanel(root, m, act, picked, a.x + a.w / 2, a.y + 210 + 2 * gap + eh + LINEUP_H / 2, pw);
    start(a.x + a.w / 2, a.y + a.h - 383, 150);
    challengeBanner(root, m, act, today, ads, a.x + a.w / 2, a.y + a.h - 34 - BANNER_H / 2, pw);
  }
}

function titledPanel(root: Container, title: string, x: number, y: number, w: number, h: number): Container {
  const c = new Container();
  c.position.set(x, y);
  const p = plate(title, 40, 280);
  p.y = -h / 2 + 4;
  c.addChild(lightPanel(w, h), p);
  root.addChild(c);
  return c;
}

/** The clockwork army this stage sends, the boss marked. */
function enemiesPanel(root: Container, stage: number, x: number, y: number, w: number, h = 380): void {
  const c = titledPanel(root, t('enemies'), x, y, w, h);
  const kinds = ENEMY_KINDS.filter((k) => onStage(k, stage));
  const step = Math.min(210, (w - 80) / kinds.length);
  const th = h - 160;
  kinds.forEach((kind, i) => {
    const tile = new Container();
    tile.position.set((i - (kinds.length - 1) / 2) * step, 30);
    tile.addChild(lightTile(step - 20, th, 22));
    const s = enemySprite(kind, Math.min(170, step - 30, th - 50));
    s.y = -4;
    tile.addChild(s);
    if (kind === 'boss') {
      const tag = bossTag(28);
      tag.y = th / 2 - 14;
      tile.addChild(tag);
    }
    c.addChild(tile);
  });
}

const LINEUP_H = 430;
const BANNER_H = 220;

/** Today's challenge under the start button: its stage, the two modifiers, the reward tiers
 *  (those reached today ticked) and the way in: the free attempt, then the rewarded retry, then
 *  the best wave and the time until the next one. */
function challengeBanner(root: Container, m: MetaSave, act: HomeActions, today: string, ads: boolean, x: number, y: number, w: number): void {
  const ch = todaysChallenge(m, today);
  const free = canPlayFree(m, today);
  const c = free ? tappable(new Container(), act.challenge) : new Container();
  c.position.set(x, y);
  root.addChild(c);
  c.addChild(lightPanel(w, BANNER_H));
  const head = plate(`${t('challenge.title')} · ${t('stage', { n: ch.stage })}`, 34, 300);
  head.y = -BANNER_H / 2 + 2;
  c.addChild(head);
  const cy = 12;
  const pad = 42;
  const aw = w < 900 ? 190 : 210;
  const tw = 200;
  const mw = w - 2 * pad - aw - tw - 36;
  // the modifiers, a chip each
  ch.mods.forEach((id, i) => {
    const chip = new Container();
    chip.position.set(-w / 2 + pad + mw / 2, cy - 39 + i * 80);
    chip.addChild(lightTile(mw, 74, 18));
    const icon = modifierIcon(id, ch.trial);
    icon.scale.set(0.5);
    icon.position.set(-mw / 2 + 40, -3);
    // the name, and under it what it does: a line each, so neither has to shrink to fit
    const name = ink(t(`challenge.mod.${id}.name`), 28, { fontWeight: '900' });
    name.anchor.set(0, 0.5);
    name.position.set(-mw / 2 + 76, -17);
    fitText(name, mw - 90);
    const desc = ink(t(`challenge.mod.${id}.desc`, { hero: ch.trial ? t(`hero.${ch.trial}`) : '' }), 22, { fill: P.inkSoft });
    desc.anchor.set(0, 0.5);
    desc.position.set(-mw / 2 + 76, 16);
    fitText(desc, mw - 90);
    chip.addChild(icon, name, desc);
    c.addChild(chip);
  });
  // the reward tiers
  const best = bestToday(m, today);
  const reached = tierOf(best);
  CHALLENGE_TIERS.forEach((tier, i) => {
    const row = new Container();
    row.position.set(w / 2 - pad - aw - 18 - tw / 2, cy - 50 + i * 50);
    const on = i < reached;
    row.addChild(new Graphics().roundRect(-tw / 2, -21, tw, 42, 21).fill(on ? 0xd4eec0 : LIGHT.inset).stroke({ width: 3, color: on ? 0x3c9a4a : LIGHT.insetEdge }));
    const wave = ink(t('challenge.wave', { n: tier.wave }), 24, { fill: on ? 0x2b6a33 : P.ink });
    wave.anchor.set(0, 0.5);
    wave.position.set(-tw / 2 + 14, -1);
    const n = ink(String(tier.reward), 26, { fill: LIGHT.crystal, fontWeight: '900' });
    n.anchor.set(1, 0.5);
    n.position.set(tw / 2 - 14, -1);
    // the wave label keeps clear of the gem before the reward
    const gx = n.x - n.width - 16;
    fitText(wave, gx - 11 - 10 - wave.x);
    row.addChild(wave, n, gem(new Graphics(), gx, -2, 11));
    c.addChild(row);
  });
  // the way in, or how it went
  const ax = w / 2 - pad - aw / 2;
  const days = streak(m, today);
  if (free) {
    const go = new PillButton(t('challenge.go'), aw, 92, 'green', act.challenge, 44);
    go.position.set(ax, cy - 24);
    c.addChild(go);
    if (days > 0) {
      const s = ink(t('challenge.streak', { n: days }), 24, { fill: P.inkSoft });
      s.position.set(ax, cy + 48);
      c.addChild(fitText(s, aw));
    }
    redDot(c, ax + aw / 2 - 8, cy - 66);
    return;
  }
  const top = ink(t('challenge.best', { n: best }), 30, { fontWeight: '900' });
  top.position.set(ax, cy - 50);
  c.addChild(fitText(top, aw + 10));
  if (ads && canPlayAd(m, today)) {
    const again = new PillButton(t('challenge.retry'), aw, 84, 'purple', act.challengeAd, 30);
    const cap = again.children[1];
    cap.x = 24;
    const tv = adIcon();
    tv.scale.set(0.34);
    tv.position.set(-cap.width / 2 - 4, -6);
    again.addChild(tv);
    again.position.set(ax, cy + 26);
    c.addChild(again);
    return;
  }
  const left = ink('', 26, { fill: P.inkSoft });
  left.position.set(ax, cy + 6);
  let shown = '';
  left.onRender = () => {
    const secs = Math.ceil(msToTomorrow(new Date()) / 1000);
    const p = (v: number) => String(v).padStart(2, '0');
    const text = t('challenge.next', { time: `${p(Math.floor(secs / 3600))}:${p(Math.floor(secs / 60) % 60)}:${p(secs % 60)}` });
    if (text !== shown) {
      left.text = shown = text;
      left.scale.set(1);
      fitText(left, aw + 10);
    }
  };
  const s = ink(t('challenge.streak', { n: days }), 24, { fill: P.inkSoft });
  s.position.set(ax, cy + 50);
  c.addChild(left, fitText(s, aw));
}

/** Every potion in a row: the four going into battle ticked, the reserve dimmed, the locked
 *  ones behind a padlock with the stage that opens them. Tapping one in the lineup swaps it
 *  for the reserve (or for the reserve `picked` first, when there are several). */
function lineupPanel(root: Container, m: MetaSave, act: HomeActions, picked: HeroKind | null, x: number, y: number, w: number): void {
  const c = titledPanel(root, t('lineup'), x, y, w, LINEUP_H);
  const step = Math.min(200, (w - 50) / HERO_KINDS.length);
  const cw = step - 16;
  const ch = 250;
  const cy = -LINEUP_H / 2 + 70 + ch / 2;
  HERO_KINDS.forEach((kind, i) => {
    const open = heroUnlocked(m, kind);
    const fielded = m.lineup.includes(kind);
    const b = tappable(new Container(), () => act.lineup(kind));
    b.position.set((i - (HERO_KINDS.length - 1) / 2) * step, cy);
    b.addChild(lightTile(cw, ch, 20));
    if (fielded) b.addChild(new Graphics().roundRect(-cw / 2 + 6, -ch / 2 + 6, cw - 12, ch - 12, 16).fill({ color: HERO_COLORS[kind], alpha: 0.25 }));
    if (kind === picked) b.addChild(new Graphics().roundRect(-cw / 2 - 6, -ch / 2 - 6, cw + 12, ch + 12, 24).stroke({ width: 8, color: P.brass }));
    const size = Math.min(150, cw - 24);
    if (open) {
      b.addChild(new Graphics().ellipse(0, -30 + size * 0.46, size * 0.34, size * 0.08).fill({ color: 0x000000, alpha: 0.18 }));
      const bt = bottle(kind, size);
      bt.y = -30;
      b.addChild(bt);
      const lv = ink(`Lv ${m.heroes[kind]}`, 32);
      lv.y = ch / 2 - 40;
      b.addChild(lv);
    } else {
      b.addChild(flask(new Graphics(), 0, -30 + size * 0.42, size * 0.84, 0x8a7d6a));
      const l = lock(P.cream, 0x8a7d6a);
      l.y = -30 + size * 0.1;
      b.addChild(l);
      const at = unlockStage(kind);
      const note = fitText(ink(at ? t('stage', { n: at }) : t('codex.locked'), 28, { fill: P.inkSoft }), cw - 16);
      note.y = ch / 2 - 40;
      b.addChild(note);
    }
    if (fielded) {
      const tick = new Container();
      tick.position.set(cw / 2 - 24, -ch / 2 + 24);
      tick.addChild(new Graphics().circle(0, 0, 24).fill(0x4cc35a).stroke({ width: 4, color: P.line }), label('✓', 30, { stroke: { color: P.line, width: 5 } }));
      b.addChild(tick);
    } else if (open) {
      b.alpha = kind === picked ? 1 : 0.7;
      // a chip in the corner the tick takes on a fielded potion, clear of the bottle
      const tag = new Container();
      const word = fitText(ink(t('bench'), 25, { fill: P.inkSoft }), cw - 40);
      const tw = word.width + 26;
      tag.position.set(cw / 2 - 8 - tw / 2, -ch / 2 + 26);
      tag.addChild(new Graphics().roundRect(-tw / 2, -20, tw, 40, 20).fill(LIGHT.inset).stroke({ width: 3, color: LIGHT.edge }), word);
      b.addChild(tag);
    } else {
      b.alpha = 0.8;
    }
    c.addChild(b);
  });
  // with no reserve yet, the hint says what opens the first locked potion
  const locked = HERO_KINDS.find((k) => !heroUnlocked(m, k) && unlockStage(k) !== null);
  const opens = locked ? t('lineupOpens', { name: t(`hero.${locked}`), n: unlockStage(locked) ?? 0 }) : '';
  const hint = benched(m).length === 0 ? opens : picked ? t('lineupPick') : t('lineupHint');
  if (hint) {
    const h = fitText(ink(hint, 30, { fill: P.inkSoft }), w - 60);
    h.y = LINEUP_H / 2 - 72;
    c.addChild(h);
  }
}

/** A card per potion: portrait, level, the milestones reached and the level-up button. */
function potionsTab(root: Container, m: MetaSave, act: HomeActions, a: Area): void {
  const head = plate(t('potions'), 52);
  head.position.set(a.x + a.w / 2, a.y + 60);
  root.addChild(head);
  // one row of five on a wide page; three over two on a portrait one
  const n = HERO_KINDS.length;
  const cols = a.wide ? n : 3;
  const cw = Math.min(380, (a.w - 60) / cols - 30);
  const ch = a.wide ? 650 : 640;
  HERO_KINDS.forEach((kind, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const card = heroCard(m, act, kind, cw, ch);
    card.position.set(a.x + a.w / 2 + (col - (inRow - 1) / 2) * (cw + 30), a.y + 150 + ch / 2 + row * (ch + 40));
    root.addChild(card);
  });
}

function heroCard(m: MetaSave, act: HomeActions, kind: HeroKind, cw: number, ch: number): Container {
  const lv = m.heroes[kind];
  const open = heroUnlocked(m, kind);
  const c = tappable(new Container(), () => act.panel(kind));
  const top = -ch / 2;
  c.addChild(paperCard(cw, ch));
  c.addChild(new Graphics().roundRect(-cw / 2 + 10, top + 10, cw - 20, 84, 18).fill(open ? HERO_COLORS[kind] : 0x8a7d6a).stroke({ width: 4, color: LIGHT.edge }));
  const name = fitText(label(t(`hero.${kind}`), 42, { stroke: { color: P.line, width: 7 } }), cw - 40);
  name.y = top + 50;
  const size = Math.min(250, cw - 40);
  const glow = new Graphics().circle(0, top + 250, size * 0.48).fill({ color: HERO_COLORS[kind], alpha: open ? 0.18 : 0 });
  const bt = open ? bottle(kind, size) : flask(new Graphics(), 0, size * 0.42, size * 0.84, 0x8a7d6a);
  bt.y = top + 250;
  c.addChild(name, glow, bt);
  if (!open) {
    const l = lock(P.cream, 0x8a7d6a);
    l.scale.set(1.4);
    l.y = top + 270;
    const at = unlockStage(kind);
    const note = fitText(ink(at ? t('unlockAt', { n: at }) : t('codex.locked'), 36, { fill: P.inkSoft }), cw - 40);
    note.y = top + 440;
    c.addChild(l, note);
    c.alpha = 0.85;
    return c;
  }
  const level = ink(`Lv ${lv}`, 50);
  level.y = top + 404;
  const dmg = fitText(ink(t('damageNow', { p: Math.round((heroDamage(lv) - 1) * 100) }), 30, { fill: P.inkSoft }), cw - 30);
  dmg.y = top + 450;
  c.addChild(level, dmg);
  // the milestones as pips, lit once reached
  const ms = MILESTONES[kind];
  const gap = Math.min(76, (cw - 30) / Math.max(1, ms.length));
  const pw = Math.min(64, gap - 8);
  ms.forEach((s, i) => {
    const on = lv >= s.level;
    const pip = new Container();
    pip.position.set((i - (ms.length - 1) / 2) * gap, top + 504);
    pip.addChild(new Graphics().roundRect(-pw / 2, -20, pw, 40, 12).fill(on ? P.brass : P.paperDark).stroke({ width: 4, color: on ? P.line : P.inkSoft }));
    pip.addChild(ink(String(s.level), 26, { fill: on ? P.line : P.inkSoft }));
    c.addChild(pip);
  });
  const cost = heroCost(lv);
  if (cost === null) {
    const max = ink(t('maxed'), 46, { fill: P.brassDark });
    max.y = ch / 2 - 64;
    c.addChild(max);
  } else {
    const b = new PillButton(String(cost), cw - 90, 84, 'purple', () => act.hero(kind), 42, true).setEnabled(m.crystals >= cost);
    b.y = ch / 2 - 54;
    c.addChild(b);
  }
  return c;
}

function workshopTab(root: Container, m: MetaSave, act: HomeActions, a: Area): void {
  const head = plate(t('workshop'), 52);
  head.position.set(a.x + a.w / 2, a.y + 60);
  root.addChild(head);
  const rw = Math.min(a.wide ? 1100 : 960, a.w - 80);
  WORKSHOP_IDS.forEach((id, i) => {
    const lv = m.workshop[id];
    const v = workshopValue(id, lv);
    const r = new Container();
    r.position.set(a.x + a.w / 2, a.y + 230 + i * 200);
    r.addChild(paperCard(rw, 170));
    const icon = new Container();
    icon.addChild(medal(62, P.paperDark), shopIcon(id));
    icon.x = -rw / 2 + 90;
    const n = ink(t(`shop.${id}.name`), 46);
    n.anchor.set(0, 0.5);
    n.position.set(-rw / 2 + 180, -26);
    const d = ink(t(`shop.${id}.desc`, { p: Math.round(v * 100), n: v }), 32, { fill: P.inkSoft });
    d.anchor.set(0, 0.5);
    d.position.set(-rw / 2 + 180, 30);
    r.addChild(icon, n, d);
    const cost = workshopCost(id, lv);
    if (cost === null) {
      const max = ink(t('maxed'), 46, { fill: P.brassDark });
      max.x = rw / 2 - 150;
      r.addChild(max);
    } else {
      const b = new PillButton(String(cost), 250, 100, 'purple', () => act.workshop(id), 44, true).setEnabled(m.crystals >= cost);
      b.position.set(rw / 2 - 150, -4);
      r.addChild(b);
    }
    root.addChild(r);
  });
}

/** The shop: the free daily chest and the rewarded ad for crystals, then the potions, the
 *  locked ones for sale. Stacked on a portrait page, side by side on a landscape one. */
function shopTab(root: Container, m: MetaSave, act: HomeActions, a: Area, today: string, ads: boolean): void {
  const top = a.y + 60;
  const bottom = a.y + a.h - 40;
  if (a.wide) {
    const gap = 40;
    const dw = Math.min(780, (a.w - 3 * gap) * 0.46);
    const uw = a.w - 3 * gap - dw;
    const ph = bottom - top;
    dailyPanel(root, m, act, today, ads, a.x + gap + dw / 2, top + ph / 2, dw, ph);
    unlockPanel(root, m, act, a.x + 2 * gap + dw + uw / 2, top + ph / 2, uw, ph, 3);
  } else {
    const pw = Math.min(960, a.w - 80);
    const gap = 60;
    // the potion tiles are narrow here: the chest and the ad take the height they leave
    const uh = Math.min(640, Math.round((bottom - top - gap) * 0.5));
    const dh = bottom - top - gap - uh;
    dailyPanel(root, m, act, today, ads, a.x + a.w / 2, top + dh / 2, pw, dh);
    unlockPanel(root, m, act, a.x + a.w / 2, bottom - uh / 2, pw, uh, HERO_KINDS.length);
  }
}

/** Today's free chest and the ad for crystals, as two cards side by side. */
function dailyPanel(root: Container, m: MetaSave, act: HomeActions, today: string, ads: boolean, x: number, y: number, w: number, h: number): void {
  const c = titledPanel(root, t('store.daily'), x, y, w, h);
  const cw = (w - 110) / 2;
  const ch = h - 130;
  const bw = cw - 60;
  const ready = chestReady(m, today);
  const left = adsLeft(m, today);
  const chest = offerCard(cw, ch, chestIcon(), t('store.chest.name'), t('store.chest.desc'), CHEST_CRYSTALS, !ready);
  const open = new PillButton(ready ? t('store.open') : t('tomorrow'), bw, 100, 'green', act.claimChest, ready ? 46 : 34).setEnabled(ready);
  open.y = ch / 2 - 74;
  chest.addChild(open);
  const can = ads && left > 0;
  const ad = offerCard(cw, ch, adIcon(), t('store.ad.name'), t('store.ad.desc', { n: left, total: ADS_PER_DAY }), AD_CRYSTALS, left === 0);
  const caption = !ads ? t('store.noAds') : left > 0 ? t('store.watch') : t('tomorrow');
  const watch = new PillButton(caption, bw, 100, 'green', act.watchAd, can ? 46 : 34).setEnabled(can);
  watch.y = ch / 2 - 74;
  ad.addChild(watch);
  chest.position.set(-(cw + 30) / 2, 30);
  ad.position.set((cw + 30) / 2, 30);
  c.addChild(chest, ad);
}

/** A green tick in a circle, for something done or owned. */
function tick(r: number): Container {
  const c = new Container();
  c.addChild(new Graphics().circle(0, 0, r).fill(0x4cc35a).stroke({ width: 4, color: LIGHT.edge }), label('✓', r * 1.25, { stroke: { color: LIGHT.edge, width: 5 } }));
  return c;
}

/** A card with an icon, a name, a line under it and the crystals it pays, for a button along
 *  its bottom; `done` dims it and ticks it. */
function offerCard(cw: number, ch: number, icon: Container, name: string, desc: string, crystals: number, done: boolean): Container {
  const c = new Container();
  const top = -ch / 2;
  c.addChild(lightTile(cw, ch, 26));
  // the icon takes what the text and the button leave
  const room = Math.max(90, ch - 360);
  const art = new Container();
  icon.scale.set(1.3);
  art.addChild(new Graphics().circle(0, 0, 84).fill({ color: P.brass, alpha: 0.18 }), icon);
  art.scale.set(Math.min(1.2, room / 180));
  art.y = top + 24 + room / 2;
  const n = fitText(ink(name, 40), cw - 40);
  n.y = top + 60 + room;
  const d = fitText(ink(desc, 28, { fill: P.inkSoft }), cw - 40);
  d.y = n.y + 50;
  // the crystals, gem first, the pair centred
  const pay = new Container();
  const amount = ink(t('reward', { n: crystals }), 50, { fill: LIGHT.crystal });
  amount.x = 24;
  pay.addChild(gem(new Graphics(), 24 - amount.width / 2 - 32, 0, 26), amount);
  pay.y = d.y + 72;
  c.addChild(art, n, d, pay);
  if (done) {
    art.alpha = 0.5;
    pay.alpha = 0.5;
    const tk = tick(26);
    tk.position.set(cw / 2 - 40, top + 40);
    c.addChild(tk);
  }
  return c;
}

/** Every potion: the open ones marked owned, the locked ones with their crystal price and the
 *  stage that would open them anyway. `cols` tiles to a row. */
function unlockPanel(root: Container, m: MetaSave, act: HomeActions, x: number, y: number, w: number, h: number, cols: number): void {
  const c = titledPanel(root, t('store.unlocks'), x, y, w, h);
  const n = HERO_KINDS.length;
  const rows = Math.ceil(n / cols);
  const gap = 20;
  const step = Math.min(250, (w - 60) / cols);
  const tw = step - gap;
  // room for the title plate above the tiles and the hint under them
  const hintH = 70;
  const th = Math.min(440, (h - 140 - hintH - gap * (rows - 1)) / rows);
  const y0 = -h / 2 + 90 + th / 2;
  // every name at one size: the one the longest needs to fit its tile
  // and when one is too long for its tile, every name on two lines, word under word
  const twoLines = HERO_KINDS.some((k) => {
    const x = ink(t(`hero.${k}`), 30);
    const over = x.width > tw - 20;
    x.destroy();
    return over;
  });
  const names = HERO_KINDS.map((k) => ink(unlockName(k, twoLines), 30, { lineHeight: 32 }));
  const nameScale = Math.min(1, ...names.map((x) => (tw - 20) / x.width));
  names.forEach((x) => x.destroy());
  HERO_KINDS.forEach((kind, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const tile = unlockTile(m, act, kind, tw, th, nameScale, twoLines);
    tile.position.set(((i % cols) - (inRow - 1) / 2) * step, y0 + row * (th + gap));
    c.addChild(tile);
  });
  const hint = fitText(ink(t('store.unlockHint'), 30, { fill: P.inkSoft }), w - 80);
  hint.y = y0 + (rows - 1) * (th + gap) + th / 2 + hintH / 2;
  c.addChild(hint);
}

function unlockName(kind: HeroKind, twoLines: boolean): string {
  const name = t(`hero.${kind}`);
  return twoLines ? name.replace(' ', '\n') : name;
}

function unlockTile(m: MetaSave, act: HomeActions, kind: HeroKind, tw: number, th: number, nameScale: number, twoLines: boolean): Container {
  const open = heroUnlocked(m, kind);
  const price = unlockPrice(kind);
  const c = new Container();
  const top = -th / 2;
  c.addChild(lightTile(tw, th, 22));
  const name = ink(unlockName(kind, twoLines), 30, { lineHeight: 32 });
  name.scale.set(nameScale);
  const head = twoLines ? 92 : 60;
  name.y = top + head / 2 + 4;
  c.addChild(name);
  // the bottle fills what the name and the price leave
  const band = th - head - (open ? 90 : 170);
  const size = Math.min(170, tw - 40, band - 10);
  const by = top + head + band / 2;
  if (open) {
    c.addChild(new Graphics().circle(0, by, size * 0.46).fill({ color: HERO_COLORS[kind], alpha: 0.16 }));
    const bt = bottle(kind, size);
    bt.y = by;
    const owned = new Container();
    owned.y = th / 2 - 56;
    const word = ink(t('store.owned'), 30, { fill: 0x2f7a3a });
    word.x = 22;
    const tk = tick(18);
    tk.x = 22 - word.width / 2 - 30;
    owned.addChild(tk, word);
    // the tick and the word together stay inside a narrow tile
    owned.scale.set(Math.min(1, (tw - 16) / (word.width + 60)));
    c.addChild(bt, owned);
    return c;
  }
  c.addChild(flask(new Graphics(), 0, by + size * 0.42, size * 0.84, 0x8a7d6a));
  const l = lock(P.cream, 0x8a7d6a);
  l.y = by + size * 0.1;
  c.addChild(l);
  const at = unlockStage(kind);
  // the stage that opens it anyway, over two lines rather than shrunk on a narrow tile
  const note = fitText(inkWrapped(at ? t('unlockAt', { n: at }) : t('codex.locked'), 26, tw - 24, { fill: P.inkSoft, lineHeight: 30 }), tw - 16);
  note.anchor.set(0.5, 1);
  note.y = th / 2 - 106;
  c.addChild(note);
  if (price !== null) {
    const b = new PillButton(String(price), tw - 30, 84, 'purple', () => act.unlock(kind), 38, true).setEnabled(m.crystals >= price);
    b.y = th / 2 - 58;
    c.addChild(b);
  }
  return c;
}

/** A little screen with a play sign: the rewarded ad. */
function adIcon(): Graphics {
  return new Graphics()
    .rect(-14, 34, 28, 12)
    .fill(P.brassDark)
    .roundRect(-30, 42, 60, 12, 5)
    .fill(P.brass)
    .stroke({ width: 3, color: LIGHT.edge })
    .roundRect(-52, -38, 104, 76, 14)
    .fill(P.woodLight)
    .stroke({ width: 5, color: LIGHT.edge })
    .roundRect(-42, -28, 84, 56, 8)
    .fill(0xbfe3f2)
    .poly([-12, -16, 18, 0, -12, 16])
    .fill(P.cream)
    .stroke({ width: 4, color: LIGHT.edge, join: 'round' });
}

function shopIcon(id: WorkshopId): Container {
  if (id === 'wall') return wallIcon();
  if (id === 'startGold') return coinsIcon();
  return gem(new Graphics(), 0, 0, 38);
}

// ---- panels over the page ----

/** A framed panel in the middle of the page, shrunk to fit a short one; tapping outside it
 *  closes it. */
function frame(act: HomeActions, title: string, h: number, fit: MenuFit): { panel: Container; box: Container } {
  const p = new Container();
  const shade = new Graphics().rect(0, 0, fit.w, fit.h).fill({ color: 0x3a2614, alpha: 0.45 });
  shade.eventMode = 'static';
  shade.on('pointertap', () => act.panel(null));
  const box = new Container();
  box.position.set(fit.w / 2, fit.h / 2 + 20);
  box.scale.set(Math.min(1, (fit.h - 80) / (h + 60)));
  const bg = lightPanel(940, h);
  bg.eventMode = 'static'; // taps on the panel itself do not close it
  const head = plate(title, 54, 420);
  head.y = -h / 2 + 6;
  const close = tappable(new Container(), () => act.panel(null));
  close.position.set(440, -h / 2 + 10);
  close.addChild(medal(46, P.red), label('✕', 40, { stroke: { color: P.line, width: 6 } }));
  box.addChild(bg, head, close);
  p.addChild(shade, box);
  return { panel: p, box };
}

/** The seven days of the login track: claimed ones ticked, today's lit up. */
function loginPanel(m: MetaSave, act: HomeActions, today: string, fit: MenuFit): Container {
  const h = 820;
  const { panel, box } = frame(act, t('login'), h, fit);
  const can = canClaimLogin(m, today);
  let done = loginDay(m);
  if (!can && done === 0 && m.daily.claims > 0) done = 7;
  for (let i = 0; i < 7; i++) {
    // four days on the first row; days five and six, then the big seventh, on the second
    const last = i === 6;
    const w = last ? 400 : 190;
    const tile = new Container();
    tile.position.set(last ? 210 : -315 + (i % 4) * 210, i < 4 ? -190 : 70);
    const lit = can && i === done;
    tile.addChild(lightTile(w, 220, 24));
    if (lit) tile.addChild(new Graphics().roundRect(-w / 2 - 6, -116, w + 12, 232, 28).stroke({ width: 8, color: P.brass }));
    const day = ink(t('day', { n: i + 1 }), 34, { fill: lit ? P.brassDark : P.inkSoft });
    day.position.set(0, -76);
    const amount = ink(String(loginReward(i)), 40);
    amount.position.set(0, 72);
    tile.addChild(gem(new Graphics(), 0, -6, last ? 50 : 38), day, amount);
    if (i < done) {
      tile.alpha = 0.6;
      const tick = label('✓', 90, { fill: 0x5cc66a, stroke: { color: P.line, width: 8 } });
      tick.position.set(0, -6);
      tile.addChild(tick);
    }
    box.addChild(tile);
  }
  const claim = new PillButton(can ? t('claim') : t('tomorrow'), 520, 140, 'green', act.claimLogin, 52).setEnabled(can);
  claim.position.set(0, h / 2 - 110);
  box.addChild(claim);
  return panel;
}

/** Today's three tasks: what to do, how far along, and the claim button. */
function tasksPanel(m: MetaSave, act: HomeActions, fit: MenuFit): Container {
  const h = 690;
  const { panel, box } = frame(act, t('tasks'), h, fit);
  m.daily.tasks.forEach((task, i) => {
    const r = new Container();
    r.position.set(0, -165 + i * 190);
    const goal = taskGoal(task.id);
    const desc = ink(t(`task.${task.id}`, { n: goal }), 40);
    desc.anchor.set(0, 0.5);
    desc.position.set(-400, -36);
    const frac = Math.min(1, task.progress / goal);
    const bar = new Graphics()
      .roundRect(-400, 14, 420, 34, 17)
      .fill(P.paperDark)
      .roundRect(-400, 14, Math.max(34, 420 * frac), 34, 17)
      .fill({ color: 0x5cc66a, alpha: frac > 0 ? 1 : 0 })
      .roundRect(-400, 14, 420, 34, 17)
      .stroke({ width: 4, color: P.line });
    const count = label(`${task.progress}/${goal}`, 28, { stroke: { color: P.line, width: 6 } });
    count.position.set(-190, 31);
    r.addChild(lightTile(860, 160), desc, bar, count);
    if (task.claimed) {
      const c = ink(t('claimed'), 40, { fill: P.inkSoft });
      c.position.set(270, 0);
      r.addChild(c);
    } else {
      const b = new PillButton(String(taskReward(task.id)), 250, 100, 'green', () => act.claimTask(i), 44, true).setEnabled(taskDone(task));
      b.position.set(270, -4);
      r.addChild(b);
    }
    box.addChild(r);
  });
  return panel;
}

/** One hero: its level, the skill cards it starts with and what each milestone unlocks. */
function heroPanel(m: MetaSave, act: HomeActions, kind: HeroKind, fit: MenuFit): Container {
  const h = 1300;
  const { panel, box } = frame(act, t(`hero.${kind}`), h, fit);
  const lv = m.heroes[kind];
  const top = -h / 2;
  const bt = bottle(kind, 220);
  bt.position.set(-300, top + 250);
  box.addChild(new Graphics().circle(-300, top + 250, 120).fill({ color: HERO_COLORS[kind], alpha: 0.2 }), bt);
  const level = ink(`Lv ${lv} / ${BALANCE.meta.heroMax}`, 56);
  level.anchor.set(0, 0.5);
  level.position.set(-150, top + 210);
  const dmg = ink(t('heroDamage', { p: Math.round(BALANCE.meta.heroDamage * 100), n: Math.round((heroDamage(lv) - 1) * 100) }), 34, { fill: P.inkSoft });
  dmg.anchor.set(0, 0.5);
  dmg.position.set(-150, top + 290);
  box.addChild(level, dmg);

  const head = ink(t('baseCards'), 38, { fill: P.brassDark });
  head.position.set(0, top + 420);
  const base = baseSkills(kind).map((id) => t(`skill.${id}.name`)).join('  ·  ');
  const P2 = BALANCE.heroes.poison;
  const cards = base
    ? ink(base, 40)
    : fitText(ink(kind === 'poison' ? t('rust', { p: Math.round(P2.rustStep * 100), n: P2.rustMax }) : '', 34), 860);
  cards.position.set(0, top + 480);
  box.addChild(head, cards);

  let y = top + 554;
  MILESTONES[kind].forEach((ms) => {
    const on = lv >= ms.level;
    const r = new Container();
    const lvTag = ink(`Lv.${ms.level}`, 38, { fill: on ? P.brassDark : P.inkSoft });
    lvTag.position.set(-350, 0);
    let what: string;
    let detail = '';
    if ('perk' in ms) {
      what = t(`perk.${ms.perk}`);
    } else {
      const other = skillHeroes(ms.skill).with;
      const name = t(`skill.${ms.skill}.name`);
      what = other ? t('unlockRecipe', { name, with: t(`hero.${other}`) }) : t('unlockSkill', { name });
      detail = t(`skill.${ms.skill}.desc`);
    }
    // the line and its detail as one block, centred in the row however they wrap
    const text = new Container();
    const a = inkWrapped(what, 34, 600, { align: 'left' });
    a.anchor.set(0, 0);
    text.addChild(a);
    if (detail) {
      const d = inkWrapped(detail, 26, 600, { fill: P.inkSoft, align: 'left' });
      d.anchor.set(0, 0);
      d.y = a.height + 4;
      text.addChild(d);
    }
    // the row grows with a long recipe line
    const rh = Math.max(132, text.height + 32);
    r.position.set(0, y + rh / 2);
    y += rh + 18;
    r.addChild(lightTile(860, rh, 22));
    if (on) r.addChild(new Graphics().roundRect(-436, -rh / 2 - 6, 872, rh + 12, 26).stroke({ width: 7, color: P.brass }));
    text.position.set(-260, -text.height / 2);
    r.addChild(lvTag, text);
    if (on) {
      const tick = label('✓', 52, { fill: 0x5cc66a, stroke: { color: P.line, width: 8 } });
      tick.position.set(380, 0);
      r.addChild(tick);
    } else {
      const l = lock();
      l.position.set(380, 4);
      r.addChild(l);
      r.alpha = 0.8;
    }
    box.addChild(r);
  });
  return panel;
}
