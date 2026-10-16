import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import {
  attemptsUsed, beginAttempt, bestToday, bookAttempt, canPlayAd, canPlayFree, challengeFresh, challengeLineup, challengeSetup, challengeStage,
  MODIFIER_IDS, msToTomorrow, newChallenge, parseChallenge, prevDay, streak, tierOf, todaysChallenge, type ModifierId,
} from './challenge';
import { battleSetup, newMeta, parseMeta } from './meta';
import { BALANCE, HERO_KINDS } from './types';
import { isBossWave, planWave } from './waves';
import { Prng } from './math/prng';

const C = BALANCE.challenge;

/** The `n`th day of 2026, as `dayOf` writes it. */
function day(n: number): string {
  const at = new Date(2026, 0, n);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}`;
}

/** The first day of 2026 whose challenge has `mod` (and not `without`). */
function dayWith(mod: ModifierId, without?: ModifierId): string {
  for (let n = 1; n < 400; n++) {
    const mods = todaysChallenge(newMeta(), day(n)).mods;
    if (mods.includes(mod) && (!without || !mods.includes(without))) return day(n);
  }
  throw new Error(`no day with ${mod}`);
}

describe('daily challenge', () => {
  it('is the same for everyone on a day and changes from day to day', () => {
    const a = todaysChallenge(newMeta(), '2026-10-16');
    expect(todaysChallenge(newMeta(), '2026-10-16')).toEqual(a);
    expect(a.mods).toHaveLength(C.modifiers);
    expect(new Set(a.mods).size).toBe(C.modifiers);
    for (const id of a.mods) expect(MODIFIER_IDS).toContain(id);
    const seeds = new Set(Array.from({ length: 30 }, (_, i) => todaysChallenge(newMeta(), day(i + 1)).seed));
    expect(seeds.size).toBe(30);
    // every modifier turns up within a couple of months
    const seen = new Set(Array.from({ length: 60 }, (_, i) => todaysChallenge(newMeta(), day(i + 1)).mods).flat());
    expect(seen.size).toBe(MODIFIER_IDS.length);
  });

  it('is fought two stages past the furthest cleared, never below 3', () => {
    const m = newMeta();
    expect(challengeStage(m)).toBe(3);
    m.cleared = 1;
    expect(challengeStage(m)).toBe(3);
    m.cleared = 4;
    expect(challengeStage(m)).toBe(6);
    m.cleared = 99;
    expect(challengeStage(m)).toBe(BALANCE.meta.stageCount);
  });

  it('names a trial potion only under the trial modifier, and puts it in the lineup', () => {
    const m = newMeta();
    const c = todaysChallenge(m, dayWith('trial'));
    expect(c.trial).not.toBeNull();
    const lineup = challengeLineup(m, c);
    expect(lineup).toContain(c.trial);
    if (!c.mods.includes('solo')) expect(lineup).toHaveLength(m.lineup.length);
    const plain = todaysChallenge(m, dayWith('swift', 'trial'));
    expect(plain.trial).toBeNull();
    if (!plain.mods.includes('solo')) expect(challengeLineup(m, plain)).toEqual(HERO_KINDS.filter((k) => m.lineup.includes(k)));
  });

  it('cuts the lineup to three kinds under solo, the trial potion kept', () => {
    const m = newMeta();
    const c = todaysChallenge(m, dayWith('solo'));
    const lineup = challengeLineup(m, c);
    expect(lineup).toHaveLength(C.mods.solo.kinds);
    expect(new Set(lineup).size).toBe(lineup.length);
    if (c.trial) expect(lineup).toContain(c.trial);
    expect(challengeLineup(m, { ...c, trial: 'poison', mods: ['solo', 'trial'] })).toContain('poison');
  });

  it('bends the battle by its modifiers', () => {
    const m = newMeta();
    const base = battleSetup(m, 3);
    const c = todaysChallenge(m, '2026-10-16');
    const all = (mods: ModifierId[]) => challengeSetup(m, { ...c, mods, trial: null });
    expect(all([]).modifiers).toEqual({ enemySpeed: 1, summonCost: 1, waveGold: 1, killGold: 1, crit: 0, bossWaves: BALANCE.waves.bossWaves, banned: [] });
    expect(all([]).stage).toBe(3);
    expect(all(['swift']).modifiers!.enemySpeed).toBe(C.mods.swift.speed);
    const iron = all(['ironWall']);
    expect(iron.wallHp).toBeCloseTo(base.wallHp * C.mods.ironWall.wall);
    expect(iron.modifiers!.banned).toEqual(['wallRepair']);
    const cheap = all(['cheap']).modifiers!;
    expect([cheap.summonCost, cheap.waveGold]).toEqual([C.mods.cheap.summon, C.mods.cheap.waveGold]);
    expect(all(['twinBoss']).modifiers!.bossWaves).toEqual([...new Set([...BALANCE.waves.bossWaves, ...C.mods.twinBoss.waves])].sort((a, b) => a - b));
    const crit = all(['critDay']);
    expect(crit.modifiers!.crit).toBe(C.mods.critDay.crit);
    expect(crit.enemyHp).toBeCloseTo(base.enemyHp * C.mods.critDay.hp);
    const rain = all(['goldRain']);
    expect(rain.startGold).toBe(C.mods.goldRain.startGold);
    expect(rain.modifiers!.killGold).toBe(C.mods.goldRain.killGold);
  });

  it('makes summons cheaper and brings extra bosses in battle', () => {
    const m = newMeta();
    const c = { ...todaysChallenge(m, '2026-10-16'), trial: null };
    const plain = new Battle(1, challengeSetup(m, { ...c, mods: [] }));
    const cheap = new Battle(1, challengeSetup(m, { ...c, mods: ['cheap'] }));
    expect(cheap.summonCost()).toBeLessThan(plain.summonCost());
    expect(cheap.summonCost() % 5).toBe(0);
    const twin = challengeSetup(m, { ...c, mods: ['twinBoss'] }).modifiers!.bossWaves;
    for (const w of C.mods.twinBoss.waves) {
      expect(isBossWave(w, twin)).toBe(true);
      expect(isBossWave(w)).toBe(false);
      expect(planWave(w, new Prng(1), 3, twin)[0].kind).toBe('boss');
    }
    // the iron wall never offers the repair
    const iron = new Battle(2, challengeSetup(m, { ...c, mods: ['ironWall'] }));
    for (let i = 0; i < 3000 && !iron.result; i++) {
      if (iron.choices) {
        expect(iron.choices).not.toContain('wallRepair');
        iron.choose(iron.choices[0]);
      }
      iron.summon();
      iron.upgrade();
      iron.step();
      iron.step();
    }
  });

  it('gives one free attempt and one more for a rewarded ad', () => {
    const m = newMeta();
    const d = '2026-10-16';
    expect(challengeFresh(m, d)).toBe(true);
    expect(canPlayFree(m, d)).toBe(true);
    expect(canPlayAd(m, d)).toBe(false);
    expect(beginAttempt(m, d, true)).toBeNull();
    expect(beginAttempt(m, d, false)).toBe(0);
    expect(attemptsUsed(m, d)).toBe(1);
    expect(challengeFresh(m, d)).toBe(false);
    expect(canPlayFree(m, d)).toBe(false);
    expect(canPlayAd(m, d)).toBe(true);
    expect(beginAttempt(m, d, false)).toBeNull();
    expect(beginAttempt(m, d, true)).toBe(0);
    expect(canPlayAd(m, d)).toBe(false);
    expect(beginAttempt(m, d, true)).toBeNull();
    // a new day, a new free attempt
    expect(canPlayFree(m, '2026-10-17')).toBe(true);
    expect(attemptsUsed(m, '2026-10-17')).toBe(0);
  });

  it('pays the best tier once a day: only what a better attempt adds', () => {
    expect([0, 2, 3, 5, 6, 9, 10, 30].map(tierOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    const m = newMeta();
    const d = '2026-10-16';
    beginAttempt(m, d, false);
    const first = bookAttempt(m, 7);
    expect(first).toEqual({ wave: 7, best: 7, tier: 2, bestTier: 2, crystals: C.tiers[1].reward });
    expect(m.crystals).toBe(C.tiers[1].reward);
    beginAttempt(m, d, true);
    expect(bookAttempt(m, 4)).toEqual({ wave: 4, best: 7, tier: 1, bestTier: 2, crystals: 0 });
    expect(m.crystals).toBe(C.tiers[1].reward);
    expect(bestToday(m, d)).toBe(7);
    expect(bestToday(m, '2026-10-17')).toBe(0);
    // a better try tops the day up to the higher tier, no more
    m.challenge.attempts = 1;
    beginAttempt(m, d, true);
    expect(bookAttempt(m, 12).crystals).toBe(C.tiers[2].reward - C.tiers[1].reward);
    expect(m.crystals).toBe(C.tiers[2].reward);
    // the next day starts from nothing
    beginAttempt(m, '2026-10-17', false);
    expect(bookAttempt(m, 3).crystals).toBe(C.tiers[0].reward);
  });

  it('counts days in a row and pays the streak bonus every seventh', () => {
    const m = newMeta();
    const bonuses: number[] = [];
    for (let n = 1; n <= 14; n++) bonuses.push(beginAttempt(m, day(n), false)!);
    expect(streak(m, day(14))).toBe(14);
    expect(streak(m, day(15))).toBe(14);
    expect(bonuses.filter((b) => b > 0)).toEqual([C.streakReward, C.streakReward]);
    expect(bonuses[C.streakDays - 1]).toBe(C.streakReward);
    expect(m.crystals).toBe(2 * C.streakReward);
    // the ad retry does not move the streak
    beginAttempt(m, day(14), true);
    expect(m.challenge.streak).toBe(14);
    // a missed day breaks it
    expect(streak(m, day(16))).toBe(0);
    beginAttempt(m, day(16), false);
    expect(m.challenge.streak).toBe(1);
  });

  it('knows the day before across months and years, and the time to midnight', () => {
    expect(prevDay('2026-03-01')).toBe('2026-02-28');
    expect(prevDay('2027-01-01')).toBe('2026-12-31');
    expect(prevDay('2026-10-16')).toBe('2026-10-15');
    expect(msToTomorrow(new Date(2026, 9, 16, 23, 59, 0))).toBe(60_000);
  });

  it('reads stored challenge parts safely', () => {
    expect(parseChallenge(undefined)).toEqual(newChallenge());
    expect(parseChallenge({ date: '2026-10-16', attempts: 9, best: -3, streak: 'x' })).toEqual({ date: '2026-10-16', attempts: C.attempts + C.adAttempts, best: 0, streak: 0 });
    const m = newMeta();
    beginAttempt(m, '2026-10-16', false);
    bookAttempt(m, 6);
    expect(parseMeta(JSON.stringify(m)).challenge).toEqual(m.challenge);
  });
});
