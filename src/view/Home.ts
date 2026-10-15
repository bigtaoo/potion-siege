// The home screen between battles: the crystals, the stage to fight, the potions to level up,
// the workshop upgrades and the button into battle, with the daily login reward and the daily
// tasks as panels over it. Built afresh after every purchase or claim.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../i18n';
import { canClaimLogin, loginDay, loginReward, taskDone, taskGoal, taskReward, tasksClaimable } from '../sim/daily';
import { BALANCE } from '../sim/types';
import { baseSkills, MILESTONES, skillHeroes } from '../sim/skills';
import { heroCost, heroDamage, LEVELLED_HEROES, maxStage, stageHp, WORKSHOP_IDS, workshopCost, workshopValue, type MetaSave, type WorkshopId } from '../sim/meta';
import type { HeroKind } from '../sim/types';
import { ultimateTexture } from './art';
import { slab } from './stone';
import { Button, COLORS, gem, HERO_COLORS, label } from './ui';
import { DESIGN_W } from './viewport';

export type HomePanel = 'login' | 'tasks' | HeroKind | null;

export interface HomeActions {
  panel(p: HomePanel): void;
  claimLogin(): void;
  claimTask(index: number): void;
  stage(delta: number): void;
  hero(kind: HeroKind): void;
  workshop(id: WorkshopId): void;
  play(): void;
}

const ROW = { w: 960, h: 124, gap: 140 };
const DESC = 0xcfe0f0;

export function buildHome(m: MetaSave, act: HomeActions, panel: HomePanel, today: string): Container {
  const root = new Container();
  const cx = DESIGN_W / 2;

  // the crystals, top centre
  const purse = new Container();
  const count = label(String(m.crystals), 64, { fill: 0x9beaff });
  count.anchor.set(0, 0.5);
  count.x = 30;
  purse.addChild(gem(new Graphics(), -10, 0, 34), count);
  purse.position.set(cx - (count.width + 40) / 2, 110);
  root.addChild(purse);
  corner(root, t('login'), 150, canClaimLogin(m, today), () => act.panel('login'));
  corner(root, t('tasks'), DESIGN_W - 150, tasksClaimable(m), () => act.panel('tasks'));

  // the stage, with arrows to go back to an easier one
  const stage = label(t('stage', { n: m.stage }), 76, { fill: COLORS.gold });
  stage.position.set(cx, 260);
  const hp = label(t('stageHp', { n: stageHp(m.stage).toFixed(2) }), 36, { fill: DESC });
  hp.position.set(cx, 340);
  const prev = new Button('◀', 120, 120, COLORS.card, () => act.stage(-1), 56);
  prev.position.set(cx - 330, 270);
  prev.setEnabled(m.stage > 1);
  const next = new Button('▶', 120, 120, COLORS.card, () => act.stage(1), 56);
  next.position.set(cx + 330, 270);
  next.setEnabled(m.stage < maxStage(m));
  root.addChild(stage, hp, prev, next);

  section(root, t('potions'), 450);
  LEVELLED_HEROES.forEach((kind, i) => {
    const lv = m.heroes[kind];
    const icon = new Container();
    const tex = ultimateTexture(kind);
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.scale.set(112 / Math.max(tex.width, tex.height));
      icon.addChild(s);
    } else {
      icon.addChild(new Graphics().circle(0, 0, 44).fill(HERO_COLORS[kind]).stroke({ width: 5, color: 0x0e0c12 }));
    }
    const desc = t('heroLevel', { n: lv, p: Math.round((heroDamage(lv) - 1) * 100) });
    const r = row(root, 570 + i * ROW.gap, icon, t(`hero.${kind}`), desc, heroCost(lv), m.crystals, () => act.hero(kind));
    // the milestones as small tags after the name, lit once reached; the row opens the hero
    const name = r.getChildAt(2) as Container;
    MILESTONES[kind].forEach((ms, j) => {
      const on = lv >= ms.level;
      const tag = new Container();
      tag.position.set(name.x + name.width + 50 + j * 72, -24);
      tag.addChild(new Graphics().roundRect(-32, -22, 64, 44, 14).fill(on ? COLORS.gold : 0x16263a).stroke({ width: 4, color: 0x0e0c12 }));
      const n = label(String(ms.level), 26, { fill: on ? 0x0e0c12 : DESC });
      tag.addChild(n);
      r.addChild(tag);
    });
    const bg = r.getChildAt(0);
    bg.eventMode = 'static';
    bg.cursor = 'pointer';
    bg.on('pointertap', () => act.panel(kind));
  });

  section(root, t('workshop'), 1150);
  WORKSHOP_IDS.forEach((id, i) => {
    const lv = m.workshop[id];
    const v = workshopValue(id, lv);
    const desc = t(`shop.${id}.desc`, { p: Math.round(v * 100), n: v });
    row(root, 1270 + i * ROW.gap, shopIcon(id), t(`shop.${id}.name`), desc, workshopCost(id, lv), m.crystals, () => act.workshop(id));
  });

  const play = new Button(t('play'), 640, 170, COLORS.button, act.play, 72);
  play.position.set(cx, 1760);
  root.addChild(play);
  if (panel === 'login') root.addChild(loginPanel(m, act, today));
  if (panel === 'tasks') root.addChild(tasksPanel(m, act));
  if (panel && panel !== 'login' && panel !== 'tasks') root.addChild(heroPanel(m, act, panel));
  return root;
}

