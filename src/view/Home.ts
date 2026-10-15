// The home screen between battles, in the alchemist's-workshop look: a top bar with the daily
// login, the daily tasks and the crystals, five tabs (potions, workshop, battle, codex, shop)
// and the daily login reward, the daily tasks and a hero's milestones as panels over it.
// Laid out on the whole screen: a portrait page with the tabs along the bottom, or on a wide
// (desktop) screen a landscape page with the tabs down the left side. Built afresh after every
// purchase, claim or resize.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../i18n';
import { canClaimLogin, loginDay, loginReward, taskDone, taskGoal, taskReward, tasksClaimable } from '../sim/daily';
import { BALANCE, type EnemyKind } from '../sim/types';
import { baseSkills, MILESTONES, skillHeroes } from '../sim/skills';
import { heroCost, heroDamage, LEVELLED_HEROES, maxStage, stageHp, WORKSHOP_IDS, workshopCost, workshopValue, type MetaSave, type WorkshopId } from '../sim/meta';
import type { HeroKind } from '../sim/types';
import { commanderTexture, enemyTexture } from './art';
import {
  bookIcon,
  bottle,
  coinsIcon,
  calendarIcon,
  chestIcon,
  gearIcon,
  ink,
  lock,
  medal,
  P,
  paperCard,
  PillButton,
  plate,
  redDot,
  scrollIcon,
  swordsIcon,
  tappable,
  wallIcon,
  woodPanel,
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
  workshop(id: WorkshopId): void;
  play(): void;
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
const ENEMIES: readonly EnemyKind[] = ['grunt', 'runner', 'brute', 'boss'];

export function buildHome(m: MetaSave, act: HomeActions, tab: HomeTab, panel: HomePanel, today: string, fit: MenuFit): Container {
  const root = new Container();
  const { w, h, wide } = fit;
  root.addChild(backdrop(w, h));
  const left = wide ? RAIL : 0;
  const top = wide ? TOP - 20 : TOP;
  const area: Area = { x: left, y: top, w: w - left, h: (wide ? h : h - NAV) - top, wide };
  if (tab === 'battle') battleTab(root, m, act, area);
  else if (tab === 'potions') potionsTab(root, m, act, area);
  else if (tab === 'workshop') workshopTab(root, m, act, area);
  else soonTab(root, tab, area);
  topBar(root, m, act, today, left, w, wide);
  nav(root, act, tab, fit);
  if (panel === 'login') root.addChild(loginPanel(m, act, today, fit));
  else if (panel === 'tasks') root.addChild(tasksPanel(m, act, fit));
  else if (panel) root.addChild(heroPanel(m, act, panel, fit));
  return root;
}

/** The workshop wall behind everything: dark planks, lit warm in the middle. */
function backdrop(w: number, h: number): Graphics {
  const g = new Graphics().rect(0, 0, w, h).fill(0x2e1d10);
  for (let x = 0, i = 0; x < w; x += 150, i++) {
    g.rect(x, 0, 150, h).fill(i % 2 ? 0x34210f : 0x3a2513);
    g.rect(x, 0, 5, h).fill(0x1c1108);
  }
  for (let i = 6; i > 0; i--) g.ellipse(w / 2, h * 0.45, w * 0.1 * i, h * 0.08 * i).fill({ color: 0xffb35a, alpha: 0.035 });
  return g;
}

function topBar(root: Container, m: MetaSave, act: HomeActions, today: string, left: number, w: number, wide: boolean): void {
  const y = wide ? 70 : 80;
  const button = (x: number, icon: Container, text: string, dot: boolean, onTap: () => void) => {
    const c = tappable(new Container(), onTap);
    c.position.set(x, y);
    icon.scale.set(0.72);
    const cap = label(text, 26, { fill: P.cream, stroke: { color: P.line, width: 6 } });
    cap.y = 54;
    c.addChild(medal(56), icon, cap);
    if (dot) redDot(c, 42, -42);
    root.addChild(c);
  };
  button(left + 90, calendarIcon(), t('login'), canClaimLogin(m, today), () => act.panel('login'));
  button(left + 240, scrollIcon(), t('tasks'), tasksClaimable(m), () => act.panel('tasks'));

  // the crystals in a dark inset, top right
  const count = label(String(m.crystals), 50, { fill: 0x9beaff });
  const pw = Math.max(240, count.width + 120);
  const purse = new Container();
  purse.position.set(w - 40 - pw / 2, y);
  purse.addChild(
    new Graphics().roundRect(-pw / 2, -40, pw, 80, 40).fill(P.woodDark).stroke({ width: 5, color: P.line }),
    gem(new Graphics(), -pw / 2 + 40, 0, 34),
  );
  count.x = 22;
  purse.addChild(count);
  root.addChild(purse);
}

/** The five tabs: along the bottom of a portrait page, down the left of a landscape one; the
 *  battle tab in the middle is a big raised medallion. */
function nav(root: Container, act: HomeActions, tab: HomeTab, fit: MenuFit): void {
  const { w, h, wide } = fit;
  const bar = new Graphics();
  if (wide) {
    bar.rect(0, 0, RAIL, h).fill(P.wood).rect(RAIL - 14, 0, 14, h).fill(P.brass).rect(RAIL - 14, 0, 4, h).fill(P.brassLight);
    bar.rect(RAIL, 0, 5, h).fill(P.line);
  } else {
    bar.rect(0, h - NAV, w, NAV).fill(P.wood).rect(0, h - NAV, w, 14).fill(P.brass).rect(0, h - NAV + 2, w, 4).fill(P.brassLight);
    bar.rect(0, h - NAV - 5, w, 5).fill(P.line);
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
          .fill({ color: P.brass, alpha: 0.35 })
          .stroke({ width: 4, color: P.brassLight, alpha: 0.8 }),
      );
    }
    const icon = navIcon(id);
    if (big) {
      const lift = wide ? 0 : -34;
      const md = medal(92, on ? 0x3c9a4a : P.woodDark);
      md.y = lift - 14;
      icon.y = lift - 14;
      icon.scale.set(0.95);
      slot.addChild(md);
    } else {
      icon.y = -22;
      icon.scale.set(on ? 0.95 : 0.8);
    }
    const cap = label(t(`tabs.${id}`), 34, {
      fill: on ? P.brassLight : P.soft,
      stroke: { color: P.line, width: 6 },
    });
    cap.y = big ? (wide ? 92 : 70) : 58;
    slot.addChild(icon, cap);
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
function battleTab(root: Container, m: MetaSave, act: HomeActions, a: Area): void {
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
    const hp = label(t('stageHp', { n: stageHp(m.stage).toFixed(2) }), 38, { fill: P.soft, stroke: { color: P.line, width: 7 } });
    hp.position.set(x, y + 100);
    root.addChild(hp);
  };
  const start = (x: number, y: number) => {
    const b = new PillButton(t('start'), 620, 180, 'green', act.play, 76);
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
      s.scale.set(400 / tex.height);
      s.position.set(lx, a.y + a.h - 260);
      root.addChild(new Graphics().ellipse(lx, a.y + a.h - 265, 170, 34).fill({ color: 0x000000, alpha: 0.35 }), s);
    }
    start(lx, a.y + a.h - 130);
    enemiesPanel(root, rx, a.y + 235, rw);
    lineupPanel(root, m, act, rx, a.y + 680, rw);
  } else {
    stageAt(a.x + a.w / 2, a.y + 90);
    // the panels share the room between the stage and the button
    const free = a.h - 280 - 300;
    const gap = Math.max(40, (free - 2 * 380) / 3);
    enemiesPanel(root, a.x + a.w / 2, a.y + 280 + gap + 190, pw);
    lineupPanel(root, m, act, a.x + a.w / 2, a.y + 280 + 2 * gap + 570, pw);
    start(a.x + a.w / 2, a.y + a.h - 150);
  }
}

