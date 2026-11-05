// Roguelike skills, bought with gold or granted for an ultimate hero: a stack of modifiers the battle reads when heroes fire.
// Most skills belong to a hero and are only offered with it on the board; some are unlocked by
// levelling that hero between battles, and the recipe cards also need a second hero fielded.

import { LATE_STEPS, lateDamage, latePerk, perkWeight, type LatePerkId } from './latePerks';
import type { Prng } from './math/prng';
import { sample } from './math/pick';
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
  'windDamage',
  'windPush',
  'windHaste',
  'windGust',
  'windVortex',
  'windFire',
  'lightDamage',
  'lightWide',
  'lightGlare',
  'lightFocus',
  'lightFire',
  'metalDamage',
  'metalShrapnel',
  'metalCrush',
  'metalBreak',
  'metalFire',
  'vineDamage',
  'vineRoot',
  'vineThorns',
  'vineSpread',
  'vinePoison',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

interface SkillDef {
  /** How many times it can be taken. */
  max: number;
  /** Only offered with this hero on the board. */
  hero?: HeroKind;
  /** A recipe: also needs this hero on the board. */
  with?: HeroKind;
  /** How strong the card is, for its frame: the plain boosts common, the Lv 5 cards and the
   *  stronger base ones rare, the Lv 15 cards epic, the recipes legend. */
  rarity: Rarity;
}

export const RARITIES = ['common', 'rare', 'epic', 'legend'] as const;
export type Rarity = (typeof RARITIES)[number];

const DEFS: Record<SkillId, SkillDef> = {
  allDamage: { max: 5, rarity: 'common' },
  allSpeed: { max: 5, rarity: 'common' },
  crit: { max: 4, rarity: 'rare' },
  gold: { max: 3, rarity: 'common' },
  wallRepair: { max: 99, rarity: 'common' },
  arcanePower: { max: 3, hero: 'arcane', rarity: 'common' },
  arcaneMulti: { max: 2, hero: 'arcane', rarity: 'rare' },
  arcaneMark: { max: 2, hero: 'arcane', rarity: 'rare' },
  arcaneSplit: { max: 1, hero: 'arcane', rarity: 'epic' },
  arcaneIce: { max: 1, hero: 'arcane', with: 'ice', rarity: 'legend' },
  fireRadius: { max: 3, hero: 'fire', rarity: 'common' },
  fireDamage: { max: 3, hero: 'fire', rarity: 'common' },
  fireBurn: { max: 2, hero: 'fire', rarity: 'rare' },
  fireChain: { max: 1, hero: 'fire', rarity: 'epic' },
  fireArcane: { max: 1, hero: 'fire', with: 'arcane', rarity: 'legend' },
  iceFreeze: { max: 3, hero: 'ice', rarity: 'common' },
  iceDamage: { max: 3, hero: 'ice', rarity: 'common' },
  iceFrostbite: { max: 1, hero: 'ice', rarity: 'rare' },
  iceShatter: { max: 1, hero: 'ice', rarity: 'epic' },
  iceLightning: { max: 1, hero: 'ice', with: 'lightning', rarity: 'legend' },
  lightningChain: { max: 3, hero: 'lightning', rarity: 'common' },
  lightningDamage: { max: 3, hero: 'lightning', rarity: 'common' },
  lightningStatic: { max: 2, hero: 'lightning', rarity: 'rare' },
  lightningStrike: { max: 1, hero: 'lightning', rarity: 'epic' },
  lightningFire: { max: 1, hero: 'lightning', with: 'fire', rarity: 'legend' },
  poisonDamage: { max: 3, hero: 'poison', rarity: 'common' },
  poisonRust: { max: 2, hero: 'poison', rarity: 'rare' },
  poisonSplash: { max: 1, hero: 'poison', rarity: 'rare' },
  poisonMelt: { max: 1, hero: 'poison', rarity: 'epic' },
  poisonLightning: { max: 1, hero: 'poison', with: 'lightning', rarity: 'legend' },
  windDamage: { max: 3, hero: 'wind', rarity: 'common' },
  windPush: { max: 3, hero: 'wind', rarity: 'common' },
  windHaste: { max: 2, hero: 'wind', rarity: 'rare' },
  windGust: { max: 1, hero: 'wind', rarity: 'rare' },
  windVortex: { max: 1, hero: 'wind', rarity: 'epic' },
  windFire: { max: 1, hero: 'wind', with: 'fire', rarity: 'legend' },
  lightDamage: { max: 3, hero: 'light', rarity: 'common' },
  lightWide: { max: 3, hero: 'light', rarity: 'common' },
  lightGlare: { max: 2, hero: 'light', rarity: 'rare' },
  lightFocus: { max: 1, hero: 'light', rarity: 'epic' },
  lightFire: { max: 1, hero: 'light', with: 'fire', rarity: 'legend' },
  metalDamage: { max: 3, hero: 'metal', rarity: 'common' },
  metalShrapnel: { max: 3, hero: 'metal', rarity: 'common' },
  metalCrush: { max: 2, hero: 'metal', rarity: 'rare' },
  metalBreak: { max: 1, hero: 'metal', rarity: 'epic' },
  metalFire: { max: 1, hero: 'metal', with: 'fire', rarity: 'legend' },
  vineDamage: { max: 3, hero: 'vine', rarity: 'common' },
  vineRoot: { max: 3, hero: 'vine', rarity: 'common' },
  vineThorns: { max: 2, hero: 'vine', rarity: 'rare' },
  vineSpread: { max: 1, hero: 'vine', rarity: 'epic' },
  vinePoison: { max: 1, hero: 'vine', with: 'poison', rarity: 'legend' },
};