/** A small button in a top corner, with a red dot when something waits to be claimed. */
function corner(root: Container, text: string, x: number, dot: boolean, onTap: () => void): void {
  const b = new Button(text, 230, 96, 0xd98b1f, onTap, 40);
  b.position.set(x, 110);
  if (dot) b.addChild(new Graphics().circle(100, -40, 18).fill(0xe5484d).stroke({ width: 5, color: 0x0e0c12 }));
  root.addChild(b);
}

/** A framed panel over the home screen; tapping outside it closes it. */
function frame(act: HomeActions, title: string, h: number): { panel: Container; box: Container } {
  const p = new Container();
  const shade = new Graphics().rect(-2000, -2000, DESIGN_W + 4000, 6000).fill({ color: 0x000000, alpha: 0.6 });
  shade.eventMode = 'static';
  shade.on('pointertap', () => act.panel(null));
  const box = new Container();
  box.position.set(DESIGN_W / 2, 960);
  const bg = new Graphics()
    .roundRect(-470, -h / 2 + 12, 940, h, 40)
    .fill(0x0e0c12)
    .roundRect(-470, -h / 2, 940, h, 40)
    .fill(COLORS.card)
    .stroke({ width: 7, color: 0x0e0c12 });
  bg.eventMode = 'static'; // taps on the panel itself do not close it
  const head = label(title, 64, { fill: COLORS.gold });
  head.position.set(0, -h / 2 + 80);
  const close = new Button('✕', 96, 96, COLORS.buttonOff, () => act.panel(null), 48);
  close.position.set(400, -h / 2 + 70);
  box.addChild(bg, head, close);
  p.addChild(shade, box);
  return { panel: p, box };
}

/** The seven days of the login track: claimed ones ticked, today's lit up. */
function loginPanel(m: MetaSave, act: HomeActions, today: string): Container {
  const h = 900;
  const { panel, box } = frame(act, t('login'), h);
  const can = canClaimLogin(m, today);
  let done = loginDay(m);
  if (!can && done === 0 && m.daily.claims > 0) done = 7;
  for (let i = 0; i < 7; i++) {
    // four days on the first row; days five and six, then the big seventh, on the second
    const last = i === 6;
    const w = last ? 400 : 190;
    const tile = new Container();
    tile.position.set(last ? 210 : -315 + (i % 4) * 210, i < 4 ? -170 : 90);
    const lit = can && i === done;
    const g = new Graphics().roundRect(-w / 2, -110, w, 220, 26).fill(i < done ? 0x16263a : 0x2a4868);
    g.stroke({ width: lit ? 8 : 5, color: lit ? COLORS.gold : 0x0e0c12 });
    const day = label(t('day', { n: i + 1 }), 34, { fill: lit ? COLORS.gold : DESC });
    day.position.set(0, -76);
    const amount = label(String(loginReward(i)), 40, { fill: 0x9beaff });
    amount.position.set(0, 72);
    tile.addChild(g, gem(new Graphics(), 0, -6, last ? 50 : 38), day, amount);
    if (i < done) {
      tile.alpha = 0.55;
      const tick = label('✓', 90, { fill: 0x7ed957 });
      tick.position.set(0, -6);
      tile.addChild(tick);
    }
    box.addChild(tile);
  }
  const claim = new Button(can ? t('claim') : t('tomorrow'), 520, 140, COLORS.button, act.claimLogin, 52);
  claim.position.set(0, h / 2 - 120);
  claim.setEnabled(can);
  box.addChild(claim);
  return panel;
}

