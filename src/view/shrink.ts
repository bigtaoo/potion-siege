// Smaller copies of a big picture for the places that show it small. A 400 px bottle drawn 28
// units tall samples one texel in ten: the outlines break up into noise. Halving it on a canvas
// until it is just over the size it is drawn at averages every texel in, as mipmaps would, but
// only for the small uses: a card drawing the full picture keeps it sharp.

import { Texture, type TextureSource } from 'pixi.js';

/** Device pixels a menu unit can take at most (a full-size menu on a phone's 3x screen is about
 *  half a unit to a pixel, times 3); a copy never goes below the size drawn times this. */
const DENSITY = 1.5;

const made = new WeakMap<TextureSource, Map<number, Texture>>();

/** `tex`, or a copy halved as often as it stays at least `h` x DENSITY px on its longer side. */
export function shrunk(tex: Texture, h: number): Texture {
  const src = tex.source;
  const halvings = halvingsFor(Math.max(tex.width, tex.height), h);
  // only whole pictures loaded from a file: not a frame of a sheet, nor one drawn in code
  const whole = tex.frame.width === src.width && tex.frame.height === src.height;
  if (halvings === 0 || !whole || !canDraw(src.resource)) return tex;
  let copies = made.get(src);
  if (!copies) made.set(src, (copies = new Map()));
  let copy = copies.get(halvings);
  if (!copy) {
    copy = halve(src.resource, src.pixelWidth, src.pixelHeight, halvings);
    if (!copy) return tex;
    copies.set(halvings, copy);
  }
  return copy;
}

/** How often a picture `big` px on its longer side halves and stays at least `h` x DENSITY px. */
export function halvingsFor(big: number, h: number): number {
  let n = 0;
  while (big / 2 ** (n + 1) >= h * DENSITY) n++;
  return n;
}

function canDraw(r: unknown): r is CanvasImageSource {
  return (typeof ImageBitmap !== 'undefined' && r instanceof ImageBitmap) || (typeof HTMLImageElement !== 'undefined' && r instanceof HTMLImageElement);
}

/** `img` halved `n` times, one step at a time so each step averages its 2x2 texels. */
function halve(img: CanvasImageSource, w: number, h: number, n: number): Texture | undefined {
  let from: CanvasImageSource = img;
  let canvas: HTMLCanvasElement | undefined;
  for (let i = 0; i < n; i++) {
    w = Math.max(1, Math.round(w / 2));
    h = Math.max(1, Math.round(h / 2));
    const next = document.createElement('canvas');
    next.width = w;
    next.height = h;
    const g = next.getContext('2d');
    if (!g) return undefined;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(from, 0, 0, w, h);
    from = canvas = next;
  }
  if (!canvas) return undefined;
  const t = Texture.from(canvas);
  t.source.autoGarbageCollect = false;
  return t;
}
