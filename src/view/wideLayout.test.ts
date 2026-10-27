import { describe, expect, it } from 'vitest';
import { fitDesign } from './viewport';
import { boardShare, fitBattle, LAND, wideMode } from './wideLayout';

describe('fitBattle', () => {
  it('is fitDesign upright on any portrait screen, and on a wide one with the mode off', () => {
    for (const [w, h, mode] of [[390, 844, 'land'], [768, 1024, 'land'], [1280, 720, 'off']] as const) {
      expect(fitBattle(w, h, mode)).toEqual({ ...fitDesign(w, h), land: false });
    }
  });

  it('turns the field on its side on a wide screen, with the band under it', () => {
    const f = fitBattle(1280, 720, 'land');
    expect(f.land).toBe(true);
    expect((LAND.field + LAND.band) * f.scale).toBeCloseTo(720);
    expect(f.x).toBeGreaterThan(0);
  });

  it('gives the board far more of a 16:9 screen', () => {
    expect(boardShare(fitBattle(1280, 720, 'off'), 1280)).toBeCloseTo(0.316, 2);
    for (const [w, h] of [[1280, 720], [1920, 1080], [800, 450]]) {
      expect(boardShare(fitBattle(w, h, 'land'), w)).toBeCloseTo(0.831, 2);
    }
  });

  it('reads the switch: off keeps the board upright, anything else turns it', () => {
    expect(wideMode('off')).toBe('off');
    expect(wideMode(null)).toBe('land');
    expect(wideMode('crop')).toBe('land');
  });
});
