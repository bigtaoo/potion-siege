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
  const wide = screenW > screenH * 1.1;
  const scale = wide ? Math.min(screenW / DESIGN_H, screenH / DESIGN_W) : Math.min(screenW / DESIGN_W, screenH / DESIGN_H);
  return { scale, w: screenW / scale, h: screenH / scale, wide };
}
