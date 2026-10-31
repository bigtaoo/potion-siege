import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { ASSIST_GOLD, bookLoss, lossAssist } from './lossStreak';
import { BASE_SETUP, newMeta, parseMeta } from './meta';
import { stageSetup } from './stars';

describe('lossStreak', () => {
  it('counts losses on stages 1-3 and clears on a win there', () => {
    const m = newMeta();
    bookLoss(m, 1, false, false);
    bookLoss(m, 2, false, false);
    expect(m.lossStreak).toBe(2);
    bookLoss(m, 4, false, false);
    bookLoss(m, 3, false, true);
    expect(m.lossStreak).toBe(2);
    bookLoss(m, 3, true, false);
    expect(m.lossStreak).toBe(0);
  });

  it('keeps the streak through a save and reads junk as none', () => {
    const m = newMeta();
    m.lossStreak = 3;
    expect(parseMeta(JSON.stringify(m)).lossStreak).toBe(3);
    expect(parseMeta(JSON.stringify({ ...m, lossStreak: 'x' })).lossStreak).toBe(0);
  });

  it('helps from the second loss in a row, on stages 1-3 only', () => {
    const s = { ...BASE_SETUP, stage: 2 };
    expect(lossAssist(s, 1)).toBe(s);
    expect(lossAssist(s, 2)).toEqual({ ...s, startGold: s.startGold + ASSIST_GOLD, freeSummons: 1 });
    expect(lossAssist({ ...s, stage: 4 }, 5).freeSummons).toBeUndefined();
    expect(lossAssist({ ...s, hard: true }, 5).freeSummons).toBeUndefined();
  });

  it('reaches the stage setup', () => {
    const m = { ...newMeta(), tutorial: true, cleared: 1, stage: 2 };
    const before = stageSetup(m);
    const after = stageSetup({ ...m, lossStreak: 2 });
    expect(after.startGold).toBe(before.startGold + ASSIST_GOLD);
    expect(after.freeSummons).toBe(1);
  });

  it('makes the first summon free and leaves the price where it was', () => {
    const plain = new Battle(1, { ...BASE_SETUP, stage: 2 });
    const b = new Battle(1, { ...BASE_SETUP, stage: 2, freeSummons: 1 });
    expect(b.summonCost()).toBe(0);
    const gold = b.gold;
    expect(b.summon()).toBe(true);
    expect(b.gold).toBe(gold);
    expect(b.freed).toBe(1);
    expect(b.summonCost()).toBe(plain.summonCost());
    b.gold = 0;
    expect(b.summon()).toBe(false);
  });
});
