import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { applyRun, battleSetup, buyHero, buyWorkshop, heroCost, maxStage, newMeta, parseMeta, runReward } from './meta';
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
});
