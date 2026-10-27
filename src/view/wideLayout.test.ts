import { describe, expect, it } from 'vitest';
import { fitDesign } from './viewport';
import { boardShare, CUT, fitBattle, LAND, wideMode } from './wideLayout';

describe('fitBattle', () => {
  it('is fitDesign with the mode off, and on any portrait screen', () => {
    for (const [w, h] of [[1280, 720], [390, 844], [768, 1024]]) {
      const f = fitBattle(w, h, w > h ? 'off' : 'both');
      expect({ scale: f.scale, x: f.x, y: f.y }).toEqual(fitDesign(w, h));
      expect([f.top, f.out]).toEqual([0, null]);
    }
  });

  it('shows the field from its cut down to the bottom edge on a wide screen', () => {
    for (const mode of ['side', 'crop', 'both'] as const) {
      const f = fitBattle(1280, 720, mode);
      expect(f.top).toBeCloseTo(mode === 'side' ? CUT.side : CUT.crop);
      expect(f.y + 1920 * f.scale).toBeCloseTo(720);
    }
  });

  it('puts the buttons out in the side columns only when the mode moves them', () => {
    expect(fitBattle(1920, 1080, 'crop').out).toBeNull();
    const f = fitBattle(1920, 1080, 'both');
    // the middle of the left column, in design units left of the board
    expect(f.out! * f.scale).toBeCloseTo(f.x / 2);
  });

  it('gives the board a bigger share of a 16:9 screen', () => {
    const off = boardShare(fitBattle(1280, 720, 'off'), 1280);
    const crop = boardShare(fitBattle(1280, 720, 'crop'), 1280);
    expect(off).toBeCloseTo(0.316, 2);
    expect(boardShare(fitBattle(1280, 720, 'side'), 1280)).toBeCloseTo(0.343, 2);
    expect(crop).toBeCloseTo(0.44, 2);
    expect(boardShare(fitBattle(800, 450, 'crop'), 800)).toBeCloseTo(crop);
  });

  it('reads the switch, anything else being off', () => {
    expect(wideMode('crop')).toBe('crop');
    expect(wideMode(null)).toBe('off');
    expect(wideMode('huge')).toBe('off');
  });
});

describe('the field turned on its side', () => {
  it('fits the turned field and its band on a wide screen, upright on a tall one', () => {
    const f = fitBattle(1280, 720, 'land');
    expect(f.land).toBe(true);
    expect((LAND.field + LAND.band) * f.scale).toBeCloseTo(720);
    expect(boardShare(f, 1280)).toBeCloseTo(0.831, 2);
    expect(boardShare(fitBattle(1920, 1080, 'land'), 1920)).toBeCloseTo(0.831, 2);
    expect(fitBattle(390, 844, 'land')).toEqual({ ...fitDesign(390, 844), top: 0, out: null, land: false });
  });
});
