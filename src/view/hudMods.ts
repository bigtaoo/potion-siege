// The challenge's modifiers on the battle HUD: a small chip each down the right edge, under the
// stage upright and in the board's top right corner on a field turned on its side. A chip with an enemy walking under it fades nearly away, so it never hides one.

import { Container, Graphics, type Point, type PointData } from 'pixi.js';
import { t } from '../i18n';
import type { Battle } from '../sim/battle';
import type { ModifierId } from '../sim/challenge';
import type { HeroKind } from '../sim/types';
import { fit, ink, LIGHT, lightTile, modifierIcon } from './kit';
import { DESIGN_W } from './viewport';

/** A chip's height, its name's size and longest width, the step from one chip to the next, and
 *  the column's room from the right edge and first middle (upright, and on a turned field). */
export const MOD_CHIP = { h: 44, size: 24, nameW: 220, step: 54, right: 24, top: 128, landTop: 44 } as const;
/** How faint a chip goes over an enemy, how close one has to come, and how fast it fades. */
export const MOD_FADE = { alpha: 0.22, near: 40, rate: 6 } as const;

export class ModChips extends Container {
  /** The chips' right edge and the first one's middle. */
  private at: { right: number; top: number } = { right: DESIGN_W - MOD_CHIP.right, top: MOD_CHIP.top };

  /** Moves the chips' column to end at `right`, the first one's middle at `top`. */
  place(right: number, top: number): void {
    this.at = { right, top };
    this.children.forEach((chip, i) => chip.position.set(right, top + i * MOD_CHIP.step));
  }

  /** The chips for `ids`, a modifier each; none clears them. */
  show(ids: readonly ModifierId[], trial: HeroKind | null): void {
    this.removeChildren().forEach((c) => c.destroy({ children: true }));
    const { h, size, nameW } = MOD_CHIP;
    ids.forEach((id) => {
      const chip = new Container();
      const name = fit(ink(t(`challenge.mod.${id}.name`), size, { fontWeight: '900' }), nameW);
      name.anchor.set(1, 0.5);
      const w = name.width + 72;
      const icon = modifierIcon(id, trial);
      icon.scale.set(0.32);
      icon.position.set(-w + 28, -1);
      name.position.set(-14, -1);
      const tile = lightTile(w, h, h / 2);
      tile.x = -w / 2;
      const rim = new Graphics().roundRect(-w, -h / 2, w, h, h / 2).stroke({ width: 3, color: LIGHT.edge });
      chip.addChild(tile, rim, icon, name);
      this.addChild(chip);
    });
    this.place(this.at.right, this.at.top);
  }

  /** Fades each chip with an enemy under it; `toHud` takes a spot on the field to the HUD's units. */
  update(b: Battle, toHud: (p: PointData) => Point | PointData, dt: number): void {
    if (this.children.length === 0) return;
    const spots = b.enemies.map((e) => toHud(e));
    const near = MOD_FADE.near;
    const k = Math.min(1, dt * MOD_FADE.rate);
    for (const chip of this.children) {
      const r = chip.getLocalBounds();
      const x0 = chip.x + r.x - near;
      const x1 = chip.x + r.x + r.width + near;
      const y0 = chip.y + r.y - near;
      const y1 = chip.y + r.y + r.height + near;
      const under = spots.some((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1);
      const target = under ? MOD_FADE.alpha : 1;
      chip.alpha += (target - chip.alpha) * k;
      if (Math.abs(target - chip.alpha) < 0.01) chip.alpha = target;
    }
  }
}
