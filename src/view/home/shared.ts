// Small pieces more than one home tab or panel draws: the area a tab fills, the tick, the
// crystal-price button, the rewarded-ad icon, a chapter's title, the countdown to midnight and a
// round button's caption.

import { Container, Graphics, type Text } from 'pixi.js';
import { t, type TextKey } from '../../i18n';
import { msToTomorrow } from '../../sim/challenge';
import { chapterInfo } from '../../sim/chapters';
import { fit, ink, inkWrapped, LIGHT, P, refuse, type PillButton } from '../kit';
import { label } from '../ui';

/** The part of the page a tab fills. */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
  wide: boolean;
}

/** A green tick in a circle, for something done or owned. */
export function tick(r: number): Container {
  const c = new Container();
  c.addChild(new Graphics().circle(0, 0, r).fill(P.green).stroke({ width: 4, color: LIGHT.edge }), label('✓', r * 1.25, { stroke: { color: LIGHT.edge, width: 5 } }));
  return c;
}

/** A day's gift tile once claimed, sunk into the panel and tinted green, so it reads as done
 *  at a glance next to the raised tiles still to come. */
export function claimedTile(w: number, h: number): Graphics {
  const x = -w / 2;
  const y = -h / 2 + 6;
  return new Graphics()
    .roundRect(x, y, w, h - 6, 24)
    .fill(LIGHT.tileLip)
    .roundRect(x, y, w, h - 6, 24)
    .fill({ color: P.green, alpha: 0.28 })
    .stroke({ width: 5, color: P.greenDark });
}

/** Marks a claimed tile: what it gave faded under a big tick, and `Claimed` in place of
 *  `amount` (what the tile gave, at its foot). */
export function markClaimed(tile: Container, amount: Text): void {
  for (const c of tile.children.slice(1)) c.alpha = 0.3;
  amount.visible = false;
  const done = tick(46);
  done.position.set(0, -6);
  const word = ink(t('claimed'), 32, { fill: P.greenInk });
  word.position.set(0, 74);
  tile.addChild(done, word);
}

/** A crystal-price button, off while the crystals fall short; a tap on it then says so. */
export function priced(b: PillButton, affordable: boolean): PillButton {
  return b.setEnabled(affordable).whenOff(() => refuse(b, t('noCrystals')));
}

/** A little screen with a play sign: the rewarded ad. */
export function adIcon(): Graphics {
  return new Graphics()
    .rect(-14, 34, 28, 12)
    .fill(P.brassDark)
    .roundRect(-30, 42, 60, 12, 5)
    .fill(P.brass)
    .stroke({ width: 3, color: LIGHT.edge })
    .roundRect(-52, -38, 104, 76, 14)
    .fill(P.woodLight)
    .stroke({ width: 5, color: LIGHT.edge })
    .roundRect(-42, -28, 84, 56, 8)
    .fill(0xbfe3f2)
    .poly([-12, -16, 18, 0, -12, 16])
    .fill(P.cream)
    .stroke({ width: 4, color: LIGHT.edge, join: 'round' });
}

export function chapterTitle(ch: number): string {
  return t('chapter.title', { n: ch, name: t(`chapter.name.${chapterInfo(ch).id}` as TextKey) });
}

/** A line counting down to local midnight, when the tasks and the challenge are new: `key`
 *  with the time left as hh:mm:ss. */
export function untilMidnight(key: TextKey, size: number): Text {
  const left = ink('', size, { fill: P.inkSoft });
  let shown = '';
  left.onRender = () => {
    const secs = Math.ceil(msToTomorrow(new Date()) / 1000);
    const p = (v: number) => String(v).padStart(2, '0');
    const text = t(key, { time: `${p(Math.floor(secs / 3600))}:${p(Math.floor(secs / 60) % 60)}:${p(secs % 60)}` });
    if (text !== shown) left.text = shown = text;
  };
  return left;
}

/** The least a caption's one line shrinks before it takes two. */
const CAP_MIN = 0.85;

/** A round button's caption, at most `max` across: one line at `size`, shrunk at most a little;
 *  past that two lines a little smaller (where it has a space to break at), and only then shrunk
 *  to fit. */
export function caption(text: string, max = 128, size = 30): Text {
  const one = ink(text, size);
  if (one.width * CAP_MIN <= max || !text.includes(' ')) return fit(one, max);
  one.destroy();
  return fit(inkWrapped(text, size - 4, max, { lineHeight: size - 2, align: 'center' }), max);
}
