// One potion's card on the potions tab: its name, what it does, the bottle, its level and the
// next milestone, the milestones as pips and the level-up button. The fielded four are framed,
// the rest dimmed; the one worth levelling first wears a corner badge.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { heroCost, heroUnlocked, unlockStage, type MetaSave } from '../../sim/meta';
import { MILESTONES } from '../../sim/skills';
import type { HeroKind } from '../../sim/types';
import { bottle, fit as fitText, flask, ink, LIGHT, lock, P, paperCard, PillButton, tappable } from '../kit';
import { HERO_COLORS, label } from '../ui';
import { perkText } from './perkText';
import { nextMilestone } from './potionPick';
import { priced } from './shared';
import type { HomeActions } from './types';

/** How a benched potion's card fades next to the fielded four. */
export const BENCH_ALPHA = 0.72;

export function heroCard(m: MetaSave, act: HomeActions, kind: HeroKind, cw: number, ch: number, pick: boolean): Container {
  const lv = m.heroes[kind];
  const open = heroUnlocked(m, kind);
  const fielded = m.lineup.includes(kind);
  const c = tappable(new Container(), () => act.panel(kind));
  c.label = `hero_${kind}`;
  const top = -ch / 2;
  c.addChild(paperCard(cw, ch));
  if (fielded) c.addChild(new Graphics().roundRect(-cw / 2 - 6, top - 6, cw + 12, ch + 12, 32).stroke({ width: 8, color: P.brass }));
  c.addChild(new Graphics().roundRect(-cw / 2 + 10, top + 10, cw - 20, 84, 18).fill(open ? HERO_COLORS[kind] : P.locked).stroke({ width: 4, color: LIGHT.edge }));
  const name = fitText(label(t(`hero.${kind}`), 42, { stroke: { color: P.line, width: 7 } }), cw - 40);
  name.y = top + 50;
  const role = fitText(ink(t(`role.${kind}`), 28, { fill: P.inkSoft, fontWeight: '900' }), cw - 40);
  role.y = top + 124;
  const size = Math.min(220, cw - 60);
  const glow = new Graphics().circle(0, top + 262, size * 0.48).fill({ color: HERO_COLORS[kind], alpha: open ? 0.18 : 0 });
  const bt = open ? bottle(kind, size) : flask(new Graphics(), 0, size * 0.42, size * 0.84, P.locked);
  bt.y = top + 262;
  c.addChild(name, role, glow, bt);
  if (!open) {
    const l = lock(P.cream, P.locked);
    l.scale.set(1.4);
    l.y = top + 280;
    const at = unlockStage(kind);
    const note = fitText(ink(at ? t('unlockAt', { n: at }) : t('codex.locked'), 36, { fill: P.inkSoft }), cw - 40);
    note.y = top + 440;
    c.addChild(l, note);
    c.alpha = 0.85;
    return c;
  }
  const level = ink(t('level', { n: lv }), 50);
  level.y = top + 404;
  c.addChild(level);
  const next = nextMilestone(m, kind);
  if (next) {
    const what = 'perk' in next ? perkText(next.perk) : t(`skill.${next.skill}.name`);
    const line = fitText(ink(t('nextUnlock', { n: next.level, what }), 28, { fill: P.greenInk, fontWeight: '900' }), cw - 30);
    line.y = top + 452;
    c.addChild(line);
  }
  // the milestones as pips, lit once reached
  const ms = MILESTONES[kind];
  const gap = Math.min(76, (cw - 24) / Math.max(1, ms.length));
  const pw = Math.min(64, gap - 5);
  ms.forEach((s, i) => {
    const on = lv >= s.level;
    const pip = new Container();
    pip.position.set((i - (ms.length - 1) / 2) * gap, top + 504);
    pip.addChild(new Graphics().roundRect(-pw / 2, -18, pw, 36, 10).fill(on ? P.brass : P.paperDark).stroke({ width: 3, color: on ? P.line : P.inkSoft }));
    pip.addChild(fitText(ink(String(s.level), 24, { fill: on ? P.line : P.inkSoft }), pw - 4));
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
  if (pick) c.addChild(pickBadge(cw / 2 - 14, top + 14));
  if (!fielded) c.alpha = BENCH_ALPHA;
  return c;
}

/** The corner badge on the potion worth levelling first: a green tag tilted over the corner. */
function pickBadge(x: number, y: number): Container {
  const b = new Container();
  b.label = 'topPick';
  b.position.set(x, y);
  b.rotation = 0.22;
  const tx = fitText(label(t('topPick'), 26, { stroke: { color: P.line, width: 5 } }), 170);
  const w = tx.width + 30;
  b.addChild(new Graphics().roundRect(-w / 2, -21, w, 42, 21).fill(P.green).stroke({ width: 4, color: P.line }), tx);
  return b;
}
