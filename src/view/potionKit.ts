// Test helpers for the drawn figures: a blank texture of a given size, and what a Graphics drew.

import { Graphics, Texture, TextureSource } from 'pixi.js';

/** A texture with no pixels, only a size. */
export function blankTexture(width: number, height: number): Texture {
  return new Texture({ source: new TextureSource({ width, height }) });
}

/** The colours of each fill or stroke `g` holds, in order. */
export function drawnColors(g: Graphics, action: 'fill' | 'stroke'): number[] {
  return g.context.instructions
    .filter((i) => i.action === action)
    .map((i) => (i.data as { style: { color: number } }).style.color);
}

/** How many times `g` drew `color` with `action`. */
export function countColor(g: Graphics, action: 'fill' | 'stroke', color: number): number {
  return drawnColors(g, action).filter((c) => c === color).length;
}
