import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import {
  applyRun, battleSetup, benched, buyHero, buyWorkshop, endOffers, heroCost, heroUnlocked, maxStage, newMeta, parseMeta, Purse, runReward,
  swapLineup, unlockHero, unlockStage,
} from './meta';
import { BALANCE, LINEUP } from './types';

describe('meta', () => {
  it('turns the old save into a fresh one that keeps best wave and runs', () => {
    const m = parseMeta('{"bestWave":7,"runs":12}');
    expect(m.bestWave).toBe(7);
    expect(m.runs).toBe(12);
    expect(m.crystals).toBe(0);
    expect(m.heroes.fire).toBe(1);
    expect(m.stage).toBe(1);
  });

  it('survives broken or tampered saves', () => {
    expect(parseMeta('not json')).toEqual(newMeta());
    expect(parseMeta(null)).toEqual(newMeta());
    const m = parseMeta('{"crystals":-5,"heroes":{"fire":999},"cleared":3,"stage":50}');
    expect(m.crystals).toBe(0);
    expect(m.heroes.fire).toBe(BALANCE.meta.heroMax);
    expect(m.stage).toBe(4);
  });

  it('buys levels with crystals, never below zero and never past the top', () => {
    const m = newMeta();
    expect(buyHero(m, 'fire')).toBe(false);
    m.crystals = 10_000_000;
    while (buyHero(m, 'fire'));
    expect(m.heroes.fire).toBe(BALANCE.meta.heroMax);
    expect(heroCost(m.heroes.fire)).toBeNull();
    m.crystals = 0;
    expect(buyWorkshop(m, 'wall')).toBe(false);
  });

  it('pays more for winning, and most for a first clear, which opens the next stage', () => {
    const m = newMeta();
    const lost = runReward(m, { stage: 1, won: false, wave: 6, kills: 80 });
    const won = runReward(m, { stage: 1, won: true, wave: 10, kills: 150 });
    expect(won.crystals).toBeGreaterThan(lost.crystals);
    expect(won.firstClear).toBe(true);
    applyRun(m, { stage: 1, won: true, wave: 10, kills: 150 }, won);
    expect(m.cleared).toBe(1);
    expect(m.stage).toBe(2);
    expect(maxStage(m)).toBe(2);
    expect(runReward(m, { stage: 1, won: true, wave: 10, kills: 150 }).crystals).toBeLessThan(won.crystals);
  });

  it('sets the battle up from the stage and the upgrades', () => {
    const m = newMeta();
    m.heroes.fire = 5;
    m.workshop.wall = 2;
    m.workshop.startGold = 1;
    const b = new Battle(1, battleSetup(m, 3));
    expect(b.wallMax).toBeGreaterThan(BALANCE.wallHp);
    expect(b.gold).toBeGreaterThan(BALANCE.startGold);
    expect(b.setup.heroDamage.fire).toBeGreaterThan(b.setup.heroDamage.ice);
    expect(b.setup.enemyHp).toBeGreaterThan(1);
  });

  it('pays the ×2 once: what the battle earned, again', () => {
    const m = newMeta();
    const purse = new Purse();
    const r = { stage: 1, won: false, wave: 6, kills: 40 };
    const { crystals } = purse.settle(m, r);
    expect(crystals).toBeGreaterThan(0);
    expect(m.crystals).toBe(crystals);
    expect(purse.double(m, true)).toBe(crystals);
    expect(m.crystals).toBe(2 * crystals);
    expect(purse.reward.crystals).toBe(2 * crystals);
    expect(purse.double(m, true)).toBe(0);
    expect(m.crystals).toBe(2 * crystals);
  });

  it('pays nothing for a failed ×2 ad and does not offer it again', () => {
    const m = newMeta();
    const purse = new Purse();
    const { crystals } = purse.settle(m, { stage: 1, won: false, wave: 6, kills: 40 });
    expect(purse.double(m, false)).toBe(0);
    expect(purse.doubled).toBe(true);
    expect(purse.double(m, true)).toBe(0);
    expect(m.crystals).toBe(crystals);
  });

  it('keeps the ×2 to what it doubled when a revived battle ends again', () => {
    const m = newMeta();
    const purse = new Purse();
    const first = purse.settle(m, { stage: 1, won: false, wave: 6, kills: 40 }).crystals;
    purse.double(m, true);
    // revived, it goes on to win: only the difference is paid, the bonus stays as it was
    const gain = purse.settle(m, { stage: 1, won: true, wave: 10, kills: 120 }).crystals;
    const full = runReward(newMeta(), { stage: 1, won: true, wave: 10, kills: 120 }).crystals;
    expect(gain).toBe(full - first);
    expect(m.crystals).toBe(full + first);
    expect(purse.reward).toEqual({ crystals: full + first, firstClear: true, unlocked: [] });
  });

  it('doubles a first clear with its bonus', () => {
    const m = newMeta();
    const purse = new Purse();
    const r = { stage: 1, won: true, wave: 10, kills: 120 };
    const full = runReward(newMeta(), r);
    expect(full.firstClear).toBe(true);
    expect(purse.settle(m, r).crystals).toBe(full.crystals);
    expect(purse.double(m, true)).toBe(full.crystals);
    expect(m.crystals).toBe(2 * full.crystals);
    expect(purse.reward).toEqual({ crystals: 2 * full.crystals, firstClear: true, unlocked: [] });
  });

  it('pays nothing for a ×2 before anything was earned', () => {
    const m = newMeta();
    m.crystals = 30;
    const purse = new Purse();
    expect(purse.double(m, true)).toBe(0);
    expect(m.crystals).toBe(30);
  });

  it('doubles the full reward after a revived battle ends again', () => {
    const m = newMeta();
    const purse = new Purse();
    purse.settle(m, { stage: 1, won: false, wave: 6, kills: 40 });
    const end = { stage: 1, won: false, wave: 9, kills: 90 };
    purse.settle(m, end);
    const full = runReward(newMeta(), end).crystals;
    expect(purse.double(m, true)).toBe(full);
    expect(m.crystals).toBe(2 * full);
  });

  it('shows what was paid after a failed ×2, first clear kept', () => {
    const m = newMeta();
    const purse = new Purse();
    const { crystals } = purse.settle(m, { stage: 1, won: true, wave: 10, kills: 120 });
    purse.double(m, false);
    expect(purse.reward).toEqual({ crystals, firstClear: true, unlocked: [] });
  });

  it('offers the ×2 only when no revive is on offer, once per battle', () => {
    const purse = new Purse();
    purse.settle(newMeta(), { stage: 1, won: false, wave: 6, kills: 40 });
    expect(endOffers(true, false, true, purse)).toEqual({ revive: true, double: false });
    expect(endOffers(true, true, true, purse)).toEqual({ revive: false, double: true });
    expect(endOffers(false, false, true, purse)).toEqual({ revive: false, double: true });
    expect(endOffers(true, true, false, purse)).toEqual({ revive: false, double: false });
    purse.double(newMeta(), false);
    expect(endOffers(true, true, true, purse).double).toBe(false);
    expect(endOffers(false, false, true, new Purse()).double).toBe(false);
  });
});

