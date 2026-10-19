// The pill button with the ad sign in front of its caption, for the rewarded offers.

import { Graphics } from 'pixi.js';
import { P, PillButton, type ButtonKind } from '../kit';

/** A pill button with the ad sign in front of its caption. */
export function adButton(caption: string, w: number, h: number, kind: ButtonKind, onTap: () => void, size: number): PillButton {
  const b = new PillButton(caption, w, h, kind, onTap, size);
  const text = b.children[1];
  text.x = 34;
  const ad = adSign();
  ad.position.set(-text.width / 2 - 14, -4);
  b.addChild(ad);
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
