// The enemies' art as the battle draws it: baked once per texture (see enemyBake.ts) with its rim,
// in the chapter's metal or, while something is on it (ice, a slow, a burn...), in its own grey so
// the tint of that reads as plainly as ever. Made on first use, on a canvas; without one (tests,
// a browser that will not give one) the art is drawn as it comes.

import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import type { Enemy } from '../sim/types';
import { METALS, metalled, rimmed, type Pixels } from './enemyBake';
import { ENEMY_ART } from './shapes';

/** How wide the rim is, in design units, on an enemy of its kind's size. */
export const RIM_WIDTH = 2.5;

/** The tint of what is on `e`, the strongest first; white when nothing is. */
export function statusTint(e: Enemy): number {
  if (e.freezeTime > 0) return 0x9fe8ff;
  if (e.slowTime > 0) return 0xc4dcff;
  if (e.burnTime > 0) return 0xffb27a;
  if (e.chargeTime > 0) return 0xfff2a0;
  if (e.markTime > 0) return 0xdcb8ff;
  if (e.rust > 0) return 0xe0a878;
  if (e.poisonTime > 0) return 0xc8f0a0;
  return 0xffffff;
}

/** The metal of chapter `chapter` (1-based); past the last one, the last one's. */
export function chapterMetal(chapter: number): (typeof METALS)[number] {
  return METALS[Math.max(0, Math.min(METALS.length - 1, chapter - 1))];
}

/** Each base texture's baked looks: 0 the grey one, 1-5 the chapters'. Only the grey ones and
 *  the last chapter asked for are kept: endless mode walks through all five. */
const baked = new Map<Texture, Map<number, Texture>>();
let kept = 0;

/** Lets go of every chapter's looks but `chapter`'s (Pixi's GC frees them once undrawn). */
function keepOnly(chapter: number): void {
  if (chapter === kept) return;
  kept = chapter;
  for (const looks of baked.values()) for (const k of looks.keys()) if (k > 0 && k !== chapter) looks.delete(k);
}

/** Reads `base`'s pixels off a canvas; undefined without a 2D context. */
function pixelsOf(base: Texture): Pixels | undefined {
  const f = base.frame;
  const c = document.createElement('canvas');
  c.width = f.width;
  c.height = f.height;
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (!ctx) return undefined;
  ctx.drawImage(base.source.resource as CanvasImageSource, f.x, f.y, f.width, f.height, 0, 0, f.width, f.height);
  return ctx.getImageData(0, 0, f.width, f.height);
}

/** `px` (`pad` bigger on each side than `base`) as a texture the size of `base`: a sprite of it
 *  stands where one of `base` would, the rim spilling past its edges. */
function textureOf(base: Texture, px: Pixels, pad: number): Texture | undefined {
  const c = document.createElement('canvas');
  c.width = px.width;
  c.height = px.height;
  const ctx = c.getContext('2d');
  if (!ctx) return undefined;
  ctx.putImageData(new ImageData(px.data as Uint8ClampedArray<ArrayBuffer>, px.width, px.height), 0, 0);
  return new Texture({
    source: new CanvasSource({ resource: c }),
    orig: new Rectangle(0, 0, base.width, base.height),
    trim: new Rectangle(-pad, -pad, px.width, px.height),
  });
}

/** `base` (art of an enemy kind `radius` across its hit circle) rimmed, in the metal of `chapter`
 *  or with 0 in its own grey. `base` itself when it cannot be baked. */
export function enemyLook(base: Texture, radius: number, chapter: number): Texture {
  if (chapter > 0) keepOnly(chapter);
  let looks = baked.get(base);
  if (!looks) baked.set(base, (looks = new Map()));
  const have = looks.get(chapter);
  if (have) return have;
  let made = base;
  try {
    const px = pixelsOf(base);
    if (px) {
      const pad = Math.max(1, Math.round((RIM_WIDTH * base.height) / (radius * ENEMY_ART.height)));
      if (chapter > 0) metalled(px, chapterMetal(chapter));
      made = textureOf(base, rimmed(px, pad), pad) ?? base;
    }
  } catch (err) {
    console.warn('enemy art: could not bake, drawing it as it comes', err);
  }
  looks.set(chapter, made);
  return made;
}
