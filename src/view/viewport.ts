// The whole 1080x1920 board must stay visible, so the design is fitted inside the screen and
// the rest is filled with background. Taller phones get the extra height as space above the
// board; wider screens get side bars.

export const DESIGN_W = 1080;
export const DESIGN_H = 1920;

export interface Fit {
  /** Screen pixels per design unit. */
  scale: number;
  /** Screen position of the design's top-left corner. */
  x: number;
  y: number;
}

export function fitDesign(screenW: number, screenH: number): Fit {
  const scale = Math.min(screenW / DESIGN_W, screenH / DESIGN_H);
  return { scale, x: (screenW - DESIGN_W * scale) / 2, y: (screenH - DESIGN_H * scale) / 2 };
}

/** The menus are laid out on the whole screen instead: portrait screens get a 1080-wide page
 *  at least 1920 tall, landscape ones (desktop) a 1080-tall page at least 1920 wide, with the
 *  navigation down the left side. */
export interface MenuFit {
  scale: number;
  /** The page size in menu units. */
  w: number;
  h: number;
  wide: boolean;
}

export function fitMenu(screenW: number, screenH: number): MenuFit {
  // a page with no size yet (a portal's iframe at boot) gets the design page, never NaN: a NaN
  // size would compare unchanged against every later one, and the menus would never relayout
  if (!(screenW > 0 && screenH > 0)) return { scale: 1, w: DESIGN_W, h: DESIGN_H, wide: false };
  const wide = screenW > screenH * 1.1;
  const scale = wide ? Math.min(screenW / DESIGN_H, screenH / DESIGN_W) : Math.min(screenW / DESIGN_W, screenH / DESIGN_H);
  return { scale, w: screenW / scale, h: screenH / scale, wide };
}

/** How much the battle's small words grow on a small board: a board fitted into an 800x450
 *  embed is under a quarter of its design size, where they would be a few pixels tall.
 *  1 from a 1280x720 screen (or a phone in portrait) up. */
export function textBoost(boardScale: number): number {
  return Math.min(1.5, Math.max(1, 0.35 / boardScale));
}