/** The hero a skill belongs to and, for a recipe, the second one it needs. */
export function skillHeroes(id: SkillId): { hero?: HeroKind; with?: HeroKind } {
  return { hero: DEFS[id].hero, with: DEFS[id].with };
}

/** How strong a skill's card is. */
export function skillRarity(id: SkillId): Rarity {
  return DEFS[id].rarity;
}

/** How many times a skill can be taken. */
export function skillMax(id: SkillId): number {
  return DEFS[id].max;
}

/** Passive boosts a milestone gives to a skill the hero already has, and past Lv 20 the late
 *  perks (latePerks.ts). */
export const PERK_IDS = ['fireBurnPlus', 'arcaneMarkPlus', 'iceFreezePlus', 'lightningStaticPlus', 'poisonRustPlus', 'windPushPlus', 'lightGlarePlus', 'metalCrushPlus', 'vineThornsPlus'] as const;
export type PerkId = (typeof PERK_IDS)[number] | LatePerkId;

/** What levelling a hero opens up: a new card in the pool, or a perk. */
export type Milestone = { level: number } & ({ skill: SkillId } | { perk: PerkId });

const late = (kind: HeroKind): Milestone[] => LATE_STEPS.map(({ level, step }) => ({ level, perk: latePerk(kind, step) }));