function titledPanel(root: Container, title: string, x: number, y: number, w: number, h: number): Container {
  const c = new Container();
  c.position.set(x, y);
  const p = plate(title, 40, 280);
  p.y = -h / 2 + 4;
  c.addChild(woodPanel(w, h), p);
  root.addChild(c);
  return c;
}

/** The clockwork army this stage sends, the boss marked. */
function enemiesPanel(root: Container, x: number, y: number, w: number): void {
  const c = titledPanel(root, t('enemies'), x, y, w, 380);
  const step = Math.min(210, (w - 80) / ENEMIES.length);
  ENEMIES.forEach((kind, i) => {
    const tile = new Container();
    tile.position.set((i - (ENEMIES.length - 1) / 2) * step, 30);
    tile.addChild(paperCard(step - 20, 220, 22));
    const tex = enemyTexture(kind);
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.scale.set(170 / Math.max(tex.width, tex.height));
      s.y = -4;
      tile.addChild(s);
    }
    if (kind === 'boss') {
      const tag = new Container();
      tag.position.set(0, 96);
      tag.addChild(new Graphics().roundRect(-56, -22, 112, 44, 14).fill(P.red).stroke({ width: 4, color: P.line }), label('BOSS', 28));
      tile.addChild(tag);
    }
    c.addChild(tile);
  });
}

