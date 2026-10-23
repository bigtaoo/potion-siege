import { describe, expect, it } from 'vitest';
import {
  achievementsClaimable, claimTier, nextTier, recordChallenge, recordEvents, TRACK_IDS, TRACKS, trackProgress, trackReady,
} from './achievements';
import { claimLogin } from './daily';
import { newMeta, parseMeta } from './meta';
import { BALANCE, ENEMY_KINDS, HERO_KINDS, type BattleEvent } from './types';
import { FIRST_STAGE } from './waves';

const merge = (kind: (typeof HERO_KINDS)[number], star: number): BattleEvent => ({ type: 'merge', slot: 0, star, kind });
const kill = (kind: (typeof ENEMY_KINDS)[number]): BattleEvent => ({ type: 'kill', kind, x: 0, y: 0, gold: 1, boss: kind === 'boss' });

describe('achievements', () => {
  it('pays about 7770 crystals in all (600 of them for endless waves, 3000 for stars and hard stages, 420 for challenge streaks), every tier above the one before', () => {
    let total = 0;
    for (const id of TRACK_IDS) {
      TRACKS[id].forEach((tier, i) => {
        total += tier.reward;
        if (i > 0) expect(tier.goal).toBeGreaterThan(TRACKS[id][i - 1].goal);
      });
    }
    expect(total).toBe(7770);
  });

  it('starts with nothing to claim', () => {
    expect(achievementsClaimable(newMeta())).toBe(false);
  });

  it('claims tiers in order, once each, and pays them', () => {
    const m = newMeta();
    m.cleared = 6;
    expect(trackReady(m, 'stages')).toBe(true);
    expect(claimTier(m, 'stages')).toBe(30);
    expect(claimTier(m, 'stages')).toBe(100);
    // stage 10 not cleared: the third tier waits
    expect(claimTier(m, 'stages')).toBe(0);
    expect(m.crystals).toBe(130);
    expect(nextTier(m, 'stages')).toBe(2);
    m.cleared = 20;
    while (claimTier(m, 'stages') > 0);
    expect(nextTier(m, 'stages')).toBeNull();
    expect(trackReady(m, 'stages')).toBe(false);
  });

  it('counts merges, kills, ultimates and the kinds beaten from battle events', () => {
    const m = newMeta();
    recordEvents(m, [merge('fire', 2), merge('fire', BALANCE.maxStar), merge('fire', BALANCE.maxStar), merge('ice', BALANCE.maxStar), kill('grunt'), kill('grunt')]);
    const s = m.achievements.stats;
    expect(s.merges).toBe(4);
    expect(s.kills).toBe(2);
    expect(s.ultimates).toEqual(['fire', 'ice']);
    expect(s.beaten).toEqual(['grunt']);
    expect(trackReady(m, 'ultimates')).toBe(true);
    // the first enemies tier wants a boss, not just any kind
    expect(trackReady(m, 'enemies')).toBe(false);
    recordEvents(m, [kill('boss')]);
    expect(claimTier(m, 'enemies')).toBe(80);
    expect(trackProgress(m, 'enemies', 1)).toBe(2);
  });

  it('reads levels, unlocks, battles, logins, the challenge and the workshop off the save', () => {
    const m = newMeta();
    m.heroes.ice = 10;
    // a locked potion's level does not count
    m.heroes.wind = 20;
    expect(trackProgress(m, 'level', 0)).toBe(10);
    m.unlocked.push('poison');
    expect(trackReady(m, 'unlock')).toBe(true);
    m.runs = 10;
    expect(trackReady(m, 'battles')).toBe(true);
    for (let d = 10; d < 17; d++) claimLogin(m, `2026-10-${d}`);
    expect(trackReady(m, 'login')).toBe(true);
    recordChallenge(m, 2);
    recordChallenge(m, 1);
    expect(trackProgress(m, 'challenge', 0)).toBe(2);
    expect(trackReady(m, 'challenge')).toBe(false);
    recordChallenge(m, BALANCE.challenge.tiers.length);
    expect(trackReady(m, 'challenge')).toBe(true);
    expect(trackReady(m, 'workshop')).toBe(false);
    m.workshop.wall = BALANCE.meta.workshop.wall.max;
    expect(trackReady(m, 'workshop')).toBe(true);
  });

  it('keeps stats and claimed tiers through a save, and fills in an old save', () => {
    const m = newMeta();
    recordEvents(m, [merge('arcane', BALANCE.maxStar), kill('runner')]);
    m.cleared = 1;
    claimTier(m, 'stages');
    const back = parseMeta(JSON.stringify(m));
    expect(back.achievements).toEqual(m.achievements);

    // from before achievements: the kinds its cleared stages sent count as beaten, nothing claimed
    const old = parseMeta(JSON.stringify({ cleared: 20, runs: 60, crystals: 5 }));
    expect(old.achievements.stats.beaten).toEqual(ENEMY_KINDS.filter((k) => FIRST_STAGE[k] <= 20));
    expect(old.achievements.claimed.stages).toBe(0);
    expect(trackReady(old, 'stages')).toBe(true);
    expect(trackReady(old, 'enemies')).toBe(true);
    expect(trackReady(old, 'battles')).toBe(true);

    // junk is dropped, claimed tiers held to the track's length
    const junk = parseMeta(JSON.stringify({ achievements: { stats: { merges: -4, ultimates: ['fire', 'nope', 'fire'], beaten: 'x' }, claimed: { stages: 99, level: 'a' } } }));
    expect(junk.achievements.stats.merges).toBe(0);
    expect(junk.achievements.stats.ultimates).toEqual(['fire']);
    expect(junk.achievements.stats.beaten).toEqual([]);
    expect(junk.achievements.claimed.stages).toBe(TRACKS.stages.length);
    expect(junk.achievements.claimed.level).toBe(0);
  });
});
