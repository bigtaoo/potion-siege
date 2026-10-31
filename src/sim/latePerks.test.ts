import { describe, expect, it } from 'vitest';
import { LATE, lateDamage, latePerk, lateStepOf, perkWeight } from './latePerks';
import { MILESTONES, mods, skillRarity, SKILL_IDS } from './skills';
import { HERO_KINDS } from './types';

describe('the late perks past Lv 20', () => {
  it('sit at Lv 25, 30, 35 and 40 on every potion, after its own milestones', () => {
    for (const kind of HERO_KINDS) {
      const late = MILESTONES[kind].flatMap((ms) => ('perk' in ms && lateStepOf(ms.perk) ? [{ level: ms.level, ...lateStepOf(ms.perk)! }] : []));
      expect(late.map((ms) => ms.level)).toEqual([25, 30, 35, 40]);
      expect(late.every((ms) => ms.kind === kind)).toBe(true);
    }
    expect(lateStepOf('fireBurnPlus')).toBeNull();
    expect(lateStepOf('Sharp')).toBeNull();
  });

  it('sharp and keen raise the own damage, aura every potion', () => {
    const perks = new Set<string>([latePerk('fire', 'sharp'), latePerk('fire', 'keen'), latePerk('ice', 'aura')]);
    expect(lateDamage(perks, 'fire')).toBeCloseTo((1 + LATE.sharp) * (1 + LATE.keen) * (1 + LATE.aura));
    expect(lateDamage(perks, 'wind')).toBeCloseTo(1 + LATE.aura);
    expect(lateDamage(new Set(), 'wind')).toBe(1);
  });

  it('deep counts the Lv 10 perk half again, and nothing without it', () => {
    const deep = latePerk('fire', 'deep');
    expect(perkWeight(new Set([deep]), 'fireBurnPlus', 'fire')).toBe(0);
    expect(perkWeight(new Set(['fireBurnPlus']), 'fireBurnPlus', 'fire')).toBe(1);
    expect(perkWeight(new Set(['fireBurnPlus', deep]), 'fireBurnPlus', 'fire')).toBe(1 + LATE.deep);
  });

  it('reach the battle numbers through mods', () => {
    const levels = Object.fromEntries(SKILL_IDS.map((id) => [id, 0])) as Parameters<typeof mods>[0];
    const plain = mods(levels, new Set());
    const sharp = mods(levels, new Set([latePerk('arcane', 'sharp')]));
    expect(sharp.damage('arcane') / plain.damage('arcane')).toBeCloseTo(1 + LATE.sharp);
    expect(sharp.damage('fire')).toBe(plain.damage('fire'));
  });
});

describe('skill rarity', () => {
  it('gives every skill one, the recipes legend', () => {
    for (const id of SKILL_IDS) expect(['common', 'rare', 'epic', 'legend']).toContain(skillRarity(id));
    expect(skillRarity('iceLightning')).toBe('legend');
    expect(skillRarity('allDamage')).toBe('common');
  });
});
