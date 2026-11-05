// A living potion. The bottle and its face are art; everything that moves is drawn over it (feet,
// arms, the flame from its neck, blinking, in potionMarks.ts), so one picture gives idle, throw
// and merge motion.

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { limbFrame, REF } from './potionFrames';
import { drawFeet, drawFront, drawMark, neckAt } from './potionMarks';

export { INK, snowflake, star } from './potionMarks';

/** How one kind of potion looks. Positions are fractions of the body art (0,0 top left). */
export interface PotionLook {
  body: Texture;
  eyes: [number, number][];
  /** Eye half-size as fractions of the art's width and height. */
  eyeSize: [number, number];
  /** Eyelids: the colour of the liquid around the eyes. */
  lid: number;
  limb: number;
  /** What rises from its neck: the element mark. */
  mark: 'flame' | 'frost' | 'spark' | 'star' | 'acid' | 'wind' | 'ray' | 'drop' | 'sprout';
  /** Outer, middle and core colour of the mark (and of its thrown vials). */
  glow: [number, number, number];
  neck: [number, number];
  /** Height relative to the other potions, so a wide bottle does not crowd its cell. */
  size?: number;
}

/** Where and how a potion is drawn this frame. */
export interface PotionPose {
  x: number;
  feet: number;
  height: number;
  alpha: number;
  dim: boolean;
  phase: number;
  time: number;
  /** 0-1: how far the throwing arm is drawn back before the next throw. */
  wind: number;
  /** Seconds since its last throw. */
  since: number;
  /** Seconds since it appeared; it pops in over the first 0.4 s. */
  pop: number;
  /** Fixed tilt in radians instead of the idle sway (pouring into another potion). */
  tilt?: number;
  /** Squash and stretch on top of the breathing: above 0 flattens it, below 0 stretches it up. */
  squash?: number;
  /** Extra turn in radians on top of the sway (wobbling as a merge lands in it). */
  spin?: number;
  /** -1 to 1: which way (left or right on the screen) it throws, so it leans that way. */
  aim?: number;
}

/** Scale of something appearing `pop` seconds ago: grows from nothing, overshoots, settles. */
export function popScale(pop: number): number {
  if (pop >= 0.4) return 1;
  if (pop <= 0) return 0;
  const p = pop / 0.4;
  return 1 - (1 - p) ** 4 * Math.cos(p * Math.PI * 2.5);
}

/** How hard it is still recoiling from its last throw, 1 at release down to 0. */
export function recoil(since: number): number {
  return since < 0.4 ? (1 - since / 0.4) ** 2 : 0;
}

/** Where the throwing hand is at the moment of release, relative to the feet, for a potion
 *  `height` tall: thrown vials start from here. */
export function throwingHand(look: PotionLook, height: number): { x: number; y: number } {
  height *= look.size ?? 1;
  const bw = (height * look.body.width) / look.body.height;
  return { x: 0.37 * bw - 0.02 * height, y: -height * (0.1 + 0.38 + 0.36 + 0.14) };
}

/**
 * A potion's body art with its feet behind it and its mark and arms in front. In a layer it shows
 * the kept frames of its loop for its time (potionFrames.ts), scaled to its size: its feet and
 * mark always (a throw scales the mark up around the neck), its arms while it idles. Its
 * breathing, sway and hop ride on the transform. Its arms wind up, recoil and blink drawn
 * afresh; a still one draws everything afresh.
 */
class PotionFigure extends Container {
  private readonly back = new Graphics();
  private readonly body = new Sprite();
  private readonly mark = new Graphics();
  private readonly front = new Graphics();
  /** The contexts it draws its own strokes into; the kept frames are swapped in over them. */
  private readonly own = { back: this.back.context, mark: this.mark.context, front: this.front.context };

  constructor() {
    super();
    this.body.anchor.set(0.5, 1);
    this.addChild(this.back, this.body, this.mark, this.front);
  }

  /** `kept`: whether it may show the kept frames. */
  draw(look: PotionLook, pose: PotionPose, kept = false): void {
    const t = pose.time + pose.phase * 0.77;
    const bh = pose.height * (look.size ?? 1);
    const lift = bh * 0.1;
    const w = pose.wind;
    const r = recoil(pose.since);

    // idle breathing and sway; drawing back squashes and leans away, the release stretches up
    const breath = Math.sin(t * 3.2);
    const grow = popScale(pose.pop);
    const jiggle = pose.pop < 0.4 ? 1 + 0.1 * (1 - pose.pop / 0.4) * Math.sin(pose.pop * 40) : 1;
    // a little hop as it throws
    this.position.set(pose.x, pose.feet - r * bh * 0.14);
    const sq = pose.squash ?? 0;
    this.scale.set(grow * jiggle * (1 + sq) * (1 - breath * 0.025 + w * 0.16 - r * 0.08), (grow / jiggle) * (1 - sq) * (1 + breath * 0.03 - w * 0.2 + r * 0.16));
    this.rotation = (pose.tilt ?? Math.sin(t * 1.7) * 0.04 - w * 0.22 + r * 0.1) + (pose.spin ?? 0) + (pose.aim ?? 0) * 0.14 * (r + w * 0.4);
    this.alpha = pose.alpha;
    this.tint = pose.dim ? 0x5a5a5a : 0xffffff;

    this.body.texture = look.body;
    this.body.position.set(0, -lift);
    this.body.scale.set(bh / look.body.height);

    // blink every few seconds, out of step with the others
    const blink = !pose.dim && (t * 0.31 + pose.phase * 0.17) % 1 < 0.035;
    const frame = kept ? limbFrame(look, t) : null;
    const size = frame ? bh / REF : 1;
    this.back.scale.set(size);
    if (frame) this.back.context = frame.back;
    else {
      this.back.context = this.own.back;
      drawFeet(this.back, look, t, bh);
    }

    // the mark out of the neck flares up with a throw and stays upright as a flame or a wind
    // would; it goes out while pouring
    this.mark.visible = pose.tilt === undefined;
    if (this.mark.visible) {
      const [nx, ny] = neckAt(look, bh);
      this.mark.position.set(nx, ny - r * bh * 0.07);
      this.mark.scale.set(size * (1 + 0.45 * r + 0.2 * w));
      this.mark.rotation = look.mark === 'flame' || look.mark === 'wind' ? -this.rotation : 0;
      if (frame) this.mark.context = frame.mark;
      else {
        this.mark.context = this.own.mark;
        drawMark(this.mark, look, t, bh);
      }
    }

    if (frame && w === 0 && r === 0 && !blink) {
      this.front.context = frame.front;
      this.front.scale.set(size);
      return;
    }
    this.front.context = this.own.front;
    this.front.scale.set(1);
    drawFront(this.front, look, { t, bh, w, r, blink });
  }
}

/** One potion drawn once in a pose, for a page that does not animate it. */
export function stillPotion(look: PotionLook, pose: PotionPose): Container {
  const p = new PotionFigure();
  p.draw(look, pose);
  return p;
}

/** Potions reused frame to frame: begin(), put() each one, end(). */
export class PotionLayer extends Container {
  private used = 0;

  begin(): void {
    this.used = 0;
  }

  put(look: PotionLook, pose: PotionPose): void {
    let p = this.children[this.used] as PotionFigure | undefined;
    if (!p) {
      p = new PotionFigure();
      this.addChild(p);
    }
    this.used++;
    p.visible = true;
    p.draw(look, pose, true);
  }

  end(): void {
    for (let i = this.used; i < this.children.length; i++) this.children[i].visible = false;
  }
}
