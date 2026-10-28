// Reading back what the kit drew, and stand-ins for loaded art, for the view's tests.

import { Texture, TextureSource, type Graphics } from 'pixi.js';

/** The colours a graphic was filled with, in drawing order. */
export function fillColors(g: Graphics): number[] {
  return g.context.instructions.filter((i) => i.action === 'fill').map((i) => (i.data as { style: { color: number } }).style.color);
}

/** A loaded picture `w` by `h`, for a mocked texture getter to hand out. */
export function picture(w: number, h: number): Texture {
  return new Texture({ source: new TextureSource({ width: w, height: h }) });
}
