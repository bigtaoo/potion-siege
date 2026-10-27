// The battle on a wide screen. The 1080x1920 board fitted whole is about a third of a 16:9
// screen's width, the walls and boards either side the rest. Two ways to give it more:
//   side  the summon and upgrade buttons and the gold go out into the side columns, and the empty
//         band over the field (where the HUD row was the only thing) is left off the screen;
//   crop  only the lower part of the field is shown: enemies come into view a little later
//         (the "Coming up" board shows each wave ahead), the board is drawn bigger;
//   both  the two together;
//   land  the field turned a quarter: enemies walk in from the right, the wall stands up on the
//         left, a band under it holds the gold and the buttons (view/landView.ts).
// A prototype behind ?wide= (dev builds) until the owner picks one. A portrait screen is
// never changed.

import { DESIGN_H, DESIGN_W, type Fit } from './viewport';

export type WideMode = 'off' | 'side' | 'crop' | 'both' | 'land';
const MODES: readonly WideMode[] = ['off', 'side', 'crop', 'both', 'land'];

/** The design y each mode shows from: `side` leaves off the band over the field the HUD row sat
 *  in, `crop` about the top 28% (the lower 72% stays). */
export const CUT = { side: 150, crop: 540 } as const;

/** The turned board: the field on its side (DESIGN_H wide, DESIGN_W high) and the band under it. */
export const LAND = { w: DESIGN_H, field: DESIGN_W, band: 220 } as const;

/** A screen wider than this (width over height) counts as wide, as for the menus. */
const WIDE = 1.1;

export interface BattleFit extends Fit {
  /** The design y at the screen's top edge (the board's top on a tall screen). */
  top: number;
  /** The buttons and gold sit in the side columns, `out` design units out from the board's edges. */
  out: number | null;
  /** The field is turned on its side (`land`). */
  land: boolean;
}

export function wideMode(value: string | null): WideMode {
  return MODES.find((m) => m === value) ?? 'off';
}

/** The board on a `w` x `h` screen in `mode`: fitted whole as before on a portrait screen or with
 *  the mode off, else its lower part from `top` down fitted into the height. */
export function fitBattle(w: number, h: number, mode: WideMode): BattleFit {
  const wide = w > h * WIDE && mode !== 'off';
  if (wide && mode === 'land') {
    const high = LAND.field + LAND.band;
    const scale = Math.min(w / LAND.w, h / high);
    return { scale, x: (w - LAND.w * scale) / 2, y: (h - high * scale) / 2, top: 0, out: null, land: true };
  }
  const cut = !wide ? 0 : mode === 'side' ? CUT.side : CUT.crop;
  const shown = DESIGN_H - cut;
  const scale = Math.min(w / DESIGN_W, h / shown);
  const x = (w - DESIGN_W * scale) / 2;
  const y = (h - shown * scale) / 2 - cut * scale;
  const out = wide && mode !== 'crop' ? x / scale / 2 : null;
  return { scale, x, y, top: Math.max(0, -y / scale), out, land: false };
}

/** The share of the screen's width the board takes. */
export function boardShare(f: BattleFit, w: number): number {
  return ((f.land ? LAND.w : DESIGN_W) * f.scale) / w;
}
