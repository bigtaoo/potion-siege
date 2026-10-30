// The first battles' skill pick: a "推荐" tag over the card the board would get most from
// (sim/suggest.ts) and, whenever the cards are left alone a few seconds, a hand tapping it. Only
// a pointer: it never picks, and the battle stays paused under the cards as it always does.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../../i18n';
import { handTexture } from '../art';
import { P } from '../kit';
import { pointingHand } from '../Tutorial';
import { label } from '../ui';

/** Seconds of cards left alone before the hand shows, and one tap's length. */
export const CARD_NUDGE = { after: 5, beat: 1.2 };

/** The hand is up once the cards have been left alone `after` seconds. */
export function nudgeOn(idle: number): boolean {
  return idle >= CARD_NUDGE.after;
}

/** Input that means the player is at the cards: a press, a drag or a key. A mouse only passing
 *  over them is not; on a desktop it never keeps still, and the hand would never come. */
function acting(e: Event): boolean {
  return e.type !== 'pointermove' || ((e as PointerEvent).buttons ?? 0) !== 0;
}

/** Where a tap is at `t` seconds into it: the hand's lift off the card (it comes down onto it
 *  in the first third and rests) and the ring that spreads from the touch, 0 to 1. */
export function tapPose(time: number): { lift: number; ripple: number } {
  const p = (((time % CARD_NUDGE.beat) + CARD_NUDGE.beat) % CARD_NUDGE.beat) / CARD_NUDGE.beat;
  const lift = p < 0.3 ? 1 - p / 0.3 : p < 0.55 ? 0 : (p - 0.55) / 0.45;
  return { lift, ripple: p < 0.3 ? 0 : Math.min(1, (p - 0.3) / 0.5) };
}

/** The green tag on the card's top edge. */
export function topTag(): Container {
  const tag = new Container();
  const text = label(t('topPick'), 34, { stroke: { color: P.line, width: 6 } });
  const tw = Math.max(150, text.width + 44);
  tag.addChild(new Graphics().roundRect(-tw / 2, -27, tw, 54, 27).fill(0x4cc35a).stroke({ width: 5, color: P.line }), text);
  tag.eventMode = 'none';
  return tag;
}

/** The hand over the card at (`x`, `y`) on the pick's box, the fingertip on the card's level pips. */
export class CardNudge extends Container {
  /** Seconds since the pick opened or the player last acted. */
  private idle = 0;
  private readonly hand = new Container();
  private readonly ring = new Graphics();
  private readonly touch = (e: Event): void => {
    if (acting(e)) this.idle = 0;
  };

  constructor(x: number, y: number) {
    super();
    this.position.set(x, y);
    this.eventMode = 'none';
    this.hand.addChild(pointingHand());
    this.addChild(this.ring, this.hand);
    this.visible = false;
    // a touch, drag or key means the player is choosing: the hand goes until they idle again
    for (const type of ['pointerdown', 'pointermove', 'keydown']) window.addEventListener(type, this.touch);
  }

  update(dt: number): void {
    this.idle += dt;
    this.visible = nudgeOn(this.idle);
    if (!this.visible) return;
    // the hand's art came in after the pick opened
    if (handTexture() && !(this.hand.children[0] instanceof Sprite)) {
      this.hand.removeChildren().forEach((c) => c.destroy());
      this.hand.addChild(pointingHand());
    }
    const { lift, ripple } = tapPose(this.idle - CARD_NUDGE.after);
    this.hand.y = 20 + lift * 60;
    this.ring.clear();
    if (ripple > 0) this.ring.circle(0, 0, 30 + ripple * 70).stroke({ width: 8, color: 0xffffff, alpha: 0.8 * (1 - ripple) });
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    for (const type of ['pointerdown', 'pointermove', 'keydown']) window.removeEventListener(type, this.touch);
    super.destroy(options);
  }
}
