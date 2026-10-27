// The battle board on the screen each frame: fitted whole, upright on a portrait screen or turned
// on its side on a wide one (with the shelf under the field), its small words grown for a small
// board, and the HUD laid out to match.

import type { Graphics } from 'pixi.js';
import type { Game } from '../app';
import { landBand } from '../view/landBand';
import { turnView } from '../view/landView';
import { DESIGN_W, textBoost } from '../view/viewport';
import { fitBattle, LAND, type BattleFit } from '../view/wideLayout';

/** The shelf under a turned field, made the first time the field turns. */
let band: Graphics | undefined;

export function placeBattle(g: Game): BattleFit {
  const { width, height } = g.app.screen;
  const fit = fitBattle(width, height, g.wide);
  g.root.scale.set(fit.scale);
  g.root.position.set(fit.x, fit.y);
  turnView(g.view, fit.land);
  if (fit.land && !band) {
    band = landBand();
    band.y = LAND.field;
    // over the field, under the HUD
    g.root.addChildAt(band, g.root.getChildIndex(g.view) + 1);
  }
  if (band) band.visible = fit.land;
  g.hud.x = fit.land ? (LAND.w - DESIGN_W) / 2 : 0;
  g.hud.field = g.view;
  const boost = textBoost(fit.scale);
  g.hud.place(fit.land ? LAND.field + LAND.band / 2 : null);
  g.hud.legible(boost);
  g.view.legible(boost);
  return fit;
}
