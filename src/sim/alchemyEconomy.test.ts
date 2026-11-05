import { describe, expect, it } from 'vitest';
import { newAlchemy, parseAlchemy } from './alchemySave';
import { ASSIST_GOLD } from './lossStreak';
import { battleSetup, buyWorkshop, newMeta, parseMeta, workshopValue, type MetaSave } from './meta';
import { openWorkshop } from './workshopOpen';
import { claimRack, rackFill, rackFull, rackHours, rackOpen, rackRate, startRack } from './rack';
import { bookReplay, isReplay, replayShare, replaysLeft, shareOf } from './replayPay';
import { newRebrew } from './rebrew';
import { stageSetup } from './stars';
import { bookStuck, lossesOn, reactionsOf, showExits, stuckAssist, suggestLineup } from './stuck';
import { BALANCE, HERO_KINDS } from './types';
import { newWeek } from './week';

const A = BALANCE.alchemy;
const HOUR = 3_600_000;

function at(cleared: number): MetaSave {
  const m = newMeta();
  m.cleared = cleared;
  m.stage = Math.min(cleared + 1, 60);
  m.tutorial = false;
  return m;
}

describe('alchemy save', () => {
  it('starts fresh on an old save and keeps its numbers in range', () => {
    expect(parseAlchemy(undefined)).toEqual(newAlchemy());
    expect(parseAlchemy({ rack: -5, replay: { day: '2026-11-05xx', stage: 4, n: 2 }, stuck: { stage: 7, n: 'x' } })).toEqual({
      rack: 0,
      replay: { day: '2026-11-05', stage: 4, n: 2 },
      stuck: { stage: 7, n: 0 },
      talents: {},
      rebrew: newRebrew(),
      week: newWeek(),
    });
    const m = at(9);
    m.alchemy.rack = 123;
    expect(parseMeta(JSON.stringify(m)).alchemy.rack).toBe(123);
  });
});

describe('the lab', () => {
  it('raises every potion by its value, and none at level 0', () => {
    const m = at(5);
    const before = battleSetup(m).heroDamage;
    m.workshop.lab = 4;
    const after = battleSetup(m).heroDamage;
    for (const k of HERO_KINDS) expect(after[k]).toBeCloseTo(before[k] * (1 + workshopValue('lab', 4)), 6);
    expect(workshopValue('lab', 0)).toBe(0);
  });

  it('opens only once the campaign is cleared, so it never shortens the climb', () => {
    const from = BALANCE.meta.workshop.lab.from;
    const m = at(from - 1);
    m.crystals = 1e9;
    expect(openWorkshop(m)).not.toContain('lab');
    expect(buyWorkshop(m, 'lab')).toBe(false);
    m.cleared = from;
    expect(openWorkshop(m)).toEqual(['wall', 'startGold', 'crystals', 'lab']);
    expect(buyWorkshop(m, 'lab')).toBe(true);
    expect(m.workshop.lab).toBe(1);
  });
});

describe('the brewing rack', () => {
  it('opens at its stage and brews more the further the campaign has come', () => {
    expect(rackOpen(at(A.rack.from - 1))).toBe(false);
    expect(rackRate(at(A.rack.from - 1))).toBe(0);
    expect(rackRate(at(10))).toBe(A.rack.base + A.rack.perStage * 10);
  });

  it('starts once, fills up to its cap, and empties into the crystals', () => {
    const m = at(10);
    const t0 = 1_800_000_000_000;
    expect(startRack(m, t0)).toBe(true);
    expect(startRack(m, t0 + HOUR)).toBe(false);
    expect(rackFill(m, t0 + 2 * HOUR)).toBe(Math.floor(rackRate(m) * 2));
    expect(rackFull(m, t0 + 2 * HOUR)).toBe(false);
    expect(rackHours(m, t0 + 99 * HOUR)).toBe(A.rack.capHours);
    expect(rackFull(m, t0 + 99 * HOUR)).toBe(true);
    const c = m.crystals;
    const n = claimRack(m, t0 + 99 * HOUR);
    expect(n).toBe(Math.floor(rackRate(m) * A.rack.capHours));
    expect(m.crystals).toBe(c + n);
    expect(claimRack(m, t0 + 99 * HOUR)).toBe(0);
  });

  it('starts over from now when the clock went back, paying nothing for it', () => {
    const m = at(10);
    m.alchemy.rack = 2_000_000_000_000;
    const now = 1_900_000_000_000;
    expect(rackFill(m, now)).toBe(0);
    expect(claimRack(m, now)).toBe(0);
    expect(m.alchemy.rack).toBe(now);
  });

  it('pays nothing before it is open', () => {
    const m = at(1);
    expect(startRack(m, 5)).toBe(false);
    expect(claimRack(m, 5 + 9 * HOUR)).toBe(0);
  });
});

