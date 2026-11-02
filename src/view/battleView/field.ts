// The ground under a battle: the chapter's field art (fading into the next one as endless mode
// moves on a chapter; while it is still on its way, nothing, then after a while the chapter's
// main colour, never another chapter's field), the wall's inner face with the health bar's tube
// and the workshop floor, or plain shapes while there is no art. Where the screen has room past
// the board's ends (a tall phone, a turned field on a screen wider than it), the field reaches up
// into it and the floor down, instead of black bars.

import { Graphics, Sprite, Texture, type Container } from 'pixi.js';
import type { Battle } from '../../sim/battle';
import { stageField } from '../../sim/chapters';
import { BALANCE } from '../../sim/types';
import { endlessChapter } from '../../sim/waves';
import { fieldTexture, loadField, loadedField } from '../art';
import { innerFace, workshopFloor } from '../stone';
import { COLORS } from '../ui';
import { DESIGN_H, DESIGN_W } from '../viewport';
import { BAR_H, BAR_Y, WALL_BOTTOM, WALL_TOP } from './wall';

const F = BALANCE.field;
const G = BALANCE.grid;
/** How far down the field art reaches; the wall covers its bottom. */
const FIELD_H = WALL_BOTTOM;
/** Seconds one field takes to fade into the next. */
const FIELD_FADE = 1.6;
/** Design y where the wall's inner face ends and the workshop floor starts. */
const FLOOR_Y = 1672;
/** Seconds a battle waits for its field to come in before it shows the chapter's colour. */
export const FIELD_WAIT = 1.5;
/** Seconds the chapter's colour takes to fade in. */
const COLOR_FADE = 0.4;
/** Each field's main colour (its average), what stands in for it while it is still on its way. */
export const FIELD_COLORS: Record<string, number> = {
  bg_field: 0x838e5f,
  bg_snow: 0xafb2b3,
  bg_rail: 0x7b7873,
  bg_foundry: 0x75706b,
  bg_clock: 0x848c8a,
};

/** Lays `t` on `s` across the field, `top` more of it above the board: the art, or with `color`
 *  a plain fill of that colour. */
function paint(s: Sprite, t: Texture, color = 0xffffff, top = 0): void {
  s.texture = t;
  s.tint = color;
  stretch(s, top);
}

/** The field art from `top` above the board down to the wall. */
function stretch(s: Sprite, top: number): void {
  s.width = DESIGN_W;
  s.height = FIELD_H + top;
  s.y = top > 0 ? -top : 0;
}

/** The field `b` is on in `wave` (its current one by default): its stage's chapter, or in endless
 *  mode the chapter of the wave's band. */
export function fieldOf(b: Battle, wave = b.wave): string {
  return b.setup.endless ? BALANCE.chapters[endlessChapter(wave) - 1].bg : stageField(b.setup.stage);
}

export class FieldArt {
  /** The wall's inner face and the floor, or the shapes standing in for the art. */
  readonly ground = new Graphics();
  /** The field art under the battle, when there is art. */
  private field: Sprite | null = null;
  /** The field the battle is on now, and the next one fading in over it (endless mode moves on a
   *  chapter every few waves). */
  key = '';
  private readonly next = new Sprite();
  private fade = 0;
  /** The floor past the board's bottom end, and how far the field and it reach past the ends. */
  private readonly below = new Graphics();
  private top = 0;
  private bottom = 0;

