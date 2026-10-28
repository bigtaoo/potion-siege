import { describe, expect, it } from 'vitest';
import { trackProgress } from './achievements';
import { battleSetup, newMeta, parseMeta, Purse, runReward, stageHp, type MetaSave } from './meta';
import {
  bookStars, chapterStars, furthestHard, hardCleared, hardOpen, hardPlayable, hardReward, hardSetup, playingHard, runStars, setHardMode, stageOpen, stageSetup, STARS, stepStage, totalStars,
} from './stars';
import { BALANCE } from './types';

/** A save with the first `cleared` stages cleared, each on `stars` stars. */
function save(cleared: number, stars = 3): MetaSave {
  const m = newMeta();
  m.cleared = cleared;
  m.stage = Math.min(BALANCE.meta.stageCount, cleared + 1);
  for (let i = 0; i < cleared; i++) m.stars.normal[i] = stars;
  return m;
}

describe('stage stars', () => {
  it('gives stars by the wall left at a win', () => {
    expect(runStars(false, false, 1)).toBe(0);
    expect(runStars(true, false, 0.01)).toBe(1);
    expect(runStars(true, false, 0.49)).toBe(1);
    expect(runStars(true, false, 0.5)).toBe(2);
    expect(runStars(true, false, 0.79)).toBe(2);
    expect(runStars(true, false, 0.8)).toBe(3);
    expect(runStars(true, false, 1)).toBe(3);
    // a revived win is one star, whatever the wall
    expect(runStars(true, true, 1)).toBe(1);
  });

  it('keeps a stage best and says what was before', () => {
    const m = save(3, 1);
    expect(bookStars(m, 2, false, 3)).toEqual({ stars: 3, before: 1, hard: false, opened: 0 });
    expect(bookStars(m, 2, false, 2)).toMatchObject({ stars: 2, before: 3 });
    expect(m.stars.normal[1]).toBe(3);
    expect(chapterStars(m, 1)).toBe(5);
  });

  it('gives an old save one star on each stage it cleared', () => {
    const m = parseMeta('{"cleared":12,"stage":13}');
    expect(m.stars.normal.slice(0, 13)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
    expect(m.stars.hard.every((s) => s === 0)).toBe(true);
    expect(m.stars.hardMode).toBe(false);
    expect(totalStars(m)).toBe(12);
  });

  it('reads stored stars back and clamps tampered ones', () => {
    const m = save(11, 2);
    m.stars.hard[0] = 3;
    m.stars.hardMode = true;
    expect(parseMeta(JSON.stringify(m)).stars).toEqual(m.stars);
    const bad = parseMeta('{"cleared":2,"stars":{"normal":[9,-4,3,3],"hard":["x",2],"hardMode":1}}');
    // cleared stages at least one star, the rest none, everything within 0..3
    expect(bad.stars.normal.slice(0, 4)).toEqual([3, 1, 0, 0]);
    expect(bad.stars.hard.slice(0, 2)).toEqual([0, 2]);
    expect(bad.stars.hardMode).toBe(false);
  });
});

describe('hard mode', () => {
  it('opens a chapter once every stage is cleared with enough stars', () => {
    expect(hardOpen(save(9, 3), 1)).toBe(false);
    const m = save(10, 2);
    expect(chapterStars(m, 1)).toBe(20);
    expect(hardOpen(m, 1)).toBe(false);
    m.stars.normal.fill(3, 0, 4);
    expect(chapterStars(m, 1)).toBe(STARS.unlock);
    expect(hardOpen(m, 1)).toBe(true);
    expect(hardOpen(m, 2)).toBe(false);
  });

  it('says which battle opened a chapter, the finale first clear included', () => {
    const m = save(9, 3);
    // the finale won for the first time: the save's cleared has moved on before the stars book
    m.cleared = 10;
    expect(bookStars(m, 10, false, 3).opened).toBe(1);
    expect(bookStars(m, 10, false, 3).opened).toBe(0);
    const n = save(10, 2);
    n.stars.normal.fill(3, 0, 3);
    expect(bookStars(n, 4, false, 2).opened).toBe(0);
    expect(bookStars(n, 4, false, 3).opened).toBe(1);
  });

  it('plays the hard stages of a chapter in order', () => {
    const m = save(20, 3);
    expect(hardPlayable(m, 1)).toBe(true);
    expect(hardPlayable(m, 2)).toBe(false);
    expect(hardPlayable(m, 11)).toBe(true);
    m.stars.hard[0] = 1;
    expect(hardPlayable(m, 2)).toBe(true);
    expect(hardPlayable(m, 3)).toBe(false);
  });

  it('switches on onto an open hard stage and back', () => {
    const locked = save(10, 1);
    expect(setHardMode(locked, true)).toBe(false);
    expect(locked.stars.hardMode).toBe(false);
    const m = save(15, 3);
    m.stars.hard[0] = 2;
    expect(setHardMode(m, true)).toBe(true);
    expect(m.stage).toBe(2);
    expect(playingHard(m)).toBe(true);
    expect(stageOpen(m, 3)).toBe(false);
    expect(stepStage(m, 2, 1)).toBe(null);
    expect(stepStage(m, 2, -1)).toBe(1);
    expect(setHardMode(m, false)).toBe(true);
    expect(m.stage).toBe(2);
    expect(stepStage(m, 2, 1)).toBe(3);
    expect(stepStage(m, 16, 1)).toBe(null);
  });

  it('makes the enemies as tough as six stages on and faster, the rest as the stage is', () => {
    const m = save(20, 3);
    m.stage = 12;
    const normal = battleSetup(m);
    m.stars.hardMode = true;
    expect(stageSetup(m)).toEqual(normal);
    m.stars.hard.fill(1, 10, 11);
    const hard = stageSetup(m);
    expect(hard.hard).toBe(true);
    const scale = (s: number) => (BALANCE.meta.stageHpScale as Record<string, number | undefined>)[s] ?? 1;
    const growth = stageHp(18) / scale(18) / (stageHp(12) / scale(12));
    expect(hard.enemyHp).toBeCloseTo(normal.enemyHp * growth, 9);
    expect(hard.enemyHp).toBeGreaterThan(normal.enemyHp);
    expect(hard.modifiers?.enemySpeed).toBeCloseTo((normal.modifiers?.enemySpeed ?? 1) * STARS.hard.speed, 9);
    expect({ ...hard, enemyHp: 0, modifiers: undefined, hard: undefined }).toEqual({ ...normal, enemyHp: 0, modifiers: undefined, hard: undefined });
    expect(hardSetup({ ...normal, modifiers: undefined }).modifiers?.enemySpeed).toBe(STARS.hard.speed);
  });

  it('pays as six stages on, the first win half a first clear more, and opens nothing', () => {
    const m = save(20, 3);
    m.workshop.crystals = 0;
    const r = { stage: 5, won: true, wave: 10, kills: 120 };
    const later = runReward(save(11, 3), { ...r, stage: 11 });
    const first = hardReward(m, r);
    expect(first.firstClear).toBe(false);
    expect(first.unlocked).toEqual([]);
    expect(first.crystals).toBe(later.crystals + Math.round(STARS.hard.firstClear * BALANCE.meta.reward.firstClear * 11));
    m.stars.hard[4] = 1;
    expect(hardReward(m, r).crystals).toBe(later.crystals);
    // booked through the purse it leaves the campaign where it was
    const purse = new Purse();
    purse.settle(m, r, hardReward(m, r));
    expect(m.cleared).toBe(20);
    expect(m.crystals).toBe(later.crystals);
  });

  it('counts stars and hard wins for the achievements', () => {
    const m = save(10, 3);
    m.stars.hard[0] = 2;
    m.stars.hard[1] = 1;
    expect(trackProgress(m, 'stars', 0)).toBe(33);
    expect(trackProgress(m, 'hard', 0)).toBe(2);
  });

  it('names the furthest hard stage open, none before a chapter opens, and counts hard wins', () => {
    expect(furthestHard(save(10, 1))).toBeNull();
    expect(hardCleared(save(10, 1))).toBe(0);
    const m = save(20, 3);
    expect(furthestHard(m)).toBe(11);
    m.stars.hard[10] = 2;
    m.stars.hard[11] = 1;
    expect(furthestHard(m)).toBe(13);
    expect(hardCleared(m)).toBe(2);
  });
});
