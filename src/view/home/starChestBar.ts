// A chapter's star chests on its row in the chapters panel: a bar of the stars won on its normal
// stages with a notch at each tier, what the next one pays under its notch (apart from the
// chapter's own chest on the name line), and at the bar's end the button that opens the tiers
// reached, or a tick once all three are open.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { CHAPTER_SIZE } from '../../sim/chapters';
import type { MetaSave } from '../../sim/meta';
import { chapterStars } from '../../sim/stars';
import { nextStarChest, STAR_CHESTS, starChestsOpened, starChestsWaiting } from '../../sim/starChest';
import { chestIcon, ink, LIGHT, P, PillButton, redDot, starIcon, tickMark } from '../kit';
import { gem } from '../ui';
import type { HomeActions } from './types';

/** Puts `icon` (about 100 across before `k`) in front of a `w` by `h` pill button's caption,
 *  the pair centred, the caption shrunk to make room where it must. */
export function leadIcon(b: PillButton, icon: Container, w: number, h: number, k: number): void {
  const text = b.children[1] as Container;
  const room = w - h * 0.6 - 100 * k - 6;
  if (text.width > room) text.scale.set((text.scale.x * room) / text.width);
  const span = 100 * k + 6 + text.width;
  icon.scale.set(k);
  icon.position.set(-span / 2 + 50 * k, -4);
  text.x = span / 2 - text.width / 2;
  b.addChild(icon);
}

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
  const next = nextStarChest(m, ch);
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
    // the next tier's pay, beside its star count
    if (tier !== next || reached) return;
    n.x -= 34;
    const gx = n.x + n.width / 2 + 16;
    const g = gem(new Graphics(), gx, 30, 12);
    const pay = ink(String(tier.reward), 22, { fill: LIGHT.crystal, fontWeight: '900' });
    pay.anchor.set(0, 0.5);
    pay.position.set(gx + 16, 30);
    c.addChild(g, pay);
  });
  const end = 290;
  const waiting = starChestsWaiting(m, ch);
  if (waiting > 0) {
    const b: PillButton = new PillButton(t('chapter.chestOpen'), 190, 64, 'green', () => act.claimStarChest(ch, b), 32);
    // a star on it, where the chapter's own chest button has a chest
    leadIcon(b, starIcon(), 190, 64, 0.6);
    b.label = 'star_chest';
    b.position.set(end + 10, 0);
    c.addChild(b);
    redDot(c, end + 100, -30);
  } else if (!next) {
    const tick = tickMark();
    tick.label = 'star_chests_done';
    tick.position.set(BAR_X + BAR_W + 40, 0);
    c.addChild(tick);
  }
  return c;
}
