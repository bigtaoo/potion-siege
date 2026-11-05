// The week's panel (sim/week.ts), from the round button on the battle tab: this week's tower rule
// and what it does, the days left and the best floor, the weekly tasks with their bars and claim
// buttons, and a button into the tower.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import type { MetaSave } from '../../sim/meta';
import { daysLeft, weekGoal, weekProgress, weekReward, weekRule, weekTasks, type WeekRule } from '../../sim/week';
import { fit as fitText, ink, inkWrapped, LIGHT, lightTile, P, PillButton } from '../kit';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import type { HomeActions } from './types';

/** The rule's name, and what it does, the focus naming its reaction. */
export function ruleName(rule: WeekRule): string {
  return t(`alchemy.week.${rule.id}.name`);
}

export function ruleDesc(rule: WeekRule): string {
  return t(`alchemy.week.${rule.id}.desc`, { name: t(`codex.rx.${rule.reaction}`) });
}

export function weekPanel(m: MetaSave, act: HomeActions, today: string, towerOpen: boolean, fit: MenuFit): Container {
  const w = m.alchemy.week;
  const rule = weekRule(w.id);
  const tasks = weekTasks(towerOpen);
  const RH = 150;
  const h = 560 + tasks.length * (RH + 18) + (towerOpen ? 160 : 0);
  const { panel, box } = frame(act, t('alchemy.week.title'), h, fit);
  let y = -h / 2 + 130;
  const name = fitText(ink(t('alchemy.week.rule', { name: ruleName(rule) }), 44, { fill: P.brassDark, fontWeight: '900' }), 840);
  name.y = y;
  y += 50;
  const desc = inkWrapped(ruleDesc(rule), 32, 820, { fill: P.ink, lineHeight: 42 });
  desc.anchor.set(0.5, 0);
  desc.y = y;
  y += Math.max(44, desc.height) + 40;
  const left = ink(t('alchemy.week.left', { n: daysLeft(today) }), 30, { fill: P.inkSoft });
  left.y = y;
  y += 46;
  const best = ink(t('alchemy.week.best', { n: w.best }), 32, { fill: P.inkSoft, fontWeight: '900' });
  best.y = y;
  box.addChild(name, desc, left, best);
  y += 60;
  const RW = 860;
  for (const id of tasks) {
    const row = new Container();
    row.label = `week_${id}`;
    row.position.set(0, y + RH / 2);
    row.addChild(lightTile(RW, RH, 22));
    const goal = weekGoal(id);
    const n = weekProgress(m, id);
    const text = fitText(ink(t(`alchemy.week.task.${id}`, { n: goal }), 32, { fill: P.ink, fontWeight: '900' }), 540);
    text.anchor.set(0, 0.5);
    text.position.set(-RW / 2 + 30, -30);
    const bw = 400;
    const bar = new Graphics()
      .roundRect(-RW / 2 + 30, 14, bw, 26, 13)
      .fill(LIGHT.inset)
      .stroke({ width: 3, color: LIGHT.insetEdge });
    if (n > 0) bar.roundRect(-RW / 2 + 30, 14, Math.max(26, (bw * n) / goal), 26, 13).fill(P.brass);
    const count = ink(`${n}/${goal}`, 26, { fill: P.inkSoft });
    count.anchor.set(0, 0.5);
    count.position.set(-RW / 2 + 30 + bw + 16, 27);
    row.addChild(text, bar, count);
    const claimed = w.claimed.includes(id);
    if (claimed) {
      const tick = ink('✓', 56, { fill: P.green, fontWeight: '900' });
      tick.x = RW / 2 - 120;
      row.addChild(tick);
    } else {
      const b = new PillButton(String(weekReward(id)), 210, 90, n >= goal ? 'green' : 'purple', () => act.claimWeek(id, b), 38, true).setEnabled(n >= goal);
      b.position.set(RW / 2 - 130, 0);
      b.label = `claimWeek_${id}`;
      row.addChild(b);
    }
    box.addChild(row);
    y += RH + 18;
  }
  if (towerOpen) {
    const go = new PillButton(t('alchemy.week.play'), 520, 120, 'green', act.endless, 48);
    go.label = 'weekClimb';
    go.y = y + 80;
    box.addChild(go);
  }
  return panel;
}
