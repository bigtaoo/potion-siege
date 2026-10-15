// The home screen between battles: the crystals, the stage to fight, the potions to level up,
// the workshop upgrades and the button into battle. Built afresh after every purchase.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../i18n';
import { heroCost, heroDamage, LEVELLED_HEROES, maxStage, stageHp, WORKSHOP_IDS, workshopCost, workshopValue, type MetaSave, type WorkshopId } from '../sim/meta';
import type { HeroKind } from '../sim/types';
import { ultimateTexture } from './art';
import { slab } from './stone';
import { Button, COLORS, gem, HERO_COLORS, label } from './ui';
import { DESIGN_W } from './viewport';

export interface HomeActions {
  stage(delta: number): void;
  hero(kind: HeroKind): void;
  workshop(id: WorkshopId): void;
  play(): void;
}

const ROW = { w: 960, h: 124, gap: 140 };
const DESC = 0xcfe0f0;

export function buildHome(m: MetaSave, act: HomeActions): Container {
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
    row(root, 570 + i * ROW.gap, icon, t(`hero.${kind}`), desc, heroCost(lv), m.crystals, () => act.hero(kind));
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
  return root;
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
function row(root: Container, y: number, icon: Container, name: string, desc: string, cost: number | null, crystals: number, onBuy: () => void): void {
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
