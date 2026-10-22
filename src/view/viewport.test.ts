import { describe, expect, it } from 'vitest';
import { DESIGN_H, DESIGN_W, fitDesign, fitMenu, textBoost } from './viewport';

describe('fitDesign', () => {
  it('fills a 9:16 phone exactly', () => {
    expect(fitDesign(540, 960)).toEqual({ scale: 0.5, x: 0, y: 0 });
  });

  it('centres the board with side bars on a landscape screen', () => {
    const f = fitDesign(1920, 1080);
    expect(f.scale).toBeCloseTo(1080 / DESIGN_H);
    expect(f.y).toBe(0);
    expect(f.x).toBeCloseTo((1920 - DESIGN_W * f.scale) / 2);
  });

  it('keeps the whole board on a tall phone', () => {
    const f = fitDesign(390, 844);
    expect(DESIGN_H * f.scale).toBeLessThanOrEqual(844);
    expect(f.x).toBe(0);
  });
});

describe('fitMenu', () => {
  it('gives a page with no size the design page, and a real size after it differs', () => {
    for (const [w, h] of [[0, 0], [0, 800], [NaN, 600]]) {
      const f = fitMenu(w, h);
      expect([f.scale, f.w, f.h, f.wide]).toEqual([1, DESIGN_W, DESIGN_H, false]);
    }
    expect(fitMenu(390, 844).h).not.toBeCloseTo(DESIGN_H);
  });

  it('gives a phone a portrait page, filling the extra height', () => {
    const f = fitMenu(390, 844);
    expect(f.wide).toBe(false);
    expect(f.w).toBeCloseTo(DESIGN_W);
    expect(f.h).toBeGreaterThan(DESIGN_H);
  });

  it('gives a desktop screen a landscape page', () => {
    const f = fitMenu(1920, 1080);
    expect(f).toMatchObject({ wide: true, scale: 1, w: 1920, h: 1080 });
    expect(fitMenu(2560, 1080).w).toBeCloseTo(2560);
  });
});

describe('textBoost', () => {
  it('leaves big boards alone and grows the words on an 800x450 embed, within bounds', () => {
    expect(textBoost(fitDesign(1280, 720).scale)).toBe(1);
    expect(textBoost(fitDesign(390, 844).scale)).toBe(1);
    expect(textBoost(fitDesign(1920, 1080).scale)).toBe(1);
    const small = textBoost(fitDesign(800, 450).scale);
    expect(small).toBeGreaterThan(1.4);
    expect(small).toBeLessThanOrEqual(1.5);
  });
});
