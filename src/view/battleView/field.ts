// The ground under a battle: the chapter's field art (fading into the next one as endless mode
// moves on a chapter), the wall's inner face with the health bar's tube and the workshop floor,
// or plain shapes while there is no art.

import { Graphics, Sprite, type Container, type Texture } from 'pixi.js';
import type { Battle } from '../../sim/battle';
import { stageField } from '../../sim/chapters';
import { BALANCE } from '../../sim/types';
import { endlessChapter } from '../../sim/waves';
import { fieldTexture, loadField } from '../art';
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

  /** Draws the ground, and lays the field art under it in `view`, which already holds `ground`. */
  build(view: Container): void {
    const g = this.ground;
    // the field runs right down to the wall, so built cells stand out on it
    const bg = fieldTexture();
    if (bg) {
      const s = (this.field = new Sprite(bg));
      s.width = DESIGN_W;
      s.height = FIELD_H;
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

  /** A new battle: no fade running. */
  reset(): void {
    this.fade = 0;
    this.next.visible = false;
  }

  /** Lays the chapter's field under the battle, once it has come in if it is still on its way;
   *  `fade`: over the one there, in FIELD_FADE seconds. */
  show(key: string, fade = false): void {
    this.key = key;
    const set = (t: Texture | undefined) => {
      if (!this.field || !t || this.key !== key) return;
      if (fade && this.field.texture !== t) {
        if (this.fade > 0) this.field.texture = this.next.texture;
        const n = this.next;
        n.texture = t;
        n.width = DESIGN_W;
        n.height = FIELD_H;
        n.alpha = 0;
        n.visible = true;
        this.fade = FIELD_FADE;
        return;
      }
      this.field.texture = t;
      this.field.width = DESIGN_W;
      this.field.height = FIELD_H;
    };
    set(fieldTexture(key));
    void loadField(key).then(set);
  }

  /** Runs the fade into the next field `dt` seconds on. */
  update(dt: number): void {
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt);
      this.next.alpha = 1 - this.fade / FIELD_FADE;
      if (this.fade === 0 && this.field) {
        this.field.texture = this.next.texture;
        this.next.visible = false;
      }
    }
  }
}