/** The four potions that go into battle, with their levels; each opens its hero panel. */
function lineupPanel(root: Container, m: MetaSave, act: HomeActions, x: number, y: number, w: number): void {
  const c = titledPanel(root, t('lineup'), x, y, w, 380);
  const step = Math.min(210, (w - 80) / LEVELLED_HEROES.length);
  LEVELLED_HEROES.forEach((kind, i) => {
    const b = tappable(new Container(), () => act.panel(kind));
    b.position.set((i - (LEVELLED_HEROES.length - 1) / 2) * step, 10);
    b.addChild(new Graphics().ellipse(0, 86, 66, 16).fill({ color: 0x000000, alpha: 0.35 }));
    const bt = bottle(kind, 190);
    b.addChild(bt);
    const lv = label(`Lv ${m.heroes[kind]}`, 34, { fill: P.cream, stroke: { color: P.line, width: 7 } });
    lv.y = 126;
    b.addChild(lv);
    c.addChild(b);
  });
}

/** A card per potion: portrait, level, the milestones reached and the level-up button. */
function potionsTab(root: Container, m: MetaSave, act: HomeActions, a: Area): void {
  const head = plate(t('potions'), 52);
  head.position.set(a.x + a.w / 2, a.y + 60);
  root.addChild(head);
  const cols = a.wide ? 4 : 2;
  const cw = a.wide ? Math.min(380, (a.w - 120) / 4 - 30) : 480;
  const ch = a.wide ? 650 : 640;
  LEVELLED_HEROES.forEach((kind, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const card = heroCard(m, act, kind, cw, ch);
    card.position.set(a.x + a.w / 2 + (col - (cols - 1) / 2) * (cw + 30), a.y + 150 + ch / 2 + row * (ch + 40));
    root.addChild(card);
  });
}

