// The home screen's potions tab: a card per potion with its level, milestones and level-up
// button, under the lineup strip while there is a reserve potion.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { benched, heroCost, heroDamage, heroUnlocked, unlockStage, type MetaSave } from '../../sim/meta';
import { MILESTONES } from '../../sim/skills';
import { HERO_KINDS, type HeroKind } from '../../sim/types';
import { bottle, fit as fitText, flask, ink, LIGHT, lock, P, paperCard, PillButton, plate, tappable } from '../kit';
import { HERO_COLORS, label } from '../ui';
import { LINEUP_H, lineupStrip } from './lineup';
import { pointer } from './pointer';
import { priced, type Area } from './shared';
import type { HomeActions } from './types';

/** A card per potion: portrait, level, the milestones reached and the level-up button; over
 *  them the lineup strip while there is a reserve to swap in, else the tab's name. */
export function potionsTab(root: Container, m: MetaSave, act: HomeActions, a: Area, picked: HeroKind | null, hint: HeroKind | null): void {
  const cx = a.x + a.w / 2;
  const swap = benched(m).length > 0;
  if (swap) lineupStrip(root, m, act, picked, cx, a.y + (a.wide ? 40 : 30) + LINEUP_H / 2, Math.min(1000, a.w - 80));
  else {
    const head = plate(t('potions'), 52);
    head.position.set(cx, a.y + 60);
    root.addChild(head);
  }
  // one row of five on a wide page; three over two on a portrait one
  const n = HERO_KINDS.length;
  const cols = a.wide ? n : 3;
  const cw = Math.min(380, (a.w - 60) / cols - 30);
  const ch = a.wide ? 640 : swap ? 625 : 640;
  const y0 = a.y + (swap ? (a.wide ? 270 : 252) : 150);
  const cards = HERO_KINDS.map((kind, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const card = heroCard(m, act, kind, cw, ch);
    card.position.set(cx + (col - (inRow - 1) / 2) * (cw + 30), y0 + ch / 2 + row * (ch + 40));
    root.addChild(card);
    return card;
  });
  // over all the cards: up at the hinted potion's price button from below it
  const i = hint ? HERO_KINDS.indexOf(hint) : -1;
  if (i >= 0) root.addChild(pointer(cards[i].x + cw * 0.22, cards[i].y + ch / 2 - 34, 0, 0.8));
}

function heroCard(m: MetaSave, act: HomeActions, kind: HeroKind, cw: number, ch: number): Container {
  const lv = m.heroes[kind];
  const open = heroUnlocked(m, kind);
  const c = tappable(new Container(), () => act.panel(kind));
  const top = -ch / 2;
  c.addChild(paperCard(cw, ch));
  c.addChild(new Graphics().roundRect(-cw / 2 + 10, top + 10, cw - 20, 84, 18).fill(open ? HERO_COLORS[kind] : P.locked).stroke({ width: 4, color: LIGHT.edge }));
  const name = fitText(label(t(`hero.${kind}`), 42, { stroke: { color: P.line, width: 7 } }), cw - 40);
  name.y = top + 50;
  const size = Math.min(250, cw - 40);
  const glow = new Graphics().circle(0, top + 250, size * 0.48).fill({ color: HERO_COLORS[kind], alpha: open ? 0.18 : 0 });
  const bt = open ? bottle(kind, size) : flask(new Graphics(), 0, size * 0.42, size * 0.84, P.locked);
  bt.y = top + 250;
  c.addChild(name, glow, bt);
  if (!open) {
    const l = lock(P.cream, P.locked);
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
  const dmg = fitText(ink(t('damageNow', { p: Math.round((heroDamage(lv) - 1) * 100) }), 32, { fill: P.inkSoft }), cw - 30);
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
    pip.addChild(ink(String(s.level), 28, { fill: on ? P.line : P.inkSoft }));
    c.addChild(pip);
  });
  const cost = heroCost(lv);
  if (cost === null) {
    const max = ink(t('maxed'), 46, { fill: P.brassDark });
    max.y = ch / 2 - 64;
    c.addChild(max);
  } else {
    const b = priced(new PillButton(String(cost), cw - 90, 84, 'purple', () => act.hero(kind), 42, true), m.crystals >= cost);
    b.y = ch / 2 - 54;
    c.addChild(b);
  }
  return c;
}
