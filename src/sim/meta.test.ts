import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { applyRun, battleSetup, buyHero, buyWorkshop, heroCost, maxStage, newMeta, parseMeta, Purse, runReward } from './meta';
import { BALANCE } from './types';

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
    expect(purse.reward).toEqual({ crystals: full + first, firstClear: true });
  });
});
