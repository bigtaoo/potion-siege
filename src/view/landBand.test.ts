import './layout/measure';
import { describe, expect, it } from 'vitest';
import { Battle } from '../sim/battle';
import { battleSetup, newMeta } from '../sim/meta';
import { Hud } from './Hud';
import { landBand } from './landBand';
import { LAND } from './wideLayout';

describe('the shelf under a field on its side', () => {
  it('fills the band in the turned board\'s units, from its top left', () => {
    const b = landBand().bounds;
    expect([b.minX, b.minY]).toEqual([0, 0]);
    expect(b.width).toBeCloseTo(LAND.w, 0);
    expect(b.height).toBeCloseTo(LAND.band, 0);
  });

  it('is low (audit V6), and its buttons fit under the rail, back to full size upright', () => {
    expect(LAND.band).toBeLessThanOrEqual(160);
    const h = new Hud(() => {}, () => {}, () => {});
    h.attach(new Battle(1, battleSetup(newMeta(), 1)));
    h.place(LAND.field + LAND.band / 2);
    h.update(0);
    for (const which of ['summon', 'upgrade'] as const) {
      const r = h.buttonRect(which);
      expect(r.y, which).toBeGreaterThanOrEqual(LAND.field + 16 - 0.01);
      expect(r.y + r.h, which).toBeLessThanOrEqual(LAND.field + LAND.band + 0.01);
    }
    h.place(null);
    h.update(0);
    expect(h.buttonRect('upgrade').h).toBe(150);
  });
});