describe('corrosion unlock and lineup', () => {
  const at = unlockStage('poison')!;
  const clear = (stage: number) => ({ stage, won: true, wave: 10, kills: 150 });

  /** A save that has cleared every stage before `stage`. */
  function upTo(stage: number) {
    const m = newMeta();
    m.cleared = stage - 1;
    m.stage = stage;
    return m;
  }

  it('unlocks on the first clear of its stage and not before', () => {
    expect(at).toBe(BALANCE.heroes.poison.unlockStage);
    const m = upTo(at - 1);
    const early = runReward(m, clear(at - 1));
    expect(early.unlocked).toEqual([]);
    applyRun(m, clear(at - 1), early);
    expect(heroUnlocked(m, 'poison')).toBe(false);
    const r = runReward(m, clear(at));
    expect(r.unlocked).toEqual(['poison']);
    applyRun(m, clear(at), r);
    expect(heroUnlocked(m, 'poison')).toBe(true);
    // a replay of the stage unlocks nothing more
    expect(runReward(m, clear(at)).unlocked).toEqual([]);
  });

  it('tells the result screen about the unlock through the purse', () => {
    const m = upTo(at);
    const purse = new Purse();
    purse.settle(m, { stage: at, won: false, wave: 6, kills: 40 });
    expect(purse.reward.unlocked).toEqual([]);
    purse.settle(m, clear(at));
    expect(purse.reward.unlocked).toEqual(['poison']);
    expect(heroUnlocked(m, 'poison')).toBe(true);
  });

  it('unlocks once through unlockHero, and only then levels up', () => {
    const m = newMeta();
    m.crystals = 1e6;
    expect(buyHero(m, 'poison')).toBe(false);
    expect(unlockHero(m, 'poison')).toBe(true);
    expect(unlockHero(m, 'poison')).toBe(false);
    expect(unlockHero(m, 'fire')).toBe(false);
    expect(m.unlocked).toEqual(['poison']);
    expect(buyHero(m, 'poison')).toBe(true);
  });

  it('swaps the lineup keeping four unlocked potions', () => {
    const m = newMeta();
    expect(swapLineup(m, 'fire', 'poison')).toBe(false);
    unlockHero(m, 'poison');
    expect(benched(m)).toEqual(['poison']);
    expect(swapLineup(m, 'poison', 'fire')).toBe(false);
    expect(swapLineup(m, 'fire', 'ice')).toBe(false);
    expect(swapLineup(m, 'fire', 'poison')).toBe(true);
    expect(m.lineup).toHaveLength(4);
    expect(new Set(m.lineup).size).toBe(4);
    expect(m.lineup).toContain('poison');
    expect(benched(m)).toEqual(['fire']);
    expect(battleSetup(m, 1).lineup).toEqual(m.lineup);
    // and the swap survives a reload
    expect(parseMeta(JSON.stringify(m)).lineup).toEqual(m.lineup);
  });

  it('migrates old saves: default lineup, corrosion open if its stage was already cleared', () => {
    const old = parseMeta('{"crystals":50,"cleared":2,"stage":3}');
    expect(old.lineup).toEqual([...LINEUP]);
    expect(heroUnlocked(old, 'poison')).toBe(false);
    const far = parseMeta(`{"cleared":${at},"stage":${at + 1}}`);
    expect(heroUnlocked(far, 'poison')).toBe(true);
    expect(far.lineup).toEqual([...LINEUP]);
  });

  it('falls back to the default lineup when the saved one is broken', () => {
    for (const lineup of [['poison', 'fire', 'ice', 'lightning'], ['fire', 'fire', 'ice', 'arcane'], ['fire', 'ice'], 'x', ['nope', 'fire', 'ice', 'arcane']]) {
      expect(parseMeta(JSON.stringify({ lineup })).lineup).toEqual([...LINEUP]);
    }
    const ok = parseMeta(JSON.stringify({ unlocked: ['poison'], lineup: ['poison', 'fire', 'ice', 'lightning'] }));
    expect(ok.lineup).toEqual(['poison', 'fire', 'ice', 'lightning']);
  });
});
