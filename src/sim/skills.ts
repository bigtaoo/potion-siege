// Roguelike skills, bought with gold or granted for an ultimate hero: a stack of modifiers the battle reads when heroes fire.

import type { Rng } from './rng';
import { BALANCE, type HeroKind } from './types';

export const SKILL_IDS = [
  'allDamage',
  'allSpeed',
  'crit',
  'gold',
  'wallRepair',
  'arcanePower',
  'arcaneMulti',
  'fireRadius',
  'iceFreeze',
  'lightningChain',
  'poisonSpread',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

/** How many times each skill can be taken. */
const MAX_LEVEL: Record<SkillId, number> = {
  allDamage: 5,
  allSpeed: 5,
  crit: 4,
  gold: 3,
  wallRepair: 99,
  arcanePower: 3,
  arcaneMulti: 2,
  fireRadius: 3,
  iceFreeze: 3,
  lightningChain: 3,
  poisonSpread: 1,
};

/** Skills that only matter with that hero on the board. */
const NEEDS_HERO: Partial<Record<SkillId, HeroKind>> = {
  arcanePower: 'arcane',
  arcaneMulti: 'arcane',
  fireRadius: 'fire',
  iceFreeze: 'ice',
  lightningChain: 'lightning',
  poisonSpread: 'poison',
};

export type SkillLevels = Record<SkillId, number>;

export function emptySkills(): SkillLevels {
  return Object.fromEntries(SKILL_IDS.map((id) => [id, 0])) as SkillLevels;
}

/** Up to three offers: maxed skills are left out, hero skills only when that hero is fielded.
 *  With `focus` (the hero that just went ultimate) its own skills come first. */
export function rollChoices(rng: Rng, levels: SkillLevels, fielded: ReadonlySet<HeroKind>, focus?: HeroKind): SkillId[] {
  const open = SKILL_IDS.filter((id) => {
    const hero = NEEDS_HERO[id];
    return levels[id] < MAX_LEVEL[id] && (hero === undefined || fielded.has(hero));
  });
  const own = focus ? open.filter((id) => NEEDS_HERO[id] === focus) : [];
  const first = rng.sample(own, 3);
  return [...first, ...rng.sample(open.filter((id) => !first.includes(id)), 3 - first.length)];
}

/** Modifiers derived from the skill levels, as the battle uses them. */
export interface Mods {
  damage: (kind: HeroKind) => number;
  speed: number;
  crit: number;
  goldPerKill: number;
  extraArrows: number;
  fireRadius: number;
  freezeChance: number;
  extraChains: number;
  poisonSpread: boolean;
}

export function mods(levels: SkillLevels): Mods {
  const s = BALANCE.skills;
  return {
    damage: (kind) => (1 + s.allDamage * levels.allDamage) * (kind === 'arcane' ? 1 + s.classDamage * levels.arcanePower : 1),
    speed: 1 + s.allSpeed * levels.allSpeed,
    crit: s.crit * levels.crit,
    goldPerKill: s.gold * levels.gold,
    extraArrows: levels.arcaneMulti,
    fireRadius: 1 + s.fireRadius * levels.fireRadius,
    freezeChance: s.iceFreezeChance * levels.iceFreeze,
    extraChains: s.lightningChains * levels.lightningChain,
    poisonSpread: levels.poisonSpread > 0,
  };
}
