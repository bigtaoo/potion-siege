import { describe, expect, it } from 'vitest';
import { buyUnlock, newMeta, unlockHero } from './meta';
import { liftUnlocked, unlockLevel } from './heroUnlock';
import { BALANCE, LINEUP } from './types';

describe('a potion unlocked late', () => {
  it('starts at half the open potions\' average level', () => {
    const m = newMeta();
    for (const k of LINEUP) m.heroes[k] = 20;
    m.heroes.fire = 30; // average of the open four: (20 * 3 + 30) / 4 = 22.5
    const kind = (['arcane', 'fire', 'ice', 'lightning', 'poison', 'wind'] as const).find((k) => !LINEUP.includes(k))!;
    expect(unlockLevel(m, kind)).toBe(11);
    expect(unlockHero(m, kind)).toBe(true);
    expect(m.heroes[kind]).toBe(11);
    // unlocking again changes nothing
    m.heroes[kind] = 2;
    expect(unlockHero(m, kind)).toBe(false);
    expect(m.heroes[kind]).toBe(2);
  });

  it('never lowers a level and never passes the cap', () => {
    const m = newMeta();
    const kind = (['arcane', 'fire', 'ice', 'lightning', 'poison', 'wind'] as const).find((k) => !LINEUP.includes(k))!;
    m.heroes[kind] = 5;
    liftUnlocked(m, kind); // the starting four at level 1
    expect(m.heroes[kind]).toBe(5);
    for (const k of LINEUP) m.heroes[k] = 10_000;
    expect(unlockLevel(m, kind)).toBe(BALANCE.meta.heroMax);
  });

  it('applies to a potion bought in the shop too', () => {
    const m = newMeta();
    for (const k of LINEUP) m.heroes[k] = 16;
    m.crystals = 1e9;
    const kind = (['arcane', 'fire', 'ice', 'lightning', 'poison', 'wind'] as const).find((k) => !LINEUP.includes(k))!;
    if (buyUnlock(m, kind)) expect(m.heroes[kind]).toBe(8);
  });
});
