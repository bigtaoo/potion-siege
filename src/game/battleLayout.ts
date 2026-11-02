// The battle board on the screen each frame: fitted whole, upright on a portrait screen or turned
// on its side on a wide one (with the shelf under the field), its small words grown for a small
// board, and the HUD laid out to match.

import type { Graphics } from 'pixi.js';
import type { Game } from '../app';
import { BAND_MID, landBand } from '../view/landBand';
import { turnView } from '../view/landView';
import { hasColumns } from '../view/SideInfo';
import { DESIGN_W, fitMenu, textBoost } from '../view/viewport';
import { fitBattle, LAND, type BattleFit } from '../view/wideLayout';

/** The shelf under a turned field, made the first time the field turns, and how far it reaches
 *  past the board's ends. */
let band: Graphics | undefined;
let bandExtra = 0;

/** The room past the board's ends the field and the floor reach into, in board units: a tall
 *  phone's above and below, a turned field's right and left while no side boards stand there. */
function spare(fit: BattleFit, w: number, h: number): number {
  if (!fit.land) return fit.y / fit.scale;
  return hasColumns(fit.x / fitMenu(w, h).scale) ? 0 : fit.x / fit.scale;
}

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
  const extra = Math.ceil(spare(fit, width, height));
  g.view.reach(extra, extra);
  if (band && fit.land && extra !== bandExtra) landBand((bandExtra = extra), band);
  g.hud.x = fit.land ? (LAND.w - DESIGN_W) / 2 : 0;
  g.hud.field = g.view;
  const boost = textBoost(fit.scale);
  g.hud.place(fit.land ? BAND_MID : null);
  g.hud.legible(boost);
  g.view.legible(boost);
  return fit;
}
