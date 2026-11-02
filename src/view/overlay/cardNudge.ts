// The first battles' skill pick: a "推荐" tag over the card the board would get most from
// (sim/suggest.ts) and a hand tapping it, there as the cards open and back a second after the
// player lets go of them. Only a pointer: it never picks, and the battle stays paused under the
// cards as it always does.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../../i18n';
import { handTexture } from '../art';
import { P } from '../kit';
import { pointingHand } from '../Tutorial';
import { label } from '../ui';

/** Seconds from the cards opening to the hand (they fan out first), seconds after a touch or key
 *  before it comes back, and one tap's length. The cards waited 5 s for it before (11-02). */
export const CARD_NUDGE = { after: 0.5, rest: 1, beat: 1.2 };

/** The hand is up `open` seconds after the cards opened, `quiet` after the player last touched
 *  them; one that `wait`s (a later player's result) wants that long of both. */
export function nudgeOn(open: number, quiet: number, wait = 0): boolean {
  return open >= Math.max(CARD_NUDGE.after, wait) && quiet >= Math.max(CARD_NUDGE.rest, wait);
}

/** Input that means the player is at the cards: a press, a drag or a key. A mouse only passing
 *  over them is not; on a desktop it never keeps still, and the hand would never come. */
function acting(e: Event): boolean {
  return e.type !== 'pointermove' || ((e as PointerEvent).buttons ?? 0) !== 0;
}

const EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown'];

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
  /** Seconds since the pick opened, since the player last touched it (while a press lasts, 0),
   *  and since the hand came up. */
  private open = 0;
  private quiet = Infinity;
  private down = false;
  private shown = 0;
  private readonly hand = new Container();
  private readonly ring = new Graphics();
  private readonly touch = (e: Event): void => {
    if (e.type === 'pointerup' || e.type === 'pointercancel') this.down = false;
    else if (e.type === 'pointerdown') this.down = true;
    if (acting(e)) this.quiet = 0;
  };

  constructor(x: number, y: number, private readonly wait = 0) {
    super();
    this.position.set(x, y);
    this.eventMode = 'none';
    this.hand.addChild(pointingHand());
    this.addChild(this.ring, this.hand);
    this.visible = false;
    // a touch, drag or key means the player is choosing: the hand goes until they let go a while
    if (typeof window !== 'undefined') for (const type of EVENTS) window.addEventListener(type, this.touch);
  }

  update(dt: number): void {
    this.open += dt;
    this.quiet = this.down ? 0 : this.quiet + dt;
    // the tap starts from its top as the hand comes up
    this.shown = this.visible ? this.shown + dt : 0;
    this.visible = nudgeOn(this.open, this.quiet, this.wait);
    if (!this.visible) return;
    // the hand's art came in after the pick opened
    if (handTexture() && !(this.hand.children[0] instanceof Sprite)) {
      this.hand.removeChildren().forEach((c) => c.destroy());
      this.hand.addChild(pointingHand());
    }
    const { lift, ripple } = tapPose(this.shown);
    this.hand.y = 20 + lift * 60;
    this.ring.clear();
    if (ripple > 0) this.ring.circle(0, 0, 30 + ripple * 70).stroke({ width: 8, color: 0xffffff, alpha: 0.8 * (1 - ripple) });
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    if (typeof window !== 'undefined') for (const type of EVENTS) window.removeEventListener(type, this.touch);
    super.destroy(options);
  }
}
