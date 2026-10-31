import { describe, expect, it } from 'vitest';
import { METALS, RIM, metalAt, metalled, rimmed, type Pixels } from './enemyBake';

/** A w x h picture, each pixel [r, g, b, a] from `at`. */
function pic(w: number, h: number, at: (x: number, y: number) => number[]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(at(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
}
const px = (p: Pixels, x: number, y: number) => [...p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];

describe('the rim', () => {
  const dot = pic(5, 5, (x, y) => (x === 2 && y === 2 ? [10, 20, 30, 255] : [0, 0, 0, 0]));

  it('pads the picture on every side, the art in the middle as it was', () => {
    const r = rimmed(dot, 3);
    expect([r.width, r.height]).toEqual([11, 11]);
    expect(px(r, 5, 5)).toEqual([10, 20, 30, 255]);
  });

  it('rings the solid pixels in the rim colour out to the pad, nothing past it', () => {
    const r = rimmed(dot, 3);
    const rim = [(RIM >> 16) & 255, (RIM >> 8) & 255, RIM & 255];
    expect(px(r, 7, 5).slice(0, 3)).toEqual(rim);
    expect(px(r, 7, 5)[3]).toBeGreaterThan(200);
    expect(px(r, 5, 2)[3]).toBeGreaterThan(0);
    expect(px(r, 9, 5)[3]).toBe(0);
    expect(px(r, 0, 0)[3]).toBe(0);
  });

  it('counts a faint pixel as empty, but keeps it over the rim', () => {
    const faint = pic(3, 1, (x) => (x === 1 ? [255, 0, 0, 100] : [0, 0, 0, 0]));
    const r = rimmed(faint, 1);
    expect(px(r, 0, 1)[3]).toBe(0);
    const blend = rimmed(pic(3, 1, (x) => (x === 0 ? [0, 0, 0, 255] : x === 1 ? [255, 0, 0, 100] : [0, 0, 0, 0])), 1);
    const [r1, , , a1] = px(blend, 2, 1);
    expect(a1).toBeGreaterThan(100);
    expect(r1).toBeGreaterThan(250);
  });
});

describe('the metal', () => {
  const copper = METALS[0];

  it('runs black, shadow, body, shine up the lightness', () => {
    expect(metalAt(copper, 0)).toEqual([0, 0, 0]);
    const hex = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    expect(metalAt(copper, 0.25)).toEqual(hex(copper[0]));
    expect(metalAt(copper, 0.55)).toEqual(hex(copper[1]));
    expect(metalAt(copper, 1)).toEqual(hex(copper[2]));
    expect(metalAt(copper, 0.4)[0]).toBeGreaterThan(hex(copper[0])[0]);
  });

  it('turns grey to the metal, leaves coloured parts and empty pixels be', () => {
    const p = pic(3, 1, (x) => [[140, 140, 140, 255], [230, 30, 30, 255], [140, 140, 140, 0]][x]);
    metalled(p, copper);
    const [r, g, b] = px(p, 0, 0);
    expect(r).toBeGreaterThan(b + 40);
    expect(g).not.toBe(140);
    expect(px(p, 1, 0)).toEqual([230, 30, 30, 255]);
    expect(px(p, 2, 0)).toEqual([140, 140, 140, 0]);
  });

  it('has a distinct metal for each of the five chapters', () => {
    expect(new Set(METALS.map((m) => m[1])).size).toBe(5);
  });
});
