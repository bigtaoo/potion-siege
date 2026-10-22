import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { skillHeroes, SKILL_IDS } from './skills';
import { suggestSkill } from './suggest';
import type { HeroKind } from './types';

/** A battle with only these potions on the board, at these stars. */
function board(...heroes: [HeroKind, number][]): Battle {
  const b = new Battle(1);
  b.slots.fill(null);
  const free = b.freeSlots();
  heroes.forEach(([kind, star], i) => {
    const slot = free[i];
    b.slots[slot] = { id: 100 + i, kind, star, slot, cooldown: 0 };
  });
  return b;
}

const recipe = SKILL_IDS.find((id) => skillHeroes(id).with)!;
const { hero: recipeHero, with: recipeWith } = skillHeroes(recipe);

describe('suggested skill', () => {
  it('points at the skill of the potion the board has most of, a star counting double', () => {
    const b = board(['fire', 1], ['ice', 1], ['ice', 1], ['fire', 2], ['fire', 1]);
    expect(suggestSkill(b, ['iceDamage', 'fireDamage', 'allDamage'])).toBe(1);
    expect(suggestSkill(b, ['iceDamage', 'gold'])).toBe(0);
  });

  it('takes a shared card over a potion that is barely there', () => {
    const b = board(['fire', 2], ['fire', 2], ['ice', 1]);
    expect(suggestSkill(b, ['iceDamage', 'allDamage', 'gold'])).toBe(1);
  });

  it('skips a recipe whose second potion is not fielded', () => {
    const b = board([recipeHero!, 3]);
    expect(suggestSkill(b, [recipe, 'allSpeed'])).toBe(1);
    const both = board([recipeHero!, 3], [recipeWith!, 1]);
    expect(suggestSkill(both, [recipe, 'allSpeed'])).toBe(0);
  });

  it('points at the wall repair only once the wall is under half', () => {
    const b = board(['fire', 1], ['ice', 1]);
    expect(suggestSkill(b, ['wallRepair', 'allDamage'])).toBe(1);
    b.wall = b.wallMax / 3;
    expect(suggestSkill(b, ['wallRepair', 'allDamage'])).toBe(0);
  });

  it('breaks a tie toward the card taken less, then the leftmost', () => {
    const b = board(['fire', 1]);
    expect(suggestSkill(b, ['allDamage', 'allSpeed'])).toBe(0);
    b.skills.allDamage = 2;
    expect(suggestSkill(b, ['allDamage', 'allSpeed'])).toBe(1);
  });
});
