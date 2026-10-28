import { describe, expect, it } from 'vitest';
import { battleSetup, newMeta } from '../sim/meta';
import { endlessSetup } from '../sim/endless';
import { hardSetup } from '../sim/stars';
import { canHurry } from './battleSpeed';

describe('battleSpeed', () => {
  it('offers the 1.5x on a stage won before, not on the next one', () => {
    const m = newMeta();
    expect(canHurry(m, battleSetup(m, 1))).toBe(false);
    m.cleared = 3;
    expect(canHurry(m, battleSetup(m, 3))).toBe(true);
    expect(canHurry(m, battleSetup(m, 4))).toBe(false);
  });

  it('on hard mode, only once that stage was won on hard', () => {
    const m = newMeta();
    m.cleared = 10;
    expect(canHurry(m, hardSetup(battleSetup(m, 2)))).toBe(false);
    m.stars.hard[1] = 1;
    expect(canHurry(m, hardSetup(battleSetup(m, 2)))).toBe(true);
  });

  it('never in endless mode', () => {
    const m = newMeta();
    m.cleared = 50;
    expect(canHurry(m, endlessSetup(m))).toBe(false);
  });
});
