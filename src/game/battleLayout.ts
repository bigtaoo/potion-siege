// The battle board on the screen each frame: fitted (whole, or its lower part on a wide screen
// in a ?wide= mode, or turned on its side), its small words grown for a small board, and the HUD laid out to match.

import type { Game } from '../app';
import { OUT_TOP } from '../view/Hud';
import { turnView } from '../view/landView';
import { DESIGN_W, textBoost, type MenuFit } from '../view/viewport';
import { fitBattle, LAND, type BattleFit } from '../view/wideLayout';

export interface PlacedBattle extends BattleFit {
  /** Page units at the bottom of the side columns the gold and buttons take, 0 when on the board. */
  reserve: number;
}

export function placeBattle(g: Game, m: MenuFit): PlacedBattle {
  const { width, height } = g.app.screen;
  const fit = fitBattle(width, height, g.wide);
  g.root.scale.set(fit.scale);
  g.root.position.set(fit.x, fit.y);
  turnView(g.view, fit.land);
  g.hud.x = fit.land ? (LAND.w - DESIGN_W) / 2 : 0;
  const boost = textBoost(fit.scale);
  g.hud.place(fit.top, fit.out, fit.land ? LAND.field + LAND.band / 2 : null);
  g.hud.legible(boost);
  g.view.legible(boost);
  const reserve = fit.out === null ? 0 : Math.max(0, height - (fit.y + OUT_TOP * fit.scale)) / m.scale;
  return { ...fit, reserve };
}
