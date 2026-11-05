// The alchemy tower (plan 5a): endless mode's floors are its waves, a boss every 5 and a new
// chapter every 10 (waves.ts). Right after each boss floor, as the next floor sets out, the
// battle stops on a pick of three catalysts: relics that hold for the rest of the climb and
// stack when one is picked again, adding up (never multiplying) and only up to K.max times, so
// the climb still ends. Their dice are their own (seed and floor), so the skill
// cards' stream rolls as it did. Campaign battles never see them.

import type { Battle } from './battle';
import { fixedMods } from './fixedMods';
import { Prng } from './math/prng';
import { pm, times } from './math/fixed';
import { mods, type Mods } from './skills';
import { BALANCE } from './types';

export const CATALYSTS = ['volatile', 'wide', 'potent', 'quick', 'bulwark', 'bounty'] as const;
export type CatalystId = (typeof CATALYSTS)[number];

const K = BALANCE.endless.catalyst;
const OFFER = 3;
const SALT = 0x2545f491;

export function isCatalyst(id: unknown): id is CatalystId {
  return CATALYSTS.includes(id as CatalystId);
}

/** How many times `id` was picked this climb, as far as it counts (K.max). */
export function catalystCount(list: readonly CatalystId[], id: CatalystId): number {
  let n = 0;
  for (const c of list) if (c === id) n++;
  return Math.min(K.max, n);
}

/** Whether `wave` opens on a pick: the floor after each boss. */
export function catalystFloor(wave: number): boolean {
  return wave > 1 && (wave - 1) % K.every === 0;
}

/** Three different catalysts for the pick on `wave`. */
export function rollCatalysts(seed: number, wave: number): CatalystId[] {
  const rng = new Prng((seed ^ SALT) + wave * 7919);
  const pool = [...CATALYSTS];
  const out: CatalystId[] = [];
  while (out.length < OFFER) out.push(pool.splice(rng.int(pool.length), 1)[0]!);
  return out;
}

/** Right after a floor started (next to bossPrep.ts): the pick, once. */
export function offerCatalyst(b: Battle): void {
  if (!b.setup.endless || b.waveTime !== 0 || !catalystFloor(b.wave) || b.catalystChoices) return;
  b.catalystChoices = rollCatalysts(b.seed, b.wave);
  b.events.push({ type: 'offer', reason: 'catalyst' });
}

/** The pick: kept for the rest of the climb, its effect on at once. */
export function pickCatalyst(b: Battle, id: CatalystId): boolean {
  if (!b.catalystChoices?.includes(id)) return false;
  b.catalysts.push(id);
  b.catalystChoices = null;
  if (id === 'bulwark' && catalystCount(b.catalysts.slice(0, -1), 'bulwark') < K.max) {
    b.wallMax = times(b.wallMax, 1000 + pm(K.bulwark));
    b.wall = b.wallMax;
  }
  b.mods = catalyzed(mods(b.skills, b.perks), b.catalysts);
  b.fixed = fixedMods(b.mods, b.setup);
  return true;
}

/** The skills' mods with the climb's catalysts on top. */
export function catalyzed(m: Mods, list: readonly CatalystId[]): Mods {
  if (list.length === 0) return m;
  const potent = 1 + K.potent * catalystCount(list, 'potent');
  const damage = m.damage;
  return {
    ...m,
    damage: (kind) => damage(kind) * potent,
    speed: m.speed * (1 + K.quick * catalystCount(list, 'quick')),
    goldPerKill: m.goldPerKill + K.bounty * catalystCount(list, 'bounty'),
  };
}

/** What the climb's catalysts multiply every reaction's power and reach by. */
export function catalystReaction(list: readonly CatalystId[]): { power: number; reach: number } {
  return { power: 1 + K.volatile * catalystCount(list, 'volatile'), reach: 1 + K.wide * catalystCount(list, 'wide') };
}
