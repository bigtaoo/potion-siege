// A chapter's star chests on its row in the chapters panel: a bar of the stars won on its normal
// stages with a notch at each tier, and at its end the button that opens the tiers reached, or
// what the next one pays, or that all three are open.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { CHAPTER_SIZE } from '../../sim/chapters';
import type { MetaSave } from '../../sim/meta';
import { chapterStars } from '../../sim/stars';
import { nextStarChest, STAR_CHESTS, starChestsOpened, starChestsWaiting } from '../../sim/starChest';
import { chestIcon, ink, LIGHT, P, PillButton, redDot } from '../kit';
import { gem } from '../ui';
import type { HomeActions } from './types';

const BAR_X = -400;
const BAR_W = 520;
const BAR_H = 24;

/** The bar and its end, as one row centred on y = 0, from x -400 to 400. */
export function starChestBar(m: MetaSave, act: HomeActions, ch: number): Container {
  const c = new Container();
  c.label = `starChests_${ch}`;
  const max = 3 * CHAPTER_SIZE;
  const stars = chapterStars(m, ch);
  const opened = starChestsOpened(m, ch);
  const bar = new Graphics().roundRect(BAR_X, -BAR_H / 2, BAR_W, BAR_H, BAR_H / 2).fill(LIGHT.face).stroke({ width: 3, color: LIGHT.insetEdge });
  const fill = Math.min(1, stars / max) * BAR_W;
  if (fill > 0) bar.roundRect(BAR_X, -BAR_H / 2, Math.max(BAR_H, fill), BAR_H, BAR_H / 2).fill(P.brass).stroke({ width: 3, color: P.line });
  c.addChild(bar);
  STAR_CHESTS.forEach((tier, i) => {
    const x = BAR_X + (tier.stars / max) * BAR_W;
    const reached = stars >= tier.stars;
    const icon = chestIcon();
    icon.scale.set(0.3);
    icon.position.set(Math.min(x, BAR_X + BAR_W - 20), -2);
    if (i < opened) icon.alpha = 0.45;
    else if (!reached) icon.alpha = 0.7;
    const n = ink(`★${tier.stars}`, 22, { fill: reached ? P.brassDark : P.inkSoft, fontWeight: '900' });
    n.position.set(icon.x, 30);
    c.addChild(icon, n);
  });
  const end = 290;
  const waiting = starChestsWaiting(m, ch);
  if (waiting > 0) {
    const b: PillButton = new PillButton(t('chapter.chestOpen'), 190, 64, 'green', () => act.claimStarChest(ch, b), 32);
    b.label = 'star_chest';
    b.position.set(end + 10, 0);
    c.addChild(b);
    redDot(c, end + 100, -30);
    return c;
  }
  const next = nextStarChest(m, ch);
  if (!next) {
    const done = ink(t('chapter.chestDone'), 30, { fill: P.inkSoft, fontWeight: '900' });
    done.position.set(end + 10, 0);
    c.addChild(done);
    return c;
  }
  const g = gem(new Graphics(), end - 40, 0, 20);
  const n = ink(String(next.reward), 30, { fill: LIGHT.crystal, fontWeight: '900' });
  n.anchor.set(0, 0.5);
  n.position.set(end - 14, 0);
  c.addChild(g, n);
  return c;
}
