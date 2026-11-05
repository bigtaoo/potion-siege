// The battle tab's "next thing" line (plan 6): one short pill over the fight button that names the
// one goal worth chasing now and goes to it. Past the first chapter only, so the first battles
// keep their plain screen; the first match in order wins.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { endlessOpen } from '../../sim/endless';
import type { MetaSave } from '../../sim/meta';
import { canRebrew, essenceFor, perkCost, PERK_IDS } from '../../sim/rebrew';
import { BALANCE, REACTION_IDS } from '../../sim/types';
import { weekBest, weekClaimable, weekOf, weekRule } from '../../sim/week';
import { fit as fitText, LIGHT, P, tappable } from '../kit';
import { label } from '../ui';
import type { HomeActions } from './types';
import { ruleName } from './weekPanel';

/** From this many stages cleared (or after a rebrew) the line shows. */
export const NEXT_FROM = 10;

export type NextThing = { text: string; go: 'rebrew' | 'week' | 'codex' | 'endless' };

export function nextThing(m: MetaSave, today: string): NextThing | null {
  const r = m.alchemy.rebrew;
  if (m.cleared < NEXT_FROM && r.count === 0) return null;
  const tower = endlessOpen(m);
  if (canRebrew(m) && m.cleared >= BALANCE.meta.stageCount) return { text: t('alchemy.next.rebrew', { n: essenceFor(m) }), go: 'rebrew' };
  if (PERK_IDS.some((id) => (perkCost(id, r.perks[id]) ?? Infinity) <= r.essence)) return { text: t('alchemy.next.perk', { n: r.essence }), go: 'rebrew' };
  if (weekClaimable(m, tower)) return { text: t('alchemy.next.week'), go: 'week' };
  const found = REACTION_IDS.filter((id) => m.achievements.stats.reactions[id] > 0).length;
  if (found > 0 && found < REACTION_IDS.length) return { text: t('alchemy.next.find', { n: REACTION_IDS.length - found }), go: 'codex' };
  if (tower) return { text: t('alchemy.next.tower', { name: ruleName(weekRule(weekOf(today))), n: weekBest(m, today) }), go: 'endless' };
  return null;
}

/** How tall the pill is, for the room it takes from the commander. */
export const NEXT_H = 56;

export function nextCard(root: Container, next: NextThing, act: HomeActions, x: number, y: number, maxW: number): void {
  const c = tappable(new Container(), () => (next.go === 'codex' ? act.tab('codex') : next.go === 'endless' ? act.panel('week') : act.panel(next.go)));
  c.label = 'nextCard';
  c.position.set(x, y);
  const text = fitText(label(`▶ ${next.text}`, 30, { stroke: { color: P.line, width: 5 } }), maxW - 48);
  const w = text.width + 48;
  c.addChild(new Graphics().roundRect(-w / 2, -NEXT_H / 2, w, NEXT_H, NEXT_H / 2).fill(P.brassDark).stroke({ width: 3, color: LIGHT.edge }), text);
  root.addChild(c);
}