describe('replay pay', () => {
  it('pays the latest stage in full the first battles of a day, then a share', () => {
    const m = at(8);
    expect(isReplay(m, 8, false)).toBe(true);
    expect(isReplay(m, 8, true)).toBe(false);
    expect(isReplay(m, 7, false)).toBe(false);
    const shares = Array.from({ length: A.replay.free + 2 }, () => bookReplay(m, 8, false, '2026-11-05'));
    expect(shares).toEqual([...Array(A.replay.free).fill(1), A.replay.factor, A.replay.factor]);
    expect(replaysLeft(m, '2026-11-05')).toBe(0);
    // a new day starts in full again
    expect(bookReplay(m, 8, false, '2026-11-06')).toBe(1);
    expect(replaysLeft(m, '2026-11-06')).toBe(A.replay.free - 1);
  });

  it('counts a revived battle once, and other stages not at all', () => {
    const m = at(8);
    bookReplay(m, 8, false, 'd');
    bookReplay(m, 8, false, 'd', true);
    expect(m.alchemy.replay.n).toBe(1);
    expect(bookReplay(m, 3, false, 'd')).toBe(1);
    expect(m.alchemy.replay.n).toBe(1);
  });

  it('cuts only the crystals', () => {
    const r = { crystals: 41, firstClear: false, unlocked: [] };
    expect(shareOf(r, 1)).toBe(r);
    expect(shareOf(r, 0.5)).toEqual({ ...r, crystals: 21 });
    expect(replayShare(0)).toBe(1);
  });
});

describe('stuck on a stage', () => {
  it('counts losses in a row on one stage, a win or another stage starting over', () => {
    const m = at(9);
    bookStuck(m, 10, false, false);
    bookStuck(m, 10, false, false);
    expect(lossesOn(m, 10)).toBe(2);
    bookStuck(m, 10, false, true);
    expect(lossesOn(m, 10)).toBe(2);
    bookStuck(m, 11, false, false);
    expect(lossesOn(m, 10)).toBe(0);
    expect(lossesOn(m, 11)).toBe(1);
    bookStuck(m, 11, true, false);
    expect(lossesOn(m, 11)).toBe(0);
  });

  it('helps with start gold past stage 3 after the losses, and offers the exits after more', () => {
    const m = at(9);
    const plain = stageSetup(m);
    for (let i = 0; i < A.stuck.assistAfter; i++) bookStuck(m, 10, false, false);
    expect(stageSetup(m).startGold).toBe(plain.startGold + ASSIST_GOLD);
    expect(showExits(m, 10)).toBe(A.stuck.exitsAfter <= A.stuck.assistAfter);
    for (let i = A.stuck.assistAfter; i < A.stuck.exitsAfter; i++) bookStuck(m, 10, false, false);
    expect(showExits(m, 10)).toBe(true);
    // the first stages have their own help
    const early = at(1);
    early.alchemy.stuck = { stage: 2, n: 9 };
    const s = battleSetup(early);
    expect(stuckAssist(early, s)).toBe(s);
  });

  it('suggests the four unlocked potions with the most reactions, never the lineup fielded', () => {
    const m = at(40);
    m.unlocked = HERO_KINDS.filter((k) => !m.lineup.includes(k));
    const tip = suggestLineup(m);
    expect(tip).not.toBeNull();
    expect(tip!.lineup).toHaveLength(4);
    expect([...tip!.lineup].sort().join()).not.toBe([...m.lineup].sort().join());
    expect(tip!.reactions).toEqual(reactionsOf(tip!.lineup));
    expect(reactionsOf(['fire', 'ice'])).toHaveLength(1);
    expect(suggestLineup(at(0))).toBeNull();
  });
});
