// Roguelike skills, bought with gold or granted for an ultimate hero: a stack of modifiers the battle reads when heroes fire.
// Most skills belong to a hero and are only offered with it on the board; some are unlocked by
// levelling that hero between battles, and the recipe cards also need a second hero fielded.

import type { Rng } from './rng';
import { BALANCE, HERO_KINDS, type HeroKind } from './types';

export const SKILL_IDS = [
  'allDamage',
  'allSpeed',
  'crit',
  'gold',
  'wallRepair',
  'arcanePower',
  'arcaneMulti',
  'arcaneMark',
  'arcaneSplit',
  'arcaneIce',
  'fireRadius',
  'fireDamage',
  'fireBurn',
  'fireChain',
  'fireArcane',
  'iceFreeze',
  'iceDamage',
  'iceFrostbite',
  'iceShatter',
  'iceLightning',
  'lightningChain',
  'lightningDamage',
  'lightningStatic',
  'lightningStrike',
  'lightningFire',
  'poisonDamage',
  'poisonRust',
  'poisonSplash',
  'poisonMelt',
  'poisonLightning',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

interface SkillDef {
  /** How many times it can be taken. */
  max: number;
  /** Only offered with this hero on the board. */
  hero?: HeroKind;
  /** A recipe: also needs this hero on the board. */
  with?: HeroKind;
}

const DEFS: Record<SkillId, SkillDef> = {
  allDamage: { max: 5 },
  allSpeed: { max: 5 },
  crit: { max: 4 },
  gold: { max: 3 },
  wallRepair: { max: 99 },
  arcanePower: { max: 3, hero: 'arcane' },
  arcaneMulti: { max: 2, hero: 'arcane' },
  arcaneMark: { max: 2, hero: 'arcane' },
  arcaneSplit: { max: 1, hero: 'arcane' },
  arcaneIce: { max: 1, hero: 'arcane', with: 'ice' },
  fireRadius: { max: 3, hero: 'fire' },
  fireDamage: { max: 3, hero: 'fire' },
  fireBurn: { max: 2, hero: 'fire' },
  fireChain: { max: 1, hero: 'fire' },
  fireArcane: { max: 1, hero: 'fire', with: 'arcane' },
  iceFreeze: { max: 3, hero: 'ice' },
  iceDamage: { max: 3, hero: 'ice' },
  iceFrostbite: { max: 1, hero: 'ice' },
  iceShatter: { max: 1, hero: 'ice' },
  iceLightning: { max: 1, hero: 'ice', with: 'lightning' },
  lightningChain: { max: 3, hero: 'lightning' },
  lightningDamage: { max: 3, hero: 'lightning' },
  lightningStatic: { max: 2, hero: 'lightning' },
  lightningStrike: { max: 1, hero: 'lightning' },
  lightningFire: { max: 1, hero: 'lightning', with: 'fire' },
  poisonDamage: { max: 3, hero: 'poison' },
  poisonRust: { max: 2, hero: 'poison' },
  poisonSplash: { max: 1, hero: 'poison' },
  poisonMelt: { max: 1, hero: 'poison' },
  poisonLightning: { max: 1, hero: 'poison', with: 'lightning' },
};

/** The hero a skill belongs to and, for a recipe, the second one it needs. */
export function skillHeroes(id: SkillId): { hero?: HeroKind; with?: HeroKind } {
  return { hero: DEFS[id].hero, with: DEFS[id].with };
}

/** How many times a skill can be taken. */
export function skillMax(id: SkillId): number {
  return DEFS[id].max;
}

/** Passive boosts a milestone gives to a skill the hero already has. */
export const PERK_IDS = ['fireBurnPlus', 'arcaneMarkPlus', 'iceFreezePlus', 'lightningStaticPlus', 'poisonRustPlus'] as const;
export type PerkId = (typeof PERK_IDS)[number];

/** What levelling a hero opens up: a new card in the pool, or a perk. */
export type Milestone = { level: number } & ({ skill: SkillId } | { perk: PerkId });

export const MILESTONES: Record<HeroKind, Milestone[]> = {
  arcane: [
    { level: 5, skill: 'arcaneMark' },
    { level: 10, perk: 'arcaneMarkPlus' },
    { level: 15, skill: 'arcaneSplit' },
    { level: 20, skill: 'arcaneIce' },
  ],
  fire: [
    { level: 5, skill: 'fireBurn' },
    { level: 10, perk: 'fireBurnPlus' },
    { level: 15, skill: 'fireChain' },
    { level: 20, skill: 'fireArcane' },
  ],
  ice: [
    { level: 5, skill: 'iceFrostbite' },
    { level: 10, perk: 'iceFreezePlus' },
    { level: 15, skill: 'iceShatter' },
    { level: 20, skill: 'iceLightning' },
  ],
  lightning: [
    { level: 5, skill: 'lightningStatic' },
    { level: 10, perk: 'lightningStaticPlus' },
    { level: 15, skill: 'lightningStrike' },
    { level: 20, skill: 'lightningFire' },
  ],
  poison: [
    { level: 5, skill: 'poisonSplash' },
    { level: 10, perk: 'poisonRustPlus' },
    { level: 15, skill: 'poisonMelt' },
    { level: 20, skill: 'poisonLightning' },
  ],
};

/** The hero level a skill needs, 1 when it is in the pool from the start. */
function unlockLevel(id: SkillId): number {
  const hero = DEFS[id].hero;
  const m = hero && MILESTONES[hero].find((s) => 'skill' in s && s.skill === id);
  return m ? m.level : 1;
}

/** The skills of a hero that are in the pool from level 1. */
export function baseSkills(kind: HeroKind): SkillId[] {
  return SKILL_IDS.filter((id) => DEFS[id].hero === kind && unlockLevel(id) === 1);
}

/** The perks reached by the given hero levels. */
export function perksFor(levels: Record<HeroKind, number>): Set<PerkId> {
  const out = new Set<PerkId>();
  for (const k of HERO_KINDS) for (const m of MILESTONES[k]) if ('perk' in m && levels[k] >= m.level) out.add(m.perk);
  return out;
}

export type SkillLevels = Record<SkillId, number>;

export function emptySkills(): SkillLevels {
  return Object.fromEntries(SKILL_IDS.map((id) => [id, 0])) as SkillLevels;
}

/** Up to three offers: maxed skills are left out, hero skills only when that hero is fielded
 *  (and levelled far enough to have it). With `focus` (the hero that just went ultimate) its
 *  own skills come first. A reroll passes the cards it replaces as `exclude`; they come back
 *  only when there is not enough else. */
export function rollChoices(
  rng: Rng,
  levels: SkillLevels,
  fielded: ReadonlySet<HeroKind>,
  heroLevels: Record<HeroKind, number>,
  focus?: HeroKind,
  exclude: readonly SkillId[] = [],
  banned: readonly SkillId[] = [],
): SkillId[] {
  const open = SKILL_IDS.filter((id) => {
    const d = DEFS[id];
    if (levels[id] >= d.max || banned.includes(id)) return false;
    if (d.hero === undefined) return true;
    return fielded.has(d.hero) && heroLevels[d.hero] >= unlockLevel(id) && (d.with === undefined || fielded.has(d.with));
  });
  const fresh = open.filter((id) => !exclude.includes(id));
  const own = focus ? fresh.filter((id) => DEFS[id].hero === focus || DEFS[id].with === focus) : [];
  const first = rng.sample(own, 3);
  const rest = [...first, ...rng.sample(fresh.filter((id) => !first.includes(id)), 3 - first.length)];
  return [...rest, ...rng.sample(open.filter((id) => !rest.includes(id)), 3 - rest.length)];
}

/** Modifiers derived from the skill levels and perks, as the battle uses them. */
export interface Mods {
  damage: (kind: HeroKind) => number;
  speed: number;
  crit: number;
  goldPerKill: number;
  extraArrows: number;
  fireRadius: number;
  /** Burn per second, as a fraction of the fire hit that lit it; 0 without the skill. */
  burn: number;
  /** Enemies that die burnt by fire explode again. */
  fireChain: boolean;
  /** Arcane bolts explode on impact. */
  burstBolts: boolean;
  /** Extra damage marked enemies take, as a fraction; 0 without the skill. */
  mark: number;
  /** Arcane bolts that kill split towards the nearest enemies. */
  splitBolts: boolean;
  /** Arcane bolts slow (the arcane-and-ice recipe). */
  frostBolts: boolean;
  freezeChance: number;
  /** Multiplier on every freeze. */
  freezeTime: number;
  /** Ice hits stack frostbite until the enemy freezes. */
  frostbite: boolean;
  /** Enemies that die frozen shatter. */
  shatter: boolean;
  /** Lightning hits slowed or frozen enemies harder (the ice-and-lightning recipe). */
  superconduct: boolean;
  extraChains: number;
  /** Static a lightning hit leaves, as a fraction of it; 0 without the skill. */
  static: number;
  /** Every few shots a lightning potion calls down a sky strike. */
  thunder: boolean;
  /** Lightning sets enemies alight (the lightning-and-fire recipe). */
  plasma: boolean;
  /** Most rust stacks an enemy can carry. */
  rustMax: number;
  /** Extra damage taken per rust stack, as a fraction. */
  rustStep: number;
  /** Corrosion hits splash poison and rust around their target. */
  acidSplash: boolean;
  /** Enemies that die rusted pass their rust on to those around them. */
  melt: boolean;
  /** Lightning hits rust (the corrosion-and-lightning recipe). */
  electrolysis: boolean;
}

export function mods(levels: SkillLevels, perks: ReadonlySet<PerkId> = new Set()): Mods {
  const s = BALANCE.skills;
  const own: Partial<Record<HeroKind, number>> = {
    arcane: 1 + s.classDamage * levels.arcanePower,
    fire: 1 + s.classDamage * levels.fireDamage,
    ice: 1 + s.classDamage * levels.iceDamage,
    lightning: 1 + s.classDamage * levels.lightningDamage,
    poison: 1 + s.classDamage * levels.poisonDamage,
  };
  const p = BALANCE.heroes.poison;
  return {
    damage: (kind) => (1 + s.allDamage * levels.allDamage) * (own[kind] ?? 1),
    speed: 1 + s.allSpeed * levels.allSpeed,
    crit: s.crit * levels.crit,
    goldPerKill: s.gold * levels.gold,
    extraArrows: levels.arcaneMulti,
    fireRadius: 1 + s.fireRadius * levels.fireRadius,
    burn: s.fireBurn * levels.fireBurn * (perks.has('fireBurnPlus') ? 1 + s.fireBurnPlus : 1),
    fireChain: levels.fireChain > 0,
    burstBolts: levels.fireArcane > 0,
    mark: s.arcaneMark * levels.arcaneMark * (perks.has('arcaneMarkPlus') ? 1 + s.arcaneMarkPlus : 1),
    splitBolts: levels.arcaneSplit > 0,
    frostBolts: levels.arcaneIce > 0,
    freezeChance: s.iceFreezeChance * levels.iceFreeze,
    freezeTime: perks.has('iceFreezePlus') ? 1 + s.iceFreezePlus : 1,
    frostbite: levels.iceFrostbite > 0,
    shatter: levels.iceShatter > 0,
    superconduct: levels.iceLightning > 0,
    extraChains: s.lightningChains * levels.lightningChain,
    static: s.lightningStatic * levels.lightningStatic * (perks.has('lightningStaticPlus') ? 1 + s.lightningStaticPlus : 1),
    thunder: levels.lightningStrike > 0,
    plasma: levels.lightningFire > 0,
    rustMax: p.rustMax + s.rustExtra * levels.poisonRust,
    rustStep: p.rustStep * (perks.has('poisonRustPlus') ? 1 + s.rustPlus : 1),
    acidSplash: levels.poisonSplash > 0,
    melt: levels.poisonMelt > 0,
    electrolysis: levels.poisonLightning > 0,
  };
}