function heroCard(m: MetaSave, act: HomeActions, kind: HeroKind, cw: number, ch: number): Container {
  const lv = m.heroes[kind];
  const c = tappable(new Container(), () => act.panel(kind));
  const top = -ch / 2;
  c.addChild(paperCard(cw, ch));
  c.addChild(new Graphics().roundRect(-cw / 2 + 10, top + 10, cw - 20, 84, 18).fill(HERO_COLORS[kind]).stroke({ width: 4, color: P.line }));
  const name = label(t(`hero.${kind}`), 42, { stroke: { color: P.line, width: 7 } });
  name.y = top + 50;
  const glow = new Graphics().circle(0, top + 250, 120).fill({ color: HERO_COLORS[kind], alpha: 0.18 });
  const bt = bottle(kind, 250);
  bt.y = top + 250;
  const level = ink(`Lv ${lv}`, 50);
  level.y = top + 420;
  const dmg = ink(t('damageNow', { p: Math.round((heroDamage(lv) - 1) * 100) }), 30, { fill: P.inkSoft });
  dmg.y = top + 468;
  c.addChild(name, glow, bt, level, dmg);
  // the milestones as pips, lit once reached
  const ms = MILESTONES[kind];
  ms.forEach((s, i) => {
    const on = lv >= s.level;
    const pip = new Container();
    pip.position.set((i - (ms.length - 1) / 2) * 76, top + 522);
    pip.addChild(new Graphics().roundRect(-32, -20, 64, 40, 12).fill(on ? P.brass : P.paperDark).stroke({ width: 4, color: on ? P.line : P.inkSoft }));
    pip.addChild(ink(String(s.level), 26, { fill: on ? P.line : P.inkSoft }));
    c.addChild(pip);
  });
  const cost = heroCost(lv);
  if (cost === null) {
    const max = ink(t('maxed'), 46, { fill: P.brassDark });
    max.y = ch / 2 - 64;
    c.addChild(max);
  } else {
    const b = new PillButton(String(cost), cw - 90, 100, 'purple', () => act.hero(kind), 44, true).setEnabled(m.crystals >= cost);
    b.y = ch / 2 - 66;
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

function soonTab(root: Container, tab: HomeTab, a: Area): void {
  const c = titledPanel(root, t(`tabs.${tab}`), a.x + a.w / 2, a.y + a.h / 2, Math.min(800, a.w - 80), 480);
  const icon = navIcon(tab);
  icon.scale.set(1.6);
  icon.y = -10;
  const s = label(t('soon'), 44, { fill: P.soft, stroke: { color: P.line, width: 7 } });
  s.y = 140;
  c.addChild(icon, s);
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
  const shade = new Graphics().rect(0, 0, fit.w, fit.h).fill({ color: 0x000000, alpha: 0.6 });
  shade.eventMode = 'static';
  shade.on('pointertap', () => act.panel(null));
  const box = new Container();
  box.position.set(fit.w / 2, fit.h / 2 + 20);
  box.scale.set(Math.min(1, (fit.h - 80) / (h + 60)));
  const bg = woodPanel(940, h);
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
  const h = 900;
  const { panel, box } = frame(act, t('login'), h, fit);
  const can = canClaimLogin(m, today);
  let done = loginDay(m);
  if (!can && done === 0 && m.daily.claims > 0) done = 7;
  for (let i = 0; i < 7; i++) {
    // four days on the first row; days five and six, then the big seventh, on the second
    const last = i === 6;
    const w = last ? 400 : 190;
    const tile = new Container();
    tile.position.set(last ? 210 : -315 + (i % 4) * 210, i < 4 ? -150 : 110);
    const lit = can && i === done;
    tile.addChild(paperCard(w, 220, 24));
    if (lit) tile.addChild(new Graphics().roundRect(-w / 2 - 6, -116, w + 12, 232, 28).stroke({ width: 8, color: P.brassLight }));
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
  claim.position.set(0, h / 2 - 120);
  box.addChild(claim);
  return panel;
}

/** Today's three tasks: what to do, how far along, and the claim button. */
function tasksPanel(m: MetaSave, act: HomeActions, fit: MenuFit): Container {
  const h = 760;
  const { panel, box } = frame(act, t('tasks'), h, fit);
  m.daily.tasks.forEach((task, i) => {
    const r = new Container();
    r.position.set(0, -150 + i * 190);
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
    r.addChild(paperCard(860, 160), desc, bar, count);
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
  const level = label(`Lv ${lv} / ${BALANCE.meta.heroMax}`, 56, { fill: P.brassLight, stroke: { color: P.line, width: 8 } });
  level.anchor.set(0, 0.5);
  level.position.set(-150, top + 210);
  const dmg = label(t('heroDamage', { p: Math.round(BALANCE.meta.heroDamage * 100), n: Math.round((heroDamage(lv) - 1) * 100) }), 34, { fill: P.soft, stroke: { color: P.line, width: 6 } });
  dmg.anchor.set(0, 0.5);
  dmg.position.set(-150, top + 290);
  box.addChild(level, dmg);

  const head = label(t('baseCards'), 38, { fill: P.brassLight, stroke: { color: P.line, width: 6 } });
  head.position.set(0, top + 420);
  const cards = label(baseSkills(kind).map((id) => t(`skill.${id}.name`)).join('  ·  '), 40, { stroke: { color: P.line, width: 6 } });
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
    const a = ink(what, 34, { wordWrap: true, breakWords: true, wordWrapWidth: 600, align: 'left' });
    a.anchor.set(0, 0);
    text.addChild(a);
    if (detail) {
      const d = ink(detail, 26, { fill: P.inkSoft, wordWrap: true, breakWords: true, wordWrapWidth: 600, align: 'left' });
      d.anchor.set(0, 0);
      d.y = a.height + 4;
      text.addChild(d);
    }
    // the row grows with a long recipe line
    const rh = Math.max(132, text.height + 32);
    r.position.set(0, y + rh / 2);
    y += rh + 18;
    r.addChild(paperCard(860, rh, 22));
    if (on) r.addChild(new Graphics().roundRect(-436, -rh / 2 - 6, 872, rh + 12, 26).stroke({ width: 7, color: P.brassLight }));
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
