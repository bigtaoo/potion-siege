// Smaller copies of a big picture for the places that show it small. A 400 px bottle drawn 60
// device px tall samples one texel in seven: the outlines break up into noise. Halving it on a
// canvas until it is just over the size it lands on screen averages every texel in, as mipmaps
// would, but only for the small uses: a card drawing the full picture keeps it sharp.

import { Matrix, Sprite, Texture, type Renderer, type TextureSource } from 'pixi.js';

const made = new WeakMap<TextureSource, Map<number, Texture>>();
const onScreen = new Matrix();

/** A sprite of `full`, centred and `long` units on its longer side, that draws from the copy
 *  halved as often as it stays at least as big as it lands on screen. The screen size is read
 *  each time it is drawn, so it follows the menu's scale and the renderer's resolution. */
export function sharp(full: Texture, long: number): Sprite {
  const s = new Sprite(full);
  s.anchor.set(0.5);
  const big = Math.max(full.width, full.height);
  const fit = (tex: Texture) => s.scale.set(long / Math.max(tex.width, tex.height));
  fit(full);
  let shown = 0;
  s.onRender = (r: Renderer) => {
    if (!s.parent) return;
    // worldTransform is not kept up to date under render groups: walk up to the stage instead
    const m = s.parent.getGlobalTransform(onScreen);
    const n = halvingsFor(big, long * Math.hypot(m.a, m.b) * r.resolution);
    if (n === shown) return;
    shown = n;
    const tex = copyAt(full, n);
    if (s.texture !== tex) {
      s.texture = tex;
      fit(tex);
    }
  };
  return s;
}

/** How often a picture `big` px on its longer side halves and stays at least `px` px. */
export function halvingsFor(big: number, px: number): number {
  let n = 0;
  while (px > 0 && big / 2 ** (n + 1) >= px) n++;
  return n;
}

/** `full` halved `n` times, made once per picture and level; `full` itself for 0 or for what a
 *  canvas cannot copy (a frame of a sheet, a picture drawn in code). */
export function copyAt(full: Texture, n: number): Texture {
  const src = full.source;
  const whole = full.frame.width === src.width && full.frame.height === src.height;
  if (n === 0 || !whole || !canDraw(src.resource)) return full;
  let copies = made.get(src);
  if (!copies) made.set(src, (copies = new Map()));
  let copy = copies.get(n);
  if (!copy) {
    copy = halve(src.resource, src.pixelWidth, src.pixelHeight, n);
    if (!copy) return full;
    copies.set(n, copy);
  }
  return copy;
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
