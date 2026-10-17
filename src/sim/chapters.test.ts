import { describe, expect, it } from 'vitest';
import { Prng } from './math/prng';
import { CHAPTER_COUNT, chapterChest, chapterOf, chapterOpen, chapterProgress, chapterStages, chestWaiting, isFinale, openChapterChest, stageField, stageModifiers, stageTwists } from './chapters';
import { battleSetup, newMeta, parseMeta } from './meta';
import { BALANCE } from './types';
import { planWave } from './waves';

describe('chapters', () => {
  it('splits the 50 stages into five chapters of ten', () => {
    expect(BALANCE.meta.stageCount).toBe(50);
    expect(CHAPTER_COUNT).toBe(5);
    expect([1, 10, 11, 20, 21, 41, 50].map(chapterOf)).toEqual([1, 1, 2, 2, 3, 5, 5]);
    expect(chapterStages(3)).toEqual([21, 30]);
    expect([10, 20, 50].every(isFinale)).toBe(true);
    expect(isFinale(19)).toBe(false);
    expect(stageField(1)).toBe('bg_field');
    expect(stageField(11)).toBe('bg_snow');
  });

  it('leaves the first chapter plain up to its finale, so those battles play as before', () => {
    for (let s = 1; s <= 9; s++) {
      expect(stageModifiers(s)).toBeUndefined();
      expect(battleSetup(newMeta(), s).modifiers).toBeUndefined();
    }
    expect(stageTwists(10)).toEqual(['finale']);
    expect(stageModifiers(10)?.bossWaves).toEqual(BALANCE.twists.finale.bossWaves);
  });

  it('plans a wave without an elite share exactly as before chapters', () => {
    for (const stage of [3, 12, 25]) {
      for (let wave = 1; wave <= 10; wave++) {
        expect(planWave(wave, new Prng(77), stage, { elite: 0 })).toEqual(planWave(wave, new Prng(77), stage));
      }
    }
  });

  it('sends elites only on stages that ask for them', () => {
    const elites = (stage: number) => {
      const mods = stageModifiers(stage) ?? {};
      let n = 0;
      for (let wave = 1; wave <= 10; wave++) n += planWave(wave, new Prng(5 + wave), stage, mods).filter((s) => s.elite).length;
      return n;
    };
    expect(elites(9)).toBe(0);
    expect(elites(17)).toBeGreaterThan(0);
  });

  it('opens and pays each chapter chest once, and only for a finished chapter', () => {
    const m = newMeta();
    m.cleared = 9;
    expect(chapterProgress(m, 1)).toBe(9);
    expect(chestWaiting(m, 1)).toBe(false);
    expect(openChapterChest(m, 1)).toBe(0);
    m.cleared = 14;
    expect(chapterProgress(m, 2)).toBe(4);
    expect(chapterOpen(m, 2)).toBe(true);
    expect(chapterOpen(m, 3)).toBe(false);
    expect(chestWaiting(m, 1)).toBe(true);
    expect(chapterChest(1)).toBe(BALANCE.meta.chapterChest);
    expect(chapterChest(3)).toBe(3 * BALANCE.meta.chapterChest);
    expect(openChapterChest(m, 1)).toBe(chapterChest(1));
    expect(m.crystals).toBe(chapterChest(1));
    expect(openChapterChest(m, 1)).toBe(0);
    expect(m.crystals).toBe(chapterChest(1));
    expect(m.chapterChests).toEqual([1]);
  });

  it('keeps a save from before chapters, with its finished chapters waiting for their chest', () => {
    const old = { ...newMeta(), cleared: 20, stage: 21 } as Record<string, unknown>;
    delete old.chapterChests;
    const m = parseMeta(JSON.stringify(old));
    expect(m.cleared).toBe(20);
    expect(m.stage).toBe(21);
    expect(m.chapterChests).toEqual([]);
    expect(chestWaiting(m, 1) && chestWaiting(m, 2)).toBe(true);
    expect(parseMeta(JSON.stringify({ ...m, chapterChests: [2, 2, 1, 9, 'x'] })).chapterChests).toEqual([1, 2]);
  });
});
