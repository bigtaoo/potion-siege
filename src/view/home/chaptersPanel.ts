// The chapters panel over the home screen: a row per chapter with its chest and its stages.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import {
  CHAPTER_COUNT, chapterChest, CHAPTER_SIZE, chapterOpen, chapterProgress, chapterStages, chestWaiting, isFinale, stageTwists,
} from '../../sim/chapters';
import { maxStage, type MetaSave } from '../../sim/meta';
import { chestIcon, fit as fitText, ink, LIGHT, lightTile, lock, P, PillButton, redDot, tappable } from '../kit';
import { gem, label } from '../ui';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import { chapterTitle } from './shared';
import type { HomeActions } from './types';

/** The five chapters, a row each: the name, the one-time chest (its button once every stage is
 *  cleared) and a tile a stage - cleared ones brass, the finale red, the chosen one ringed, a dot
 *  on a stage with a twist; a chapter not open yet says what opens it. Tapping an open stage
 *  picks it. */
export function chaptersPanel(m: MetaSave, act: HomeActions, fit: MenuFit): Container {
  const rowH = 186;
  const h = CHAPTER_COUNT * (rowH + 14) + 130;
  const { panel, box } = frame(act, t('chapter.panel'), h, fit);
  const top = -h / 2 + 90;
  for (let ch = 1; ch <= CHAPTER_COUNT; ch++) {
    const r = new Container();
    r.position.set(0, top + (ch - 1) * (rowH + 14) + rowH / 2);
    box.addChild(r);
    r.addChild(lightTile(860, rowH, 26));
    const open = chapterOpen(m, ch);
    const [first] = chapterStages(ch);
    const name = ink(chapterTitle(ch), 38, { fontWeight: '900' });
    name.anchor.set(0, 0.5);
    name.position.set(-400, -50);
    fitText(name, 470);
    r.addChild(name);
    const waiting = chestWaiting(m, ch);
    const opened = m.chapterChests.includes(ch);
    const icon = chestIcon();
    icon.scale.set(0.5);
    icon.position.set(130, -46);
    if (!waiting && !opened) icon.alpha = 0.55;
    r.addChild(icon);
    if (waiting) {
      const b: PillButton = new PillButton(t('chapter.chestOpen'), 210, 72, 'green', () => act.claimChapter(ch, b), 36);
      b.position.set(290, -50);
      r.addChild(b);
      redDot(r, 392, -82);
    } else if (opened) {
      const done = ink(t('chapter.chestDone'), 32, { fill: P.inkSoft, fontWeight: '900' });
      done.anchor.set(0, 0.5);
      done.position.set(180, -50);
      r.addChild(done);
    } else {
      const g = gem(new Graphics(), 196, -50, 22);
      const n = ink(String(chapterChest(ch)), 32, { fill: LIGHT.crystal, fontWeight: '900' });
      n.anchor.set(0, 0.5);
      n.position.set(224, -50);
      const c = ink(`${chapterProgress(m, ch)}/${CHAPTER_SIZE}`, 32, { fill: P.inkSoft, fontWeight: '900' });
      c.anchor.set(1, 0.5);
      c.position.set(400, -50);
      r.addChild(g, n, c);
    }
    if (!open) {
      name.alpha = 0.6;
      const text = ink(t('chapter.locked', { n: first - 1 }), 34, { fill: P.inkSoft, fontWeight: '900' });
      text.position.set(24, 36);
      const l = lock();
      l.scale.set(0.6);
      l.position.set(text.x - text.width / 2 - 36, 36);
      r.addChild(text, l);
      continue;
    }
    for (let i = 0; i < CHAPTER_SIZE; i++) {
      const stage = first + i;
      const can = stage <= maxStage(m);
      const tile = tappable(new Container(), () => can && act.pickStage(stage));
      tile.position.set(-351 + i * 78, 36);
      const finale = isFinale(stage);
      const cleared = stage <= m.cleared;
      const g = new Graphics().roundRect(-34, -34, 68, 68, 16).fill(cleared ? (finale ? 0xd0644f : P.brass) : LIGHT.face).stroke({ width: 4, color: P.line });
      if (stage === m.stage) g.roundRect(-42, -42, 84, 84, 22).stroke({ width: 6, color: P.red });
      const n = cleared ? label(String(stage), 30, { stroke: { color: P.line, width: 5 } }) : ink(String(stage), 30, { fill: P.inkSoft, fontWeight: '900' });
      tile.addChild(g, n);
      if (stageTwists(stage).length > 0) tile.addChild(new Graphics().circle(26, -26, 9).fill(finale ? P.red : P.brassDark).stroke({ width: 3, color: P.line }));
      if (!can) tile.alpha = 0.45;
      r.addChild(tile);
    }
  }
  return panel;
}
