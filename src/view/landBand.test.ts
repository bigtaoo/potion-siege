import { describe, expect, it } from 'vitest';
import { landBand } from './landBand';
import { LAND } from './wideLayout';

describe('the shelf under a field on its side', () => {
  it('fills the band in the turned board\'s units, from its top left', () => {
    const b = landBand().bounds;
    expect([b.minX, b.minY]).toEqual([0, 0]);
    expect(b.width).toBeCloseTo(LAND.w, 0);
    expect(b.height).toBeCloseTo(LAND.band, 0);
  });
});
