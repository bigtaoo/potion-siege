// What an enemy's art is baked into before the battle draws it, pixel by pixel on its RGBA data:
// a light rim round its ink line, so a grey clockwork soldier stands off the grey stone of the
// later chapters, and its metal turned to the chapter's own (copper, steel blue, rust, black iron,
// gilt). Its coloured parts (the red eyes, the brass keys) keep their colours.

/** A chapter's metal, dark to light: what the shadows, the body and the shine of grey turn to. */
export type Metal = readonly [shadow: number, base: number, light: number];

/** The chapters' metals, first chapter first. */
export const METALS: readonly Metal[] = [
  [0x5a2410, 0xc46a32, 0xffc89a], // copper
  [0x1c3456, 0x4f7fb4, 0xbfe0ff], // steel blue
  [0x3a170c, 0x8a3f20, 0xc4845a], // rust
  [0x101116, 0x34363e, 0x7c808c], // black iron
  [0x5a3a08, 0xd2a028, 0xfff0a0], // gilt
];

/** The rim round every enemy: warm cream, like the white edge of a sticker. */
export const RIM = 0xffe6bc;
/** How opaque the rim is at its full width. */
const RIM_ALPHA = 0.9;

/** An RGBA picture: what a canvas's getImageData hands back, and what goes back into it. */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** `px`'s picture `pad` pixels bigger on every side, with a rim `pad` wide round whatever is
 *  more than half opaque, its outer edge soft. */
export function rimmed(px: Pixels, pad: number, color = RIM): Pixels {
  const w = px.width + pad * 2;
  const h = px.height + pad * 2;
  const n = w * h;
  // distance (in pixels) to the nearest solid pixel: two chamfer passes, near enough to round
  const d = new Float32Array(n).fill(1e9);
  for (let y = 0; y < px.height; y++) {
    for (let x = 0; x < px.width; x++) if (px.data[(y * px.width + x) * 4 + 3] >= 128) d[(y + pad) * w + x + pad] = 0;
  }
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 1);
        if (x > 0) v = Math.min(v, d[i - w - 1] + D);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + D);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + D);
        if (x > 0) v = Math.min(v, d[i + w - 1] + D);
      }
      d[i] = v;
    }
  }
  const cr = (color >> 16) & 255;
  const cg = (color >> 8) & 255;
  const cb = color & 255;
  const out = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const rim = Math.max(0, Math.min(1, pad + 0.5 - d[i])) * RIM_ALPHA;
      const sx = x - pad;
      const sy = y - pad;
      const inside = sx >= 0 && sy >= 0 && sx < px.width && sy < px.height;
      const j = (sy * px.width + sx) * 4;
      const a = inside ? px.data[j + 3] / 255 : 0;
      // the art over its rim
      const oa = a + rim * (1 - a);
      const o = i * 4;
      if (oa <= 0) continue;
      const under = rim * (1 - a);
      out[o] = ((inside ? px.data[j] : 0) * a + cr * under) / oa;
      out[o + 1] = ((inside ? px.data[j + 1] : 0) * a + cg * under) / oa;
      out[o + 2] = ((inside ? px.data[j + 2] : 0) * a + cb * under) / oa;
      out[o + 3] = oa * 255;
    }
  }
  return { data: out, width: w, height: h };
}

/** Where lightness 0-1 falls on `metal`: black ink stays black, then shadow, body and shine. */
export function metalAt(metal: Metal, lum: number): [number, number, number] {
  const stops: [number, number][] = [[0, 0x000000], [0.25, metal[0]], [0.55, metal[1]], [0.9, metal[2]]];
  let k = stops.length - 1;
  while (k > 0 && lum < stops[k][0]) k--;
  const [t0, c0] = stops[k];
  const [t1, c1] = stops[Math.min(k + 1, stops.length - 1)];
  const f = t1 > t0 ? Math.min(1, (lum - t0) / (t1 - t0)) : 0;
  const ch = (c: number, s: number) => (c >> s) & 255;
  return [16, 8, 0].map((s) => Math.round(ch(c0, s) + (ch(c1, s) - ch(c0, s)) * f)) as [number, number, number];
}

/** Turns the grey of `px` (in place) to `metal`: the greyer a pixel, the more of the metal it
 *  takes; a coloured one (chroma 0.3 and up) keeps its own colour. */
export function metalled(px: Pixels, metal: Metal): Pixels {
  const p = px.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    const r = p[i];
    const g = p[i + 1];
    const b = p[i + 2];
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const w = Math.max(0, Math.min(1, (0.3 - chroma) / 0.2));
    if (w === 0) continue;
    const [mr, mg, mb] = metalAt(metal, (0.299 * r + 0.587 * g + 0.114 * b) / 255);
    p[i] = r + (mr - r) * w;
    p[i + 1] = g + (mg - g) * w;
    p[i + 2] = b + (mb - b) * w;
  }
  return px;
}
