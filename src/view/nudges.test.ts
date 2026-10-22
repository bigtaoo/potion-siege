import { describe, expect, it } from 'vitest';
import { achievementsClaimable, claimTier, TRACK_IDS, trackReady } from '../sim/achievements';
import { chapterStages } from '../sim/chapters';
import { claimChest, heroCost, heroUnlocked, maxStage, newMeta, parseMeta, unlockHero, unlockPrice, WORKSHOP_IDS, workshopCost } from '../sim/meta';
import { BALANCE, ENEMY_KINDS, HERO_KINDS, LINEUP } from '../sim/types';
import { FIRST_STAGE } from '../sim/waves';
import {
  anyChestWaiting, canUpgradeLineup, CHALLENGE_AFTER, CHALLENGE_TASK_AFTER, challengeOpen, challengeShown, codexStage, dotKeys, LOGIN_AFTER_RUNS, loginPops, markSeen, navDots, newOnTab, NEXT_UNTIL, offersNext,
  upgradeHintKind,
  topPick,
  TOP_PICK_UNTIL,
  lossStep,
  lossTips,
} from './nudges';

const today = '2026-10-17';
/** A new save's potions are all at level 1. */
const cheapestHero = (): number => heroCost(1)!;
const cheapestWorkshop = (): number => Math.min(...WORKSHOP_IDS.map((id) => workshopCost(id, 0) ?? Infinity));
const cheapestUnlock = (): number => Math.min(...HERO_KINDS.map((k) => unlockPrice(k) ?? Infinity));
const reserveKind = HERO_KINDS.find((k) => !LINEUP.includes(k))!;

describe('potion dot', () => {
  it('stays lit while a fielded potion can level up, not a crystal before', () => {
    const m = newMeta();
    m.crystals = cheapestHero() - 1;
    expect(canUpgradeLineup(m)).toBe(false);
    expect(navDots(m, today).potions).toBe(false);
    m.crystals = cheapestHero();
    expect(canUpgradeLineup(m)).toBe(true);
    // the core loop: visiting the tab does not put it out
    markSeen(m, 'potions', today);
    expect(navDots(m, today).potions).toBe(true);
  });

  it('ignores the reserve and maxed potions for levels', () => {
    const m = newMeta();
    m.crystals = 1e9;
    for (const k of m.lineup) m.heroes[k] = BALANCE.meta.heroMax;
    expect(canUpgradeLineup(m)).toBe(false);
    unlockHero(m, reserveKind);
    m.crystals = 1e9;
    expect(canUpgradeLineup(m)).toBe(false);
  });

  it('lights once for a potion that joined the reserve, until the tab is open', () => {
    const m = newMeta();
    m.crystals = 0;
    expect(newOnTab(m, 'potions', today)).toBe(false);
    unlockHero(m, reserveKind);
    m.crystals = 0;
    expect(dotKeys(m, 'potions', today)).toEqual([`new:${reserveKind}`]);
    expect(navDots(m, today).potions).toBe(true);
    expect(markSeen(m, 'potions', today)).toBe(true);
    expect(navDots(m, today).potions).toBe(false);
    // nothing new: the save stays as it is
    expect(markSeen(m, 'potions', today)).toBe(false);
  });
});

describe('workshop dot', () => {
  it('lights once an upgrade level becomes affordable, and once more for the next level', () => {
    const m = newMeta();
    m.crystals = cheapestWorkshop() - 1;
    expect(navDots(m, today).workshop).toBe(false);
    m.crystals = cheapestWorkshop();
    expect(navDots(m, today).workshop).toBe(true);
    markSeen(m, 'workshop', today);
    expect(navDots(m, today).workshop).toBe(false);
    // the same level stays seen with more crystals; the next one lights it again
    const id = WORKSHOP_IDS.find((w) => workshopCost(w, 0) === cheapestWorkshop())!;
    m.workshop[id] = 1;
    m.crystals = workshopCost(id, 1)!;
    expect(navDots(m, today).workshop).toBe(true);
  });

  it('stays off when all are maxed and drops the keys that can no longer come up', () => {
    const m = newMeta();
    m.crystals = 1e9;
    markSeen(m, 'workshop', today);
    expect(m.seen.workshop!.length).toBeGreaterThan(0);
    for (const id of WORKSHOP_IDS) m.workshop[id] = BALANCE.meta.workshop[id].max;
    expect(navDots(m, today).workshop).toBe(false);
    markSeen(m, 'workshop', today);
    expect(m.seen.workshop).toEqual([]);
  });
});

