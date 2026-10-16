// Loose pins on the balance targets, so a change to balance.json or the battle cannot silently
// break them. `npm run balance` has the full picture; these only guard the edges, with the bot.
import { describe, expect, it } from 'vitest';
import { playOut } from './bot';
import { battleSetup, newMeta } from './meta';
import { HERO_KINDS, LINEUP } from './types';

function runs(stage: number, seeds: number, heroLevel = 1, workshop = 0) {
  const m = newMeta();
  for (const k of HERO_KINDS) m.heroes[k] = heroLevel;
  m.workshop = { wall: workshop, startGold: workshop, crystals: workshop };
  const setup = battleSetup(m, stage);
  return Array.from({ length: seeds }, (_, i) => playOut(1000 + i, 1200, setup));
}

const winRate = (bs: ReturnType<typeof runs>) => bs.filter((b) => b.result === 'won').length / bs.length;

describe('balance targets', () => {
  const fresh1 = runs(1, 20);

  it('lets a fresh save win stage 1 most of the time', () => {
    expect(winRate(fresh1)).toBeGreaterThanOrEqual(0.7);
  });

  it('makes stage 3 clearly harder than stage 1 on a fresh save', () => {
    expect(winRate(runs(3, 20))).toBeLessThanOrEqual(winRate(fresh1) - 0.2);
  });

  it('lets a late save beat stage 1 every time', () => {
    expect(winRate(runs(1, 8, 12, 8))).toBe(1);
  });

  it('keeps every potion under half of the damage', () => {
    const total = fresh1.reduce((s, b) => s + LINEUP.reduce((t, k) => t + b.dealt[k], 0), 0);
    for (const k of LINEUP) {
      const share = fresh1.reduce((s, b) => s + b.dealt[k], 0) / total;
      expect(share, k).toBeLessThan(0.45);
      expect(share, k).toBeGreaterThan(0.1);
    }
  });
});
