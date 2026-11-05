import { describe, expect, it } from 'vitest';
import { battleSetup, newMeta, parseMeta } from './meta';
import { buyPerk, canRebrew, essenceFor, newRebrew, parseRebrew, perkCost, perkOf, PERK_IDS, reach, rebrew } from './rebrew';
import { challengeOpen } from '../view/nudges';
import { rackOpen, rackRate } from './rack';
import { SAVES } from './setupCatalog';
import { BALANCE, HERO_KINDS } from './types';

const R = BALANCE.alchemy.rebrew;

function done() {
  const m = SAVES.maxed();
  m.cleared = Math.max(m.cleared, R.from);
  return m;
}

describe('rebrew', () => {
  it('opens only once the campaign is cleared', () => {
    expect(canRebrew(newMeta())).toBe(false);
    const m = SAVES.late();
    m.cleared = R.from - 1;
    expect(canRebrew(m)).toBe(false);
    expect(rebrew(m, newMeta())).toBe(0);
    expect(m.alchemy.rebrew.count).toBe(0);
  });

  it('pours the climb back and keeps what was earned for good', () => {
    const m = done();
    const before = { cleared: m.cleared, stars: JSON.stringify(m.stars), endless: m.endless.best, lab: m.workshop.lab, crystals: m.crystals };
    const paid = essenceFor(m);
    expect(paid).toBeGreaterThan(0);
    expect(rebrew(m, newMeta())).toBe(paid);
    const r = m.alchemy.rebrew;
    expect(r).toMatchObject({ count: 1, essence: paid, peak: before.cleared });
    expect(m.cleared).toBe(0);
    expect(m.stage).toBe(1);
    for (const k of HERO_KINDS) expect(m.heroes[k]).toEqual(newMeta().heroes[k]);
    expect(m.workshop).toEqual({ wall: 0, startGold: 0, crystals: 0, lab: Math.floor(before.lab * R.keepLab) });
    // stars, the tower's best and the purse stay; reach keeps what goes by the furthest stage
    expect(JSON.stringify(m.stars)).toBe(before.stars);
    expect(m.endless.best).toBe(before.endless);
    expect(m.crystals).toBe(before.crystals);
    expect(reach(m)).toBe(before.cleared);
    expect(canRebrew(m)).toBe(false);
  });

  it('keeps what opens by the furthest stage', () => {
    const m = done();
    const rate = rackRate(m);
    rebrew(m, newMeta());
    expect(rackOpen(m)).toBe(true);
    expect(rackRate(m)).toBe(rate);
    expect(challengeOpen(m)).toBe(true);
  });

  it('survives a save round trip', () => {
    const m = done();
    rebrew(m, newMeta());
    buyPerk(m, 'gold');
    expect(parseMeta(JSON.stringify(m)).alchemy.rebrew).toEqual(m.alchemy.rebrew);
  });

  it('sells each perk up to its max, at a rising price', () => {
    const m = newMeta();
    m.alchemy.rebrew.essence = 10_000;
    for (const id of PERK_IDS) {
      let spent = 0;
      for (let lv = 0; lv < R.perks[id].max; lv++) {
        const cost = perkCost(id, lv)!;
        expect(cost).toBe(R.perks[id].cost * (lv + 1));
        spent += cost;
        expect(buyPerk(m, id)).toBe(true);
      }
      expect(perkCost(id, R.perks[id].max)).toBeNull();
      expect(buyPerk(m, id)).toBe(false);
      expect(perkOf(m, id)).toBeCloseTo(R.perks[id].step * R.perks[id].max, 9);
      expect(spent).toBeGreaterThan(0);
    }
    const poor = newMeta();
    expect(buyPerk(poor, 'wall')).toBe(false);
    expect(poor.alchemy.rebrew.perks.wall).toBe(0);
  });

  it('feeds its perks into the battle setup', () => {
    const m = SAVES.mid();
    const plain = battleSetup(m);
    m.alchemy.rebrew.perks = { reaction: 2, wall: 2, gold: 2, crystals: 0 };
    const s = battleSetup(m);
    expect(s.wallHp).toBeGreaterThan(plain.wallHp);
    expect(s.startGold).toBe(plain.startGold + 2 * R.perks.gold.step);
    expect(s.reactionScale ?? 1).toBeCloseTo((plain.reactionScale ?? 1) + 2 * R.perks.reaction.step, 9);
  });

  it('reads junk as a fresh start and clamps the rest', () => {
    expect(parseRebrew(undefined)).toEqual(newRebrew());
    expect(parseRebrew({ count: -1, essence: 1.5, peak: 999, perks: { wall: 99, gold: 'x' } })).toEqual({
      ...newRebrew(),
      peak: BALANCE.meta.stageCount,
      perks: { ...newRebrew().perks, wall: R.perks.wall.max },
    });
  });
});