describe('codex dot', () => {
  it('lights for a reached achievement tier until the codex is open, and for the next tier again', () => {
    const m = newMeta();
    expect(navDots(m, today).codex).toBe(achievementsClaimable(m));
    m.cleared = 200;
    m.stage = 1;
    expect(achievementsClaimable(m)).toBe(true);
    expect(navDots(m, today).codex).toBe(true);
    markSeen(m, 'codex', today);
    expect(navDots(m, today).codex).toBe(false);
    const id = TRACK_IDS.find((k) => trackReady(m, k))!;
    claimTier(m, id);
    // 200 stages reach the track's next tier too, a new thing to claim
    expect(trackReady(m, id)).toBe(true);
    expect(navDots(m, today).codex).toBe(true);
  });
});

describe('shop dot', () => {
  it("lights for today's chest until the shop is open or the chest is, and again the next day", () => {
    const m = newMeta();
    m.crystals = 0;
    expect(navDots(m, today).shop).toBe(true);
    markSeen(m, 'shop', today);
    expect(navDots(m, today).shop).toBe(false);
    expect(navDots(m, '2026-10-18').shop).toBe(true);
    claimChest(m, '2026-10-18');
    m.crystals = 0;
    expect(navDots(m, '2026-10-18').shop).toBe(false);
  });

  it('lights for a locked potion the crystals can buy, not a crystal before, and not once it is owned', () => {
    const m = newMeta();
    claimChest(m, today);
    m.crystals = cheapestUnlock() - 1;
    expect(navDots(m, today).shop).toBe(false);
    m.crystals = cheapestUnlock();
    expect(navDots(m, today).shop).toBe(true);
    m.crystals = 1e9;
    for (const k of HERO_KINDS) if (unlockPrice(k) !== null) unlockHero(m, k);
    expect(dotKeys(m, 'shop', today)).toEqual([]);
  });
});

describe('battle dot', () => {
  it('lights while a finished chapter keeps its chest', () => {
    const m = newMeta();
    expect(navDots(m, today).battle).toBe(false);
    m.cleared = chapterStages(1)[1];
    expect(anyChestWaiting(m)).toBe(true);
    expect(navDots(m, today).battle).toBe(true);
  });
});

describe('seen keys in the save', () => {
  it('survive a round trip and drop what is not a list of strings', () => {
    const m = newMeta();
    m.seen = { shop: [`chest:${today}`], codex: ['stages:0'] };
    expect(parseMeta(JSON.stringify(m)).seen).toEqual(m.seen);
    const raw = JSON.parse(JSON.stringify(m));
    raw.seen = { shop: 'x', codex: [1, 'stages:1'], bogus: ['a'] };
    expect(parseMeta(JSON.stringify(raw)).seen).toEqual({ codex: ['stages:1'] });
    delete raw.seen;
    expect(parseMeta(JSON.stringify(raw)).seen).toEqual({});
  });
});

describe('challenge gate', () => {
  it('stays shut after the first battles and opens at the gate stage', () => {
    const m = newMeta();
    m.daily.tasks = [];
    for (let c = 0; c < CHALLENGE_AFTER; c++) {
      m.cleared = c;
      expect(challengeOpen(m)).toBe(false);
      expect(challengeShown(m)).toBe(false);
    }
    m.cleared = CHALLENGE_AFTER;
    expect(challengeOpen(m)).toBe(true);
  });

  it('stays open on a save that played a challenge already', () => {
    const m = newMeta();
    m.cleared = 1;
    m.challenge.date = '2026-10-01';
    expect(challengeOpen(m)).toBe(true);
  });

  it('shows the banner, without opening the dot, while a task asks for the challenge past the first stages', () => {
    const m = newMeta();
    m.cleared = CHALLENGE_TASK_AFTER - 1;
    m.daily.tasks = [{ id: 'challenge', progress: 0, claimed: false }];
    expect(challengeShown(m)).toBe(false);
    m.cleared = CHALLENGE_TASK_AFTER;
    expect(challengeOpen(m)).toBe(false);
    expect(challengeShown(m)).toBe(true);
    m.daily.tasks[0].claimed = true;
    expect(challengeShown(m)).toBe(false);
  });
});

