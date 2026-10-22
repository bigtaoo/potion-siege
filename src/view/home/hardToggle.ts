// The battle tab's stars and hard mode: the chosen stage's best stars hanging under its plate,
// and the normal / hard switch under the stage card once the first chapter is cleared.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { CHAPTER_SIZE } from '../../sim/chapters';
import type { MetaSave } from '../../sim/meta';
import { STARS, stageStars } from '../../sim/stars';
import { fit as fitText, ink, LIGHT, P, refuse, starRow, tappable } from '../kit';
import { label } from '../ui';
import type { HomeActions } from './types';

/** The switch's height, and the room it takes under the stage card. */
export const TOGGLE_H = 60;
export const TOGGLE_ROOM = TOGGLE_H + 24;

/** The switch shows once the first chapter is cleared, before any hard mode can be open. */
export function toggleShown(m: MetaSave): boolean {
  return m.cleared >= CHAPTER_SIZE;
}

/** The stage's best stars, small on a dark pill, to hang under the stage plate at (x, y). */
export function plateStars(root: Container, m: MetaSave, x: number, y: number): void {
  const hard = m.stars.hardMode;
  const c = new Container();
  c.position.set(x, y);
  c.addChild(new Graphics().roundRect(-62, -19, 124, 38, 19).fill({ color: P.line, alpha: 0.75 }), starRow(stageStars(m, m.stage, hard), 15, hard));
  root.addChild(c);
}

/** Two halves, normal and hard, the one on lit. Tapping hard while no chapter's hard mode is
 *  open shakes the switch and says what opens it. */
export function hardToggle(root: Container, m: MetaSave, act: HomeActions, x: number, y: number): void {
  const w = 420;
  const c = new Container();
  c.position.set(x, y);
  c.addChild(new Graphics().roundRect(-w / 2, -TOGGLE_H / 2, w, TOGGLE_H, TOGGLE_H / 2).fill(LIGHT.face).stroke({ width: 4, color: LIGHT.edge }));
  const half = (hard: boolean) => {
    const on = m.stars.hardMode === hard;
    const side = tappable(new Container(), () => {
      if (on) return;
      if (!act.hardMode(hard)) refuse(c, t('stars.locked', { n: STARS.unlock }));
    });
    side.x = ((hard ? 1 : -1) * w) / 4;
    const hw = w / 2 - 10;
    if (on) side.addChild(new Graphics().roundRect(-hw / 2, -TOGGLE_H / 2 + 6, hw, TOGGLE_H - 12, (TOGGLE_H - 12) / 2).fill(hard ? 0xc9463d : P.brass).stroke({ width: 3, color: P.line }));
    else side.addChild(new Graphics().roundRect(-hw / 2, -TOGGLE_H / 2 + 6, hw, TOGGLE_H - 12, (TOGGLE_H - 12) / 2).fill({ color: 0xffffff, alpha: 0.001 }));
    const word = t(hard ? 'stars.hard' : 'stars.normal');
    const text = on ? label(word, 30, { stroke: { color: P.line, width: 5 } }) : ink(word, 30, { fill: P.inkSoft, fontWeight: '900' });
    side.addChild(fitText(text, hw - 24));
    c.addChild(side);
  };
  half(false);
  half(true);
  root.addChild(c);
}
