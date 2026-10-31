import { Texture } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Enemy } from '../sim/types';
import { METALS } from './enemyBake';
import { chapterMetal, enemyLook, statusTint } from './enemyLooks';
import { noCanvas } from './fakeArt';

const calm = { freezeTime: 0, slowTime: 0, burnTime: 0, chargeTime: 0, markTime: 0, rust: 0, poisonTime: 0 } as Enemy;

/** A canvas whose 2D context hands back a grey w x h picture and keeps what is put on it. */
function fakeCanvas() {
  const put: ImageData[] = [];
  vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
  vi.stubGlobal('document', {
    createElement: () => {
      const c = {
        width: 0, height: 0,
        getContext: () => ({
          drawImage: () => {},
          getImageData: (_x: number, _y: number, w: number, h: number) => {
            const data = new Uint8ClampedArray(w * h * 4).fill(140);
            for (let i = 3; i < data.length; i += 4) data[i] = 255;
            return { data, width: w, height: h };
          },
          putImageData: (d: ImageData) => put.push(d),
        }),
      };
      return c;
    },
  });
  return put;
}

const base = () => new Texture({ source: Texture.WHITE.source });

afterEach(() => vi.unstubAllGlobals());

describe('the enemy looks', () => {
  it('tints by the strongest thing on the enemy, white with nothing', () => {
    expect(statusTint(calm)).toBe(0xffffff);
    expect(statusTint({ ...calm, poisonTime: 1 })).not.toBe(0xffffff);
    expect(statusTint({ ...calm, freezeTime: 1, burnTime: 1 })).toBe(statusTint({ ...calm, freezeTime: 1 }));
    const all = ['freezeTime', 'slowTime', 'burnTime', 'chargeTime', 'markTime', 'rust', 'poisonTime'].map((k) => statusTint({ ...calm, [k]: 1 }));
    expect(new Set(all).size).toBe(all.length);
  });

  it('gives each chapter its metal, the last one past the end', () => {
    expect(chapterMetal(1)).toBe(METALS[0]);
    expect(chapterMetal(5)).toBe(METALS[4]);
    expect(chapterMetal(9)).toBe(METALS[4]);
    expect(chapterMetal(0)).toBe(METALS[0]);
  });

  it('draws the art as it comes without a canvas', () => {
    noCanvas();
    const t = base();
    expect(enemyLook(t, 36, 2)).toBe(t);
  });

  it('bakes once per texture and look, rimmed past the edges at the art\'s own size', () => {
    const put = fakeCanvas();
    const t = base();
    const look = enemyLook(t, 36, 3);
    expect(look).not.toBe(t);
    expect([look.width, look.height]).toEqual([t.width, t.height]);
    expect(look.trim.x).toBeLessThan(0);
    expect(enemyLook(t, 36, 3)).toBe(look);
    expect(put.length).toBe(1);
    // the grey look is its own, and the metal one tints the grey
    const grey = enemyLook(t, 36, 0);
    expect(grey).not.toBe(look);
    const [gr, , gb] = put[1].data.slice((put[1].width + 1) * 4, (put[1].width + 1) * 4 + 3);
    expect(gr).toBe(gb);
    const [mr, , mb] = put[0].data.slice((put[0].width + 1) * 4, (put[0].width + 1) * 4 + 3);
    expect(mr).toBeGreaterThan(mb);
  });

  it('keeps only the last chapter asked for, and the grey looks', () => {
    fakeCanvas();
    const t = base();
    const one = enemyLook(t, 36, 1);
    const grey = enemyLook(t, 36, 0);
    enemyLook(t, 36, 2);
    expect(enemyLook(t, 36, 0)).toBe(grey);
    expect(enemyLook(t, 36, 1)).not.toBe(one);
  });

  it("bakes an elite's look apart, rimmed wider and brighter, and keeps it with its chapter", () => {
    const put = fakeCanvas();
    const t = base();
    // a kind so small that a 1 px art is a few rims across
    const plain = enemyLook(t, 0.1, 2);
    const elite = enemyLook(t, 0.1, 2, true);
    expect(elite).not.toBe(plain);
    expect(elite.trim.x).toBeLessThan(plain.trim.x);
    const edge = (p: (typeof put)[number]) => Math.max(...p.data.filter((_, i) => i % 4 === 3 && i < p.width * 4));
    expect(edge(put[1])).toBeGreaterThan(edge(put[0]));
    enemyLook(t, 0.1, 3);
    expect(enemyLook(t, 0.1, 2, true)).not.toBe(elite);
    expect(enemyLook(t, 0.1, 3, true)).toBe(enemyLook(t, 0.1, 3, true));
  });

  it('falls back to the art when baking throws', () => {
    vi.stubGlobal('document', { createElement: () => { throw new Error('no'); } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = base();
    expect(enemyLook(t, 36, 4)).toBe(t);
    expect(warn).toHaveBeenCalled();
  });
});
