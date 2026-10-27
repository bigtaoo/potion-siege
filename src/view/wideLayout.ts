// The battle on a wide screen. The 1080x1920 board fitted whole is about a third of a 16:9
// screen's width, so on a wide screen the field is turned a quarter instead: the enemies walk in
// from the right, the wall stands up on the left, and a band under the field holds the gold and
// the buttons (view/landView.ts). The board then takes about 83% of the width. A portrait screen
// is never changed; ?wide=off (dev builds) keeps the upright board on a wide screen too.

import { DESIGN_H, DESIGN_W, fitDesign, type Fit } from './viewport';

export type WideMode = 'off' | 'land';

/** The turned board: the field on its side (DESIGN_H wide, DESIGN_W high) and the band under it. */
export const LAND = { w: DESIGN_H, field: DESIGN_W, band: 220 } as const;

/** A screen wider than this (width over height) counts as wide, as for the menus. */
const WIDE = 1.1;

export interface BattleFit extends Fit {
  /** The field is turned on its side. */
  land: boolean;
}

export function wideMode(value: string | null): WideMode {
  return value === 'off' ? 'off' : 'land';
}

/** The board on a `w` x `h` screen in `mode`: fitted whole and upright on a portrait screen or
 *  with the mode off, else turned on its side with the band under it. */
export function fitBattle(w: number, h: number, mode: WideMode): BattleFit {
  if (w <= h * WIDE || mode === 'off') return { ...fitDesign(w, h), land: false };
  const high = LAND.field + LAND.band;
  const scale = Math.min(w / LAND.w, h / high);
  return { scale, x: (w - LAND.w * scale) / 2, y: (h - high * scale) / 2, land: true };
}

/** The share of the screen's width the board takes. */
export function boardShare(f: BattleFit, w: number): number {
  return ((f.land ? LAND.w : DESIGN_W) * f.scale) / w;
}