/** Today's three tasks: what to do, how far along, and the claim button. */
function tasksPanel(m: MetaSave, act: HomeActions): Container {
  const h = 760;
  const { panel, box } = frame(act, t('tasks'), h);
  m.daily.tasks.forEach((task, i) => {
    const r = new Container();
    r.position.set(0, -170 + i * 190);
    const goal = taskGoal(task.id);
    const bg = new Graphics().roundRect(-430, -80, 860, 160, 26).fill(0x2a4868).stroke({ width: 5, color: 0x0e0c12 });
    const desc = label(t(`task.${task.id}`, { n: goal }), 40);
    desc.anchor.set(0, 0.5);
    desc.position.set(-400, -36);
    const frac = Math.min(1, task.progress / goal);
    const bar = new Graphics()
      .roundRect(-400, 14, 420, 34, 17)
      .fill(0x0e1a2b)
      .roundRect(-400, 14, Math.max(34, 420 * frac), 34, 17)
      .fill({ color: 0x7ed957, alpha: frac > 0 ? 1 : 0 })
      .roundRect(-400, 14, 420, 34, 17)
      .stroke({ width: 4, color: 0x0e0c12 });
    const count = label(`${task.progress}/${goal}`, 28);
    count.position.set(-190, 31);
    r.addChild(bg, desc, bar, count);
    if (task.claimed) {
      const c = label(t('claimed'), 40, { fill: DESC });
      c.position.set(270, 0);
      r.addChild(c);
    } else {
      const b = new Button(`   ${taskReward(task.id)}`, 250, 110, COLORS.button, () => act.claimTask(i), 44);
      b.position.set(270, 0);
      b.addChild(gem(new Graphics(), -b.text.width / 2 + 4, 0, 24));
      b.setEnabled(taskDone(task));
      r.addChild(b);
    }
    box.addChild(r);
  });
  return panel;
}

/** One hero: its level, the skill cards it starts with and what each milestone unlocks. */
function heroPanel(m: MetaSave, act: HomeActions, kind: HeroKind): Container {
  const h = 1240;
  const { panel, box } = frame(act, t(`hero.${kind}`), h);
  const lv = m.heroes[kind];
  const top = -h / 2;
  const tex = ultimateTexture(kind);
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(220 / Math.max(tex.width, tex.height));
    s.position.set(-300, top + 260);
    box.addChild(s);
  }
  const level = label(`Lv ${lv} / ${BALANCE.meta.heroMax}`, 56, { fill: COLORS.gold });
  level.anchor.set(0, 0.5);
  level.position.set(-150, top + 220);
  const dmg = label(t('heroDamage', { p: Math.round(BALANCE.meta.heroDamage * 100), n: Math.round((heroDamage(lv) - 1) * 100) }), 34, { fill: DESC });
  dmg.anchor.set(0, 0.5);
  dmg.position.set(-150, top + 300);
  box.addChild(level, dmg);

  const head = label(t('baseCards'), 38, { fill: COLORS.gold });
  head.position.set(0, top + 420);
  const cards = label(baseSkills(kind).map((id) => t(`skill.${id}.name`)).join('  ·  '), 40);
  cards.position.set(0, top + 480);
  box.addChild(head, cards);

  MILESTONES[kind].forEach((ms, i) => {
    const on = lv >= ms.level;
    const r = new Container();
    r.position.set(0, top + 620 + i * 150);
    r.addChild(new Graphics().roundRect(-430, -66, 860, 132, 22).fill(on ? 0x2a4868 : 0x16263a).stroke({ width: 5, color: on ? COLORS.gold : 0x0e0c12 }));
    const lvTag = label(`Lv.${ms.level}`, 38, { fill: on ? COLORS.gold : DESC });
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
    const a = label(what, 34, { wordWrap: true, breakWords: true, wordWrapWidth: 580, align: 'left' });
    a.anchor.set(0, 0);
    text.addChild(a);
    if (detail) {
      const d = label(detail, 26, { fill: DESC, wordWrap: true, breakWords: true, wordWrapWidth: 580, align: 'left' });
      d.anchor.set(0, 0);
      d.y = a.height + 4;
      text.addChild(d);
    }
    text.position.set(-260, -text.height / 2);
    r.addChild(lvTag, text);
    if (on) {
      const tick = label('✓', 48, { fill: 0x7ed957 });
      tick.position.set(380, 0);
      r.addChild(tick);
    } else {
      r.addChild(
        new Graphics()
          .roundRect(358, -24, 44, 24, 6) // shackle, half hidden by the body
          .stroke({ width: 7, color: DESC })
          .roundRect(350, -8, 60, 42, 8)
          .fill(DESC)
          .circle(380, 10, 6)
          .fill(0x16263a),
      );
    }
    if (!on) r.alpha = 0.75;
    box.addChild(r);
  });
  return panel;
}