  /** Draws the ground, and lays the field art under it in `view`, which already holds `ground`. */
  build(view: Container): void {
    const g = this.ground;
    // the field runs right down to the wall, so built cells stand out on it
    const bg = fieldTexture();
    if (bg) {
      const s = (this.field = new Sprite(bg));
      stretch(s, this.top);
      view.addChildAt(s, view.getChildIndex(g));
      this.next.visible = false;
      view.addChildAt(this.next, view.getChildIndex(g));
    } else {
      g.rect(F.left - 20, 0, F.right - F.left + 40, WALL_TOP).fill(COLORS.fieldEdge);
      g.rect(F.left, 0, F.right - F.left, WALL_TOP).fill(COLORS.field);
      for (let y = 120; y < WALL_TOP; y += 160) g.rect(F.left, y, F.right - F.left, 4).fill({ color: 0xffffff, alpha: 0.04 });
    }
    // the wall's inner face with the health bar's tube set into it, and the workshop floor
    if (bg) {
      innerFace(g, DESIGN_W, WALL_BOTTOM, FLOOR_Y, { x: F.left, y: BAR_Y, w: F.right - F.left, h: BAR_H });
      workshopFloor(g, DESIGN_W, FLOOR_Y, DESIGN_H + 40);
      view.addChildAt(this.below, view.getChildIndex(g) + 1);
      return;
    }
    // without the art: a stone band with towers at both ends, the bottom row of cells set into it
    const x0 = G.x0 - 30;
    const x1 = G.x0 + G.cellW * G.cols + 30;
    g.rect(x0, WALL_TOP, x1 - x0, WALL_BOTTOM - WALL_TOP).fill(COLORS.wall).stroke({ width: 4, color: 0x5c5040 });
    for (const tx of [x0 - 10, x1 - 40]) {
      g.rect(tx, WALL_TOP - 50, 50, WALL_BOTTOM - WALL_TOP + 50).fill(COLORS.wallTop).stroke({ width: 4, color: 0x5c5040 });
      g.rect(tx, WALL_TOP - 70, 20, 24).rect(tx + 30, WALL_TOP - 70, 20, 24).fill(COLORS.wallTop).stroke({ width: 4, color: 0x5c5040 });
    }
  }

  /** Lets the field reach `top` above the board and the floor `bottom` below it (design units),
   *  where the screen shows past the board's ends. */
  reach(top: number, bottom: number): void {
    top = Math.max(0, Math.round(top));
    bottom = Math.max(0, Math.round(bottom));
    if (top === this.top && bottom === this.bottom) return;
    this.top = top;
    if (this.field) {
      stretch(this.field, top);
      stretch(this.next, top);
    }
    if (bottom !== this.bottom) {
      this.bottom = bottom;
      this.below.clear();
      if (bottom > 0) workshopFloor(this.below, DESIGN_W, DESIGN_H + 40, DESIGN_H + 40 + bottom);
    }
  }

  /** A new battle: no fade running. */
  reset(): void {
    this.fade = 0;
    this.wait = null;
    this.asked++;
    this.next.visible = false;
  }

  /** Lays the chapter's field under the battle; `fade`: over the one there, in FIELD_FADE
   *  seconds. One still on its way is waited for: a fade keeps the old field till it comes, a swap
   *  shows nothing, then after FIELD_WAIT seconds fades in the chapter's colour, and fades from
   *  that into the art when it comes. */
  show(key: string, fade = false): void {
    this.key = key;
    this.wait = null;
    const ask = ++this.asked;
    const have = loadedField(key) ?? (key === 'bg_field' ? fieldTexture() : undefined);
    if (have) return this.set(have, fade);
    if (!fade && this.field) {
      paint(this.field, Texture.WHITE, FIELD_COLORS[key] ?? COLORS.field, this.top);
      this.field.alpha = 0;
      this.fade = 0;
      this.next.visible = false;
      this.wait = 0;
    }
    void loadField(key).then((t) => {
      if (this.asked !== ask || !t) return;
      // the colour is up (or fading in): fade from it into the art
      const late = this.wait !== null && this.wait > FIELD_WAIT;
      this.wait = null;
      this.set(t, fade || late);
    });
  }

  /** Seconds the field has waited for its art (past FIELD_WAIT its colour shows); null when it
   *  is not waiting. */
  private wait: number | null = null;
  /** Counts the fields asked for, so one that comes in after another was asked for is dropped. */
  private asked = 0;

  private set(t: Texture, fade: boolean): void {
    if (!this.field) return;
    if (fade && this.field.texture !== t) {
      if (this.fade > 0) paint(this.field, this.next.texture, 0xffffff, this.top);
      this.field.alpha = 1;
      const n = this.next;
      paint(n, t, 0xffffff, this.top);
      n.alpha = 0;
      n.visible = true;
      this.fade = FIELD_FADE;
      return;
    }
    paint(this.field, t, 0xffffff, this.top);
    this.field.alpha = 1;
  }

  /** Runs the fade into the next field `dt` seconds on. */
  update(dt: number): void {
    if (this.wait !== null && this.field) {
      this.wait += dt;
      this.field.alpha = Math.max(0, Math.min(1, (this.wait - FIELD_WAIT) / COLOR_FADE));
    }
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt);
      this.next.alpha = 1 - this.fade / FIELD_FADE;
      if (this.fade === 0 && this.field) {
        paint(this.field, this.next.texture, 0xffffff, this.top);
        this.next.visible = false;
      }
    }
  }
}