export const MILESTONES: Record<HeroKind, Milestone[]> = {
  arcane: [
    { level: 5, skill: 'arcaneMark' },
    { level: 10, perk: 'arcaneMarkPlus' },
    { level: 15, skill: 'arcaneSplit' },
    { level: 20, skill: 'arcaneIce' },
    ...late('arcane'),
  ],
  fire: [
    { level: 5, skill: 'fireBurn' },
    { level: 10, perk: 'fireBurnPlus' },
    { level: 15, skill: 'fireChain' },
    { level: 20, skill: 'fireArcane' },
    ...late('fire'),
  ],
  ice: [
    { level: 5, skill: 'iceFrostbite' },
    { level: 10, perk: 'iceFreezePlus' },
    { level: 15, skill: 'iceShatter' },
    { level: 20, skill: 'iceLightning' },
    ...late('ice'),
  ],
  lightning: [
    { level: 5, skill: 'lightningStatic' },
    { level: 10, perk: 'lightningStaticPlus' },
    { level: 15, skill: 'lightningStrike' },
    { level: 20, skill: 'lightningFire' },
    ...late('lightning'),
  ],
  poison: [
    { level: 5, skill: 'poisonSplash' },
    { level: 10, perk: 'poisonRustPlus' },
    { level: 15, skill: 'poisonMelt' },
    { level: 20, skill: 'poisonLightning' },
    ...late('poison'),
  ],
  wind: [
    { level: 5, skill: 'windGust' },
    { level: 10, perk: 'windPushPlus' },
    { level: 15, skill: 'windVortex' },
    { level: 20, skill: 'windFire' },
    ...late('wind'),
  ],
  light: [
    { level: 5, skill: 'lightGlare' },
    { level: 10, perk: 'lightGlarePlus' },
    { level: 15, skill: 'lightFocus' },
    { level: 20, skill: 'lightFire' },
    ...late('light'),
  ],
  metal: [
    { level: 5, skill: 'metalCrush' },
    { level: 10, perk: 'metalCrushPlus' },
    { level: 15, skill: 'metalBreak' },
    { level: 20, skill: 'metalFire' },
    ...late('metal'),
  ],
  vine: [
    { level: 5, skill: 'vineThorns' },
    { level: 10, perk: 'vineThornsPlus' },
    { level: 15, skill: 'vineSpread' },
    { level: 20, skill: 'vinePoison' },
    ...late('vine'),
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
  rng: Prng,
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
  const first = sample(rng, own, 3);
  const rest = [...first, ...sample(rng, fresh.filter((id) => !first.includes(id)), 3 - first.length)];
  return [...rest, ...sample(rng, open.filter((id) => !rest.includes(id)), 3 - rest.length)];
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
  /** Multiplier on how far wind hits knock enemies back. */
  push: number;
  /** The perk: the boiler golem is knocked back as far as the rest. */
  pushHeavy: boolean;
  /** Multiplier on the wind potions' attack speed, on top of `speed`. */
  windSpeed: number;
  /** Every few shots a wind potion sends a gust across the field. */
  gust: boolean;
  /** Wind kills leave a whirlwind that pulls the enemies around it in. */
  vortex: boolean;
  /** Wind fans the fire on what it hits and blows it onto those around (the wind-and-fire recipe). */
  windFire: boolean;
  /** Multiplier on the light beam's width. */
  beamWidth: number;
  /** The glare's slow on everything a beam crosses (a fraction); 0 without the skill. */
  glareSlow: number;
  /** The beam hits everything on it as hard as its target. */
  focus: boolean;
  /** Light beams scorch (the light-and-fire recipe). */
  sunfire: boolean;
  /** Quicksilver slugs splash this fraction around their target; 0 without the skill. */
  shrapnel: number;
  /** Permille chance a quicksilver slug knocks its target down; 0 without the skill. */
  crush: number;
  /** Multiplier on how long the knock-down lasts. */
  crushTime: number;
  /** Quicksilver hits leave the target brittle. */
  armorBreak: boolean;
  /** Quicksilver hits burning enemies harder (the quicksilver-and-fire recipe). */
  forge: boolean;
  /** Multiplier on how long a root holds. */
  rootTime: number;
  /** Thorns a root sets going, per second, as a fraction of the vine hit; 0 without the skill. */
  thorns: number;
  /** A vine kill sends its tendril on to the nearest enemy. */
  vineSpread: boolean;
  /** Vine hits poison (the vine-and-corrosion recipe). */
  vinePoison: boolean;
}

export function mods(levels: SkillLevels, perks: ReadonlySet<PerkId> = new Set()): Mods {
  const s = BALANCE.skills;
  const own: Partial<Record<HeroKind, number>> = {
    arcane: 1 + s.classDamage * levels.arcanePower,
    fire: 1 + s.classDamage * levels.fireDamage,
    ice: 1 + s.classDamage * levels.iceDamage,
    lightning: 1 + s.classDamage * levels.lightningDamage,
    poison: 1 + s.classDamage * levels.poisonDamage,
    wind: 1 + s.classDamage * levels.windDamage,
    light: 1 + s.classDamage * levels.lightDamage,
    metal: 1 + s.classDamage * levels.metalDamage,
    vine: 1 + s.classDamage * levels.vineDamage,
  };
  const p = BALANCE.heroes.poison;
  const w = (base: PerkId, kind: HeroKind) => perkWeight(perks, base, kind);
  return {
    damage: (kind) => (1 + s.allDamage * levels.allDamage) * (own[kind] ?? 1) * lateDamage(perks, kind),
    speed: 1 + s.allSpeed * levels.allSpeed,
    crit: s.crit * levels.crit,
    goldPerKill: s.gold * levels.gold,
    extraArrows: levels.arcaneMulti,
    fireRadius: 1 + s.fireRadius * levels.fireRadius,
    burn: s.fireBurn * levels.fireBurn * (1 + s.fireBurnPlus * w('fireBurnPlus', 'fire')),
    fireChain: levels.fireChain > 0,
    burstBolts: levels.fireArcane > 0,
    mark: s.arcaneMark * levels.arcaneMark * (1 + s.arcaneMarkPlus * w('arcaneMarkPlus', 'arcane')),
    splitBolts: levels.arcaneSplit > 0,
    frostBolts: levels.arcaneIce > 0,
    freezeChance: s.iceFreezeChance * levels.iceFreeze,
    freezeTime: 1 + s.iceFreezePlus * w('iceFreezePlus', 'ice'),
    frostbite: levels.iceFrostbite > 0,
    shatter: levels.iceShatter > 0,
    superconduct: levels.iceLightning > 0,
    extraChains: s.lightningChains * levels.lightningChain,
    static: s.lightningStatic * levels.lightningStatic * (1 + s.lightningStaticPlus * w('lightningStaticPlus', 'lightning')),
    thunder: levels.lightningStrike > 0,
    plasma: levels.lightningFire > 0,
    rustMax: p.rustMax + s.rustExtra * levels.poisonRust,
    rustStep: p.rustStep * (1 + s.rustPlus * w('poisonRustPlus', 'poison')),
    acidSplash: levels.poisonSplash > 0,
    melt: levels.poisonMelt > 0,
    electrolysis: levels.poisonLightning > 0,
    push: (1 + s.windPush * levels.windPush) * (1 + s.windPushPlus * w('windPushPlus', 'wind')),
    pushHeavy: perks.has('windPushPlus'),
    windSpeed: 1 + s.windHaste * levels.windHaste,
    gust: levels.windGust > 0,
    vortex: levels.windVortex > 0,
    windFire: levels.windFire > 0,
    beamWidth: 1 + s.lightWide * levels.lightWide,
    glareSlow: s.lightGlareSlow * levels.lightGlare * (1 + s.lightGlarePlus * w('lightGlarePlus', 'light')),
    focus: levels.lightFocus > 0,
    sunfire: levels.lightFire > 0,
    shrapnel: s.metalShrapnel * levels.metalShrapnel,
    crush: Math.round(s.metalCrush * levels.metalCrush * 1000),
    crushTime: 1 + s.metalCrushPlus * w('metalCrushPlus', 'metal'),
    armorBreak: levels.metalBreak > 0,
    forge: levels.metalFire > 0,
    rootTime: 1 + s.vineRoot * levels.vineRoot,
    thorns: s.vineThorns * levels.vineThorns * (1 + s.vineThornsPlus * w('vineThornsPlus', 'vine')),
    vineSpread: levels.vineSpread > 0,
    vinePoison: levels.vinePoison > 0,
  };
}
