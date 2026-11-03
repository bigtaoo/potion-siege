// The pill button with the ad sign in front of its caption, for the rewarded offers.

import { Graphics } from 'pixi.js';
import { P, PillButton, type ButtonKind } from '../kit';
import { gem } from '../ui';

/** A pill button with the ad sign in front of its caption, which says what the ad pays; with
 *  `crystals` the caption is their count, the gem after it. The caption shrinks to leave them
 *  their room. */
export function adButton(caption: string, w: number, h: number, kind: ButtonKind, onTap: () => void, size: number, crystals = false): PillButton {
  const b = new PillButton(caption, w, h, kind, onTap, size);
  const text = b.children[1];
  const r = size * 0.42; // the gem's
  const after = crystals ? 2 * r + 10 : 0;
  // the pill fitted it to the whole button; the sign takes some of that (fit() would read the
  // already shrunk width as the full one)
  const room = w - h * 0.6 - 68 - after;
  if (text.width > room) text.scale.set((text.scale.x * room) / text.width);
  text.x = 34 - after / 2;
  const ad = adSign();
  ad.position.set(text.x - text.width / 2 - 48, -4);
  b.addChild(ad);
  if (crystals) b.addChild(gem(new Graphics(), text.x + text.width / 2 + 10 + r, -4, r));
  return b;
}

/** The sign for "watch an ad": a little screen with a play arrow. */
function adSign(): Graphics {
  return new Graphics()
    .roundRect(-30, -22, 60, 44, 10)
    .fill(0xffd34d)
    .stroke({ width: 4, color: P.line })
    .poly([-8, -11, -8, 11, 12, 0])
    .fill(P.line);
}
