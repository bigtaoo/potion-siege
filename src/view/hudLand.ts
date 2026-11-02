// Where the HUD goes on a field turned on its side (wideLayout.ts): all of it on the band's one
// line under the field, so nothing sits over the enemies. The gold, the wave and the stage on the
// left under the wall; the two buttons side by side on the right, then the speed and the pause.

import type { Text } from 'pixi.js';
import { DESIGN_W } from './viewport';
import { LAND } from './wideLayout';

/** The board's ends in the HUD's units: the HUD sits over the turned field's middle. */
export const BAND_LEFT = -(LAND.w - DESIGN_W) / 2;
export const BAND_RIGHT = BAND_LEFT + LAND.w;
/** The space between two plates or buttons on the band, and a medal button's radius at 1x. */
export const BAND_GAP = 28;
const MEDAL = 50;
/** A plate's padding each side of its words (hudPlates.ts), counted in the gap between two. */
const PLATE_PAD = 22;

export interface BandSpots {
  coin: { x: number; y: number };
  upgrade: number;
  summon: number;
  speed: number;
  pause: number;
}

/** The band's spots at line `y` for the HUD's words at `top` and buttons `buttonW` wide. */
export function bandSpots(y: number, top: number, buttonW: number): BandSpots {
  const m = MEDAL * top;
  const pause = BAND_RIGHT - BAND_GAP - m;
  const speed = pause - 2 * m - BAND_GAP / 2;
  const summon = speed - m - BAND_GAP - buttonW / 2;
  const upgrade = summon - buttonW - BAND_GAP;
  return { coin: { x: BAND_LEFT + BAND_GAP + 26 * top + PLATE_PAD, y }, upgrade, summon, speed, pause };
}

/** The wave and the stage after the gold, each on its own plate at `top`, the stage narrowed to
 *  stop before `right`. */
export function flowWords(gold: Text, wave: Text, stage: Text, right: number, top: number): void {
  stage.scale.set(top);
  const step = 2 * PLATE_PAD + BAND_GAP / 2;
  wave.x = gold.x + gold.width + step;
  stage.x = wave.x + wave.width + step;
  const over = stage.x + stage.width + PLATE_PAD - right;
  if (over > 0) stage.scale.set(top * Math.max(0.5, 1 - over / stage.width));
}
