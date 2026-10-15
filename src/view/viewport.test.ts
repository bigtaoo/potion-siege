import { describe, expect, it } from 'vitest';
import { DESIGN_H, DESIGN_W, fitDesign } from './viewport';

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
