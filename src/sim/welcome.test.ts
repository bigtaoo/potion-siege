import { describe, expect, it } from 'vitest';
import { gameDay } from './daily';
import { heroUnlocked, newMeta, parseMeta, unlockHero } from './meta';
import { canClaimWelcome, claimWelcome, welcomeGift, welcomeOn, WELCOME_GIFTS, WELCOME_POTION } from './welcome';

const day = (n: number) => `2026-11-${String(n).padStart(2, '0')}`;

describe('welcome week', () => {
  it('waits for the first battle, then gives one gift a day', () => {
    const m = newMeta();
    expect(welcomeOn(m)).toBe(true);
    expect(canClaimWelcome(m, day(1))).toBe(false);
    m.runs = 1;
    expect(claimWelcome(m, day(1))).toEqual({ crystals: WELCOME_GIFTS[0], potion: null });
    expect(m.crystals).toBe(WELCOME_GIFTS[0]);
    expect(claimWelcome(m, day(1))).toBeNull();
    // a missed day costs nothing: the next visit gives the next gift
    expect(claimWelcome(m, day(4))?.crystals).toBe(WELCOME_GIFTS[1]);
    expect(m.welcome).toEqual({ gifts: 2, day: day(4) });
  });

  it('ends with the potion, or its crystals when it is owned', () => {
    const m = newMeta();
    m.runs = 1;
    for (let i = 0; i < WELCOME_GIFTS.length - 1; i++) claimWelcome(m, day(i + 1));
    expect(heroUnlocked(m, WELCOME_POTION)).toBe(false);
    expect(claimWelcome(m, day(9))).toEqual({ crystals: 0, potion: WELCOME_POTION });
    expect(heroUnlocked(m, WELCOME_POTION)).toBe(true);
    expect(welcomeOn(m)).toBe(false);
    expect(claimWelcome(m, day(10))).toBeNull();

    const owned = newMeta();
    unlockHero(owned, WELCOME_POTION);
    expect(welcomeGift(owned, WELCOME_GIFTS.length - 1)).toEqual({ crystals: WELCOME_GIFTS[WELCOME_GIFTS.length - 1], potion: null });
  });

  it('keeps the week through a save, and old saves that have played skip it', () => {
    const m = newMeta();
    m.runs = 2;
    claimWelcome(m, day(3));
    expect(parseMeta(JSON.stringify(m)).welcome).toEqual({ gifts: 1, day: day(3) });
    const old = { ...newMeta(), v: 1, runs: 5 } as Record<string, unknown>;
    delete old.welcome;
    expect(welcomeOn(parseMeta(JSON.stringify(old)))).toBe(false);
    const fresh = { ...newMeta(), v: 1 } as Record<string, unknown>;
    delete fresh.welcome;
    expect(parseMeta(JSON.stringify(fresh)).welcome).toEqual({ gifts: 0, day: '' });
    expect(parseMeta(JSON.stringify({ ...m, welcome: { gifts: 'x', day: 4 } })).welcome.gifts).toBe(WELCOME_GIFTS.length);
  });

  it('counts the last claim day so a clock set back pays nothing twice', () => {
    const m = newMeta();
    m.runs = 1;
    claimWelcome(m, day(5));
    const today = gameDay(m, new Date(2026, 10, 2));
    expect(today).toBe(day(5));
    expect(canClaimWelcome(m, today)).toBe(false);
  });
});