function section(root: Container, text: string, y: number): void {
  const head = label(text, 50, { fill: COLORS.gold });
  head.position.set(DESIGN_W / 2, y);
  const w = head.width / 2 + 30;
  const rule = new Graphics()
    .moveTo(DESIGN_W / 2 - ROW.w / 2, y)
    .lineTo(DESIGN_W / 2 - w, y)
    .moveTo(DESIGN_W / 2 + w, y)
    .lineTo(DESIGN_W / 2 + ROW.w / 2, y)
    .stroke({ width: 4, color: COLORS.gold, alpha: 0.5 });
  root.addChild(rule, head);
}

/** One upgrade: icon, name, what it gives now, and a buy button with its price (or MAX). */
function row(root: Container, y: number, icon: Container, name: string, desc: string, cost: number | null, crystals: number, onBuy: () => void): Container {
  const r = new Container();
  r.position.set(DESIGN_W / 2, y);
  const bg = new Graphics()
    .roundRect(-ROW.w / 2, -ROW.h / 2, ROW.w, ROW.h, 28)
    .fill(COLORS.card)
    .stroke({ width: 5, color: 0x0e0c12 });
  icon.position.set(-ROW.w / 2 + 80, 0);
  const n = label(name, 44);
  n.anchor.set(0, 0.5);
  n.position.set(-ROW.w / 2 + 160, -24);
  const d = label(desc, 32, { fill: DESC });
  d.anchor.set(0, 0.5);
  d.position.set(-ROW.w / 2 + 160, 28);
  r.addChild(bg, icon, n, d);
  if (cost === null) {
    const max = label(t('maxed'), 44, { fill: COLORS.gold });
    max.position.set(ROW.w / 2 - 140, 0);
    r.addChild(max);
  } else {
    const buy = new Button(`   ${cost}`, 240, 96, 0x7a4fd0, onBuy, 44);
    buy.position.set(ROW.w / 2 - 140, 0);
    buy.addChild(gem(new Graphics(), -buy.text.width / 2 + 4, 0, 24));
    buy.setEnabled(crystals >= cost);
    r.addChild(buy);
  }
  root.addChild(r);
  return r;
}

function shopIcon(id: WorkshopId): Container {
  const g = new Graphics();
  if (id === 'wall') {
    slab(g, -46, -30, 92, 30, 0);
    slab(g, -46, 0, 92, 30, 1);
  } else if (id === 'startGold') {
    for (const [x, y] of [[-14, 14], [16, 10], [0, -12]]) g.circle(x, y, 26).fill(COLORS.gold).stroke({ width: 5, color: 0x0e0c12 });
  } else {
    gem(g, 0, 0, 40);
  }
  return g;
}
