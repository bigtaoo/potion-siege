// A potion's strokes drawn once per frame of its idle loop and kept: a figure swaps in the frame
// for its time instead of tessellating its strokes again every frame. The mark is always the
// kept one (a throw scales it up); the feet and arms only while the figure idles. The frames are
// drawn at REF body height and scaled to the figure, each the first time it is asked for.

import { Graphics, type GraphicsContext } from 'pixi.js';
import type { PotionLook } from './potion';
import { drawFeet, drawFront, drawMark, LOOP } from './potionMarks';

/** Frames in a loop: about 24 a second. */
export const FRAMES = 48;
/** The body height the frames are drawn at. */
export const REF = 100;

/** Feet, the mark around the neck, and the idle arms. */
export interface LimbFrame {
  back: GraphicsContext;
  mark: GraphicsContext;
  front: GraphicsContext;
}

const kept = new WeakMap<PotionLook, (LimbFrame | undefined)[]>();

/** The frame of `look`'s idle loop at time `t`. */
export function limbFrame(look: PotionLook, t: number): LimbFrame {
  let frames = kept.get(look);
  if (!frames) kept.set(look, (frames = []));
  const k = t / LOOP;
  const i = Math.min(FRAMES - 1, Math.floor((k - Math.floor(k)) * FRAMES));
  let frame = frames[i];
  if (!frame) {
    const at = (i * LOOP) / FRAMES;
    const [back, mark, front] = [new Graphics(), new Graphics(), new Graphics()];
    drawFeet(back, look, at, REF);
    drawFront(front, look, { t: at, bh: REF, w: 0, r: 0, blink: false });
    drawMark(mark, look, at, REF);
    frame = frames[i] = { back: back.context, mark: mark.context, front: front.context };
  }
  return frame;
}
