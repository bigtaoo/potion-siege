// The daily tasks panel over the home screen: today's three tasks and the bonus for all three.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { ALL_DONE_BONUS, bonusReady, taskDone, taskGoal, taskReward } from '../../sim/daily';
import type { MetaSave } from '../../sim/meta';
import { chestIcon, fit as fitText, ink, lightTile, P, paperCard, PillButton } from '../kit';
import { label } from '../ui';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import type { HomeActions } from './types';

/** Today's three tasks: what to do, how far along, and the claim button; then the bonus for
 *  claiming all three. */
export function tasksPanel(m: MetaSave, act: HomeActions, fit: MenuFit): Container {
  const h = 870;
  const { panel, box } = frame(act, t('tasks'), h, fit);
  m.daily.tasks.forEach((task, i) => {
    const r = new Container();
    r.position.set(0, -255 + i * 190);
    const goal = taskGoal(task.id);
    const desc = ink(t(`task.${task.id}`, { n: goal }), 40);
    desc.anchor.set(0, 0.5);
    desc.position.set(-400, -36);
    const frac = Math.min(1, task.progress / goal);
    const bar = new Graphics()
      .roundRect(-400, 14, 420, 34, 17)
      .fill(P.paperDark)
      .roundRect(-400, 14, Math.max(34, 420 * frac), 34, 17)
      .fill({ color: P.green, alpha: frac > 0 ? 1 : 0 })
      .roundRect(-400, 14, 420, 34, 17)
      .stroke({ width: 4, color: P.line });
    const count = label(`${task.progress}/${goal}`, 32, { stroke: { color: P.line, width: 6 } });
    count.position.set(-190, 31);
    r.addChild(lightTile(860, 160), desc, bar, count);
    if (task.claimed) {
      const c = ink(t('claimed'), 40, { fill: P.inkSoft });
      c.position.set(270, 0);
      r.addChild(c);
    } else {
      const b: PillButton = new PillButton(String(taskReward(task.id)), 250, 100, 'green', () => act.claimTask(i, b), 44, true).setEnabled(taskDone(task));
      b.position.set(270, -4);
      r.addChild(b);
    }
    box.addChild(r);
  });
  box.addChild(bonusRow(m, act));
  return panel;
}

/** The chest for claiming all of today's tasks: how many are claimed, and its button. */
function bonusRow(m: MetaSave, act: HomeActions): Container {
  const r = new Container();
  r.position.set(0, 330);
  const icon = chestIcon();
  icon.scale.set(0.8);
  icon.position.set(-360, 0);
  const n = m.daily.tasks.filter((task) => task.claimed).length;
  // clear of the claim button, which starts at x 145
  const name = fitText(ink(t('allDone'), 40), 415);
  name.anchor.set(0, 0.5);
  name.position.set(-290, -22);
  const sub = ink(t('allDoneCount', { n, total: m.daily.tasks.length }), 30, { fill: P.inkSoft });
  sub.anchor.set(0, 0.5);
  sub.position.set(-290, 28);
  r.addChild(paperCard(860, 140), icon, name, sub);
  if (m.daily.bonus) {
    const c = ink(t('claimed'), 40, { fill: P.inkSoft });
    c.position.set(270, 0);
    r.addChild(c);
  } else {
    const b: PillButton = new PillButton(String(ALL_DONE_BONUS), 250, 100, 'green', () => act.claimBonus(b), 44, true).setEnabled(bonusReady(m));
    b.position.set(270, -4);
    r.addChild(b);
  }
  return r;
}
