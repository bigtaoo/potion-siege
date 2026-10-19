import { describe, expect, it } from 'vitest';
import { newMeta } from '../../sim/meta';
import { tapLineup } from './lineup';

describe('a tap on the lineup strip', () => {
  it('ignores a potion still locked', () => {
    const m = newMeta();
    expect(tapLineup(m, null, 'poison')).toEqual({ picked: null, swap: null });
  });

  it('swaps a fielded potion for the only reserve', () => {
    const m = newMeta();
    m.unlocked = ['poison'];
    expect(tapLineup(m, null, 'fire')).toEqual({ picked: null, swap: ['fire', 'poison'] });
    expect(m.lineup).toContain('poison');
    expect(m.lineup).not.toContain('fire');
  });

  it('with two reserves, a fielded tap waits for a pick, then swaps the picked one in', () => {
    const m = newMeta();
    m.unlocked = ['poison', 'wind'];
    const before = [...m.lineup];
    expect(tapLineup(m, null, 'fire')).toEqual({ picked: null, swap: null });
    expect(m.lineup).toEqual(before);
    const first = tapLineup(m, null, 'wind');
    expect(first).toEqual({ picked: 'wind', swap: null });
    expect(tapLineup(m, 'wind', 'fire')).toEqual({ picked: null, swap: ['fire', 'wind'] });
    expect(m.lineup[before.indexOf('fire')]).toBe('wind');
  });

  it('a second tap on the picked reserve unpicks it', () => {
    const m = newMeta();
    m.unlocked = ['poison', 'wind'];
    expect(tapLineup(m, 'poison', 'poison')).toEqual({ picked: null, swap: null });
  });
});
