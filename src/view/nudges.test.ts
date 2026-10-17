import { describe, expect, it } from 'vitest';
import { claimChest, heroCost, newMeta, unlockHero, unlockPrice, WORKSHOP_IDS, workshopCost } from '../sim/meta';
import { BALANCE, ENEMY_KINDS, HERO_KINDS } from '../sim/types';
import { FIRST_STAGE } from '../sim/waves';
import { canBuyUnlock, canUpgradePotion, canUpgradeWorkshop, CHALLENGE_AFTER, challengeOpen, challengeShown, codexStage, shopDot } from './nudges';

/** A new save's potions are all at level 1. */
const cheapestHero = (): number => heroCost(1)!;
const cheapestWorkshop = (): number => Math.min(...WORKSHOP_IDS.map((id) => workshopCost(id, 0) ?? Infinity));

describe('potion dot', () => {
  it('lights once a potion level is affordable, not a crystal before', () => {
    const m = newMeta();
    m.crystals = cheapestHero() - 1;
    expect(canUpgradePotion(m)).toBe(false);
    m.crystals = cheapestHero();
    expect(canUpgradePotion(m)).toBe(true);
  });

  it('ignores locked potions and maxed ones', () => {
    const m = newMeta();
    m.crystals = 1e9;
    for (const k of HERO_KINDS) m.heroes[k] = BALANCE.meta.heroMax;
    expect(canUpgradePotion(m)).toBe(false);
    // a locked potion at level 1 is not something to upgrade
    const locked = HERO_KINDS.find((k) => !m.lineup.includes(k) && !m.unlocked.includes(k));
    expect(locked).toBeDefined();
    m.heroes[locked!] = 1;
    expect(canUpgradePotion(m)).toBe(false);
    m.unlocked.push(locked!);
    expect(canUpgradePotion(m)).toBe(true);
  });
});

describe('workshop dot', () => {
  it('lights once a workshop upgrade is affordable and stays off when all are maxed', () => {
    const m = newMeta();
    m.crystals = cheapestWorkshop() - 1;
    expect(canUpgradeWorkshop(m)).toBe(false);
    m.crystals = cheapestWorkshop();
    expect(canUpgradeWorkshop(m)).toBe(true);
    m.crystals = 1e9;
    for (const id of WORKSHOP_IDS) m.workshop[id] = BALANCE.meta.workshop[id].max;
    expect(canUpgradeWorkshop(m)).toBe(false);
  });
});

describe('shop dot', () => {
  const today = '2026-10-17';
  const cheapestUnlock = (): number => Math.min(...HERO_KINDS.map((k) => unlockPrice(k) ?? Infinity));

  it("lights while today's chest is shut and goes out once it is opened", () => {
    const m = newMeta();
    m.crystals = 0;
    expect(shopDot(m, today)).toBe(true);
    claimChest(m, today);
    m.crystals = 0;
    expect(shopDot(m, today)).toBe(false);
    // a new day brings a new chest
    expect(shopDot(m, '2026-10-18')).toBe(true);
  });

  it('lights for a locked potion the crystals can buy, not a crystal before, and not once it is owned', () => {
    const m = newMeta();
    claimChest(m, today);
    m.crystals = cheapestUnlock() - 1;
    expect(canBuyUnlock(m)).toBe(false);
    expect(shopDot(m, today)).toBe(false);
    m.crystals = cheapestUnlock();
    expect(canBuyUnlock(m)).toBe(true);
    expect(shopDot(m, today)).toBe(true);
    m.crystals = 1e9;
    for (const k of HERO_KINDS) if (unlockPrice(k) !== null) unlockHero(m, k);
    expect(canBuyUnlock(m)).toBe(false);
    expect(shopDot(m, today)).toBe(false);
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

  it('shows the banner, without opening the dot, while a task asks for the challenge', () => {
    const m = newMeta();
    m.cleared = 1;
    m.daily.tasks = [{ id: 'challenge', progress: 0, claimed: false }];
    expect(challengeOpen(m)).toBe(false);
    expect(challengeShown(m)).toBe(true);
    m.daily.tasks[0].claimed = true;
    expect(challengeShown(m)).toBe(false);
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
