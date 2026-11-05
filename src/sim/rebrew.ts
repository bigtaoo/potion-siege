// Rebrew (plan 5b): once the campaign's last stage is cleared, the player may pour it all back
// into the cauldron. The campaign starts over at stage 1 and the potions at their first level,
// the workshop empties but for part of the lab; the codex, mastery, talent picks, stars and the
// tower's records stay. In return: essence, by the stages and stars brought in, for perks that
// hold for good. The second climb is quicker, and can be fought with another lineup.
// `reach` is the furthest stage the save has ever cleared: what stars, achievements, endless and
// the lab go by, so nothing earned closes again.

import type { MetaSave } from './meta';
import { BALANCE, HERO_KINDS } from './types';

const R = BALANCE.alchemy.rebrew;

export const PERK_IDS = ['reaction', 'wall', 'gold', 'crystals'] as const;
export type PerkId = (typeof PERK_IDS)[number];

export interface RebrewSave {
  /** Rebrews done: the badge by the avatar. */
  count: number;
  /** Essence not spent yet. */
  essence: number;
  /** The furthest stage cleared before the last rebrew. */
  peak: number;
  /** Stars held at the last rebrew: already paid for, as stars stay. */
  stars: number;
  perks: Record<PerkId, number>;
}

export function newRebrew(): RebrewSave {
  return { count: 0, essence: 0, peak: 0, stars: 0, perks: { reaction: 0, wall: 0, gold: 0, crystals: 0 } };
}

const n = (v: unknown, max: number) => (Number.isSafeInteger(v) && (v as number) >= 0 ? Math.min(max, v as number) : 0);

export function parseRebrew(raw: unknown): RebrewSave {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const p = (d.perks && typeof d.perks === 'object' ? d.perks : {}) as Record<string, unknown>;
  const out = newRebrew();
  out.count = n(d.count, 9999);
  out.essence = n(d.essence, Number.MAX_SAFE_INTEGER);
  out.peak = n(d.peak, BALANCE.meta.stageCount);
  out.stars = n(d.stars, 9999);
  for (const id of PERK_IDS) out.perks[id] = n(p[id], R.perks[id].max);
  return out;
}

/** The furthest stage this save has ever cleared, rebrews included. */
export function reach(m: Pick<MetaSave, 'cleared' | 'alchemy'>): number {
  return Math.max(m.cleared, m.alchemy.rebrew.peak);
}

export function canRebrew(m: MetaSave): boolean {
  return m.cleared >= R.from;
}

function starsHeld(m: MetaSave): number {
  return [...m.stars.normal, ...m.stars.hard].reduce((a, b) => a + b, 0);
}

/** Essence a rebrew now would pay: by the stages cleared this climb and the stars won since the
 *  last rebrew (stars stay, so each pays once). */
export function essenceFor(m: MetaSave): number {
  const stars = Math.max(0, starsHeld(m) - m.alchemy.rebrew.stars);
  return Math.floor(m.cleared * R.perStage + stars * R.perStar);
}

/** Pours the save back: returns the essence paid, 0 when it cannot be done yet. */
export function rebrew(m: MetaSave, fresh: MetaSave): number {
  if (!canRebrew(m)) return 0;
  const paid = essenceFor(m);
  const r = m.alchemy.rebrew;
  r.essence += paid;
  r.count++;
  r.peak = reach(m);
  r.stars = Math.max(r.stars, starsHeld(m));
  m.cleared = 0;
  m.stage = 1;
  for (const k of HERO_KINDS) m.heroes[k] = fresh.heroes[k];
  m.workshop = { wall: 0, startGold: 0, crystals: 0, lab: Math.floor(m.workshop.lab * R.keepLab) };
  m.alchemy.stuck = { stage: 0, n: 0 };
  m.alchemy.replay = { day: '', stage: 0, n: 0 };
  m.lossStreak = 0;
  return paid;
}

export function perkCost(id: PerkId, level: number): number | null {
  return level >= R.perks[id].max ? null : R.perks[id].cost * (level + 1);
}

export function buyPerk(m: MetaSave, id: PerkId): boolean {
  const r = m.alchemy.rebrew;
  const cost = perkCost(id, r.perks[id]);
  if (cost === null || r.essence < cost) return false;
  r.essence -= cost;
  r.perks[id]++;
  return true;
}

/** A perk's value at a level: a fraction, or gold for `gold`. */
export function perkValue(id: PerkId, level: number): number {
  return R.perks[id].step * level;
}

export function perkOf(m: Pick<MetaSave, 'alchemy'>, id: PerkId): number {
  return perkValue(id, m.alchemy.rebrew.perks[id]);
}