describe('first battles', () => {
  it('offers the next stage after the first wins, then goes home first', () => {
    const m = newMeta();
    m.runs = 1;
    m.cleared = 1;
    expect(offersNext(m, 1)).toBe(true);
    m.runs = 2;
    m.cleared = 2;
    expect(offersNext(m, 2)).toBe(true);
    m.runs = NEXT_UNTIL;
    m.cleared = NEXT_UNTIL;
    expect(offersNext(m, 3)).toBe(false);
    // a player still short of the stages keeps the button
    m.runs = 6;
    m.cleared = 2;
    expect(offersNext(m, 2)).toBe(true);
  });

  it('never offers a stage past the last one', () => {
    const m = newMeta();
    m.runs = 1;
    m.cleared = maxStage({ ...m, cleared: 999 });
    expect(offersNext(m, maxStage(m))).toBe(false);
  });

  it('keeps the login from opening by itself in the first runs', () => {
    const m = newMeta();
    m.runs = LOGIN_AFTER_RUNS - 1;
    expect(loginPops(m)).toBe(false);
    m.runs = LOGIN_AFTER_RUNS;
    expect(loginPops(m)).toBe(true);
  });

  it('points at the first affordable potion once, after the first battle won or lost', () => {
    const m = newMeta();
    m.crystals = 10_000;
    expect(upgradeHintKind(m)).toBe(null);
    m.runs = 1;
    expect(upgradeHintKind(m)).toBe(HERO_KINDS.find((k) => heroUnlocked(m, k)));
    m.crystals = 0;
    expect(upgradeHintKind(m)).toBe(null);
    m.crystals = 10_000;
    m.upgradeHint = true;
    expect(upgradeHintKind(m)).toBe(null);
  });

  it('tags the suggested skill card in the first battles only', () => {
    const m = newMeta();
    expect(topPick(m)).toBe(true);
    m.runs = TOP_PICK_UNTIL - 1;
    expect(topPick(m)).toBe(true);
    m.runs = TOP_PICK_UNTIL;
    expect(topPick(m)).toBe(false);
  });

  it('singles out a potion level after a loss, else the workshop, else an easier stage', () => {
    const m = newMeta();
    m.crystals = 0;
    expect(lossStep(m)).toBe(null);
    m.stage = 2;
    expect(lossStep(m)).toBe('battle');
    m.crystals = workshopCost('wall', m.workshop.wall) ?? 0;
    expect(lossStep(m)).toBe(heroCost(1)! <= m.crystals ? 'potions' : 'workshop');
    m.crystals = 10_000;
    expect(lossStep(m)).toBe('potions');
  });

  it('lists the easier stage after a loss only past stage 1, the one to do now first', () => {
    const m = newMeta();
    m.crystals = 0;
    expect(lossTips(m)).toEqual(['potions', 'workshop']);
    m.stage = 3;
    expect(lossTips(m)).toEqual(['battle', 'potions', 'workshop']);
    m.crystals = 10_000;
    expect(lossTips(m)).toEqual(['potions', 'workshop', 'battle']);
  });
});

describe('codex stage', () => {
  it('quotes a later kind at the stage it first comes on', () => {
    for (const k of ENEMY_KINDS) {
      expect(codexStage(k, 1)).toBe(FIRST_STAGE[k]);
      expect(codexStage(k, 20)).toBe(Math.max(20, FIRST_STAGE[k]));
    }
    expect(codexStage('flyer', 2)).toBe(FIRST_STAGE.flyer);
    expect(codexStage('flyer', FIRST_STAGE.flyer + 1)).toBe(FIRST_STAGE.flyer + 1);
  });
});
