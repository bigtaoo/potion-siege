import { describe, expect, it } from 'vitest';
import { newMeta } from '../../sim/meta';
import { MILESTONES } from '../../sim/skills';
import { BALANCE } from '../../sim/types';
import { nextMilestone, recommendedHero } from './potionPick';

describe("the potions tab's pick", () => {
  it('names the next milestone, none past the last', () => {
    const m = newMeta();
    expect(nextMilestone(m, 'fire')).toBe(MILESTONES.fire[0]);
    m.heroes.fire = BALANCE.meta.heroMax;
    expect(nextMilestone(m, 'fire')).toBeNull();
  });

  it('is the fielded potion a level short of a milestone, else the cheapest', () => {
    const m = newMeta();
    const [a, b] = m.lineup;
    m.heroes[a] = 2;
    expect(recommendedHero(m)).toBe(b);
    m.heroes[a] = MILESTONES[a][0].level - 1;
    expect(recommendedHero(m)).toBe(a);
  });

  it('is none once the four are maxed', () => {
    const m = newMeta();
    for (const k of m.lineup) m.heroes[k] = BALANCE.meta.heroMax;
    expect(recommendedHero(m)).toBeNull();
  });
});
