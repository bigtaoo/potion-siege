import { describe, expect, it } from 'vitest';
import { attemptsUsed, beginAttempt, bookAttempt, canPlayFree, streak } from './challenge';
import { canClaimLogin, claimLogin, gameDay, parseDaily, rollDay } from './daily';
import { adsLeft, buyHero, buyUnlock, buyWorkshop, chestReady, claimAd, claimChest, newMeta, parseMeta, SAVE_VERSION, type MetaSave } from './meta';
import { BALANCE } from './types';

// What a save must survive outside the game's own rules: an older build reading a newer save
// (an OTA rollback), a device clock turned back, and a hand-edited number.

const M = BALANCE.meta;

describe('a save written by a newer build', () => {
  it('keeps the fields this build does not know, top level and one level down', () => {
    const newer = { ...newMeta(), v: SAVE_VERSION + 1, laterThing: { a: 1 }, daily: { ...newMeta().daily, laterDaily: 7 } };
    const m = parseMeta(JSON.stringify(newer));
    const again = JSON.parse(JSON.stringify(m)) as Record<string, unknown>;
    expect(again.laterThing).toEqual({ a: 1 });
    expect((again.daily as Record<string, unknown>).laterDaily).toBe(7);
    // and a known field still comes from the parse, not the raw save
    expect(parseMeta(JSON.stringify({ ...newer, crystals: 'lots' })).crystals).toBe(0);
  });

  it('never lowers its version, cleared stage or hero levels, even after this build wrote it', () => {
    const newer = { ...newMeta(), v: SAVE_VERSION + 1, cleared: M.stageCount + 10, heroes: { ...newMeta().heroes, fire: M.heroMax + 5 } };
    let m = parseMeta(JSON.stringify(newer));
    for (let i = 0; i < 2; i++) m = parseMeta(JSON.stringify(m));
    expect([m.v, m.cleared, m.heroes.fire]).toEqual([SAVE_VERSION + 1, M.stageCount + 10, M.heroMax + 5]);
    // nothing past this build's cap can be bought
    m.crystals = 1e9;
    expect(buyHero(m, 'fire')).toBe(false);
  });

  it('clamps a save of this version or older as before', () => {
    const m = parseMeta(JSON.stringify({ cleared: M.stageCount + 10, heroes: { fire: M.heroMax + 5 } }));
    expect([m.v, m.cleared, m.heroes.fire]).toEqual([SAVE_VERSION, M.stageCount, M.heroMax]);
  });
});

describe('a device clock turned back', () => {
  /** A save that played on `day`: tasks rolled, login, chest, a shop ad and a challenge. */
  function played(day: string): MetaSave {
    const m = newMeta();
    m.cleared = 10;
    rollDay(m, day);
    claimLogin(m, day);
    claimChest(m, day);
    claimAd(m, day);
    beginAttempt(m, day, false);
    bookAttempt(m, 99);
    return m;
  }

  it('reads as the latest day the save has seen', () => {
    const m = played('2026-10-22');
    expect(gameDay(m, new Date(2026, 9, 20))).toBe('2026-10-22');
    expect(gameDay(m, new Date(2026, 9, 23))).toBe('2026-10-23');
    // a broken stored day is no day at all
    m.daily.day = 'zzzz';
    m.daily.lastClaim = m.shop.chestDay = m.shop.adDay = m.challenge.date = '';
    expect(gameDay(m, new Date(2026, 9, 20))).toBe('2026-10-20');
  });

  it('pays nothing again for an earlier date passed in directly', () => {
    const m = played('2026-10-22');
    const crystals = m.crystals;
    const tasks = JSON.stringify(m.daily.tasks);
    const earlier = '2026-10-21';
    rollDay(m, earlier);
    expect(JSON.stringify(m.daily.tasks)).toBe(tasks);
    expect(canClaimLogin(m, earlier)).toBe(false);
    expect(claimLogin(m, earlier)).toBe(0);
    expect(chestReady(m, earlier)).toBe(false);
    expect(claimChest(m, earlier)).toBe(0);
    expect(adsLeft(m, earlier)).toBe(adsLeft(m, '2026-10-22'));
    expect(attemptsUsed(m, earlier)).toBe(1);
    expect(canPlayFree(m, earlier)).toBe(false);
    expect(beginAttempt(m, earlier, false)).toBeNull();
    expect(bookAttempt(m, 99).crystals).toBe(0);
    expect(streak(m, earlier)).toBe(1);
    expect(m.crystals).toBe(crystals);
    // the next real day pays as usual
    expect(claimLogin(m, '2026-10-23')).toBeGreaterThan(0);
    expect(beginAttempt(m, '2026-10-23', false)).not.toBeNull();
    expect(streak(m, '2026-10-23')).toBe(2);
  });
});

describe('a hand-edited number', () => {
  it('reads "Infinity" login claims as a sane count, so crystals stay a number', () => {
    for (const claims of ['Infinity', Infinity, 1e400, '-Infinity', 'NaN']) {
      const d = parseDaily({ claims, doubles: claims, tasks: [{ id: 'kill', progress: claims }] });
      expect(Number.isFinite(d.claims)).toBe(true);
      expect(Number.isFinite(d.doubles)).toBe(true);
      expect(Number.isFinite(d.tasks[0].progress)).toBe(true);
    }
    const m = parseMeta(JSON.stringify({ daily: { claims: 'Infinity' } }));
    claimLogin(m, '2026-10-22');
    expect(Number.isFinite(m.crystals)).toBe(true);
  });

  it('sells nothing for crystals that are not a number', () => {
    const m = newMeta();
    m.crystals = NaN;
    expect(buyHero(m, 'fire')).toBe(false);
    expect(buyWorkshop(m, 'wall')).toBe(false);
    expect(buyUnlock(m, 'wind')).toBe(false);
    expect([m.heroes.fire, m.workshop.wall, m.unlocked]).toEqual([1, 0, []]);
  });
});
