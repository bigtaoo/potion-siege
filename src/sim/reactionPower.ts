// How strong a reaction goes off (reactions.ts), on top of its own numbers: its mastery, the stars
// the save earned by setting it off 100, 1000 and 10000 times (each a little more power for
// good, carried in the battle's setup), and the old legend recipes, which are now the boosts of
// their reaction (it hits harder and reaches further while the recipe is taken).
// Also the save's side: the reactions a battle's events find for the first time, and the stars
// they earn, for the reward and the line that says so.

import type { Battle } from './battle';
import type { MetaSave } from './meta';
import type { SkillId } from './skills';
import { BALANCE, REACTION_IDS, type BattleEvent, type ReactionId } from './types';
import { catalystReaction } from './tower';

/** How many times it takes for each mastery star of a reaction. */
export const REACTION_MASTERY = [100, 1000, 10000] as const;

/** The legend recipes that boost each reaction. */
export const REACTION_LEGENDS: Record<ReactionId, readonly SkillId[]> = {
  steam: [],
  superconduct: ['iceLightning'],
  overload: ['lightningFire'],
  electrolysis: ['poisonLightning'],
  combustion: [],
  firestorm: ['windFire'],
  blizzard: [],
  resonance: ['arcaneIce', 'fireArcane'],
};

/** The reaction a legend recipe boosts; null for every other skill. */
export function boostedBy(skill: SkillId): ReactionId | null {
  return REACTION_IDS.find((id) => REACTION_LEGENDS[id].includes(skill)) ?? null;
}

/** The stars a reaction set off `n` times has earned. */
export function masteryStars(n: number): number {
  return REACTION_MASTERY.filter((goal) => n >= goal).length;
}

/** The stars of every reaction that has one, for the battle's setup (none: left out). */
export function masteryOf(m: MetaSave): Partial<Record<ReactionId, number>> | undefined {
  const out: Partial<Record<ReactionId, number>> = {};
  for (const id of REACTION_IDS) {
    const s = masteryStars(m.achievements.stats.reactions[id]);
    if (s > 0) out[id] = s;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Whether a legend recipe that boosts `id` is taken in `b`. */
export function legendBoosted(b: Battle, id: ReactionId): boolean {
  return REACTION_LEGENDS[id].some((s) => b.skills[s] > 0);
}

/** What multiplies `id`'s damage, burn and slow time in `b` (power) and its radius (reach). */
export function reactionPower(b: Battle, id: ReactionId): { power: number; reach: number } {
  const C = BALANCE.reactions;
  const legend = legendBoosted(b, id);
  const stars = Math.min(REACTION_MASTERY.length, Math.max(0, Math.trunc(b.setup.mastery?.[id] ?? 0)));
  const cat = catalystReaction(b.catalysts);
  const scale = (b.setup.reactionScale ?? 1) * (b.setup.focus?.id === id ? b.setup.focus.power : 1);
  return { power: (1 + C.masteryStep * stars) * (legend ? C.legendPower : 1) * cat.power * scale, reach: (legend ? C.legendReach : 1) * cat.reach };
}

export interface ReactionNews {
  /** Reactions set off for the first time ever. */
  found: ReactionId[];
  /** Reactions that earned a mastery star, with the stars they have now. */
  starred: [ReactionId, number][];
}

/** What `events` will bring the save before they are counted: the reactions new to it and the
 *  stars reached. */
export function reactionNews(m: MetaSave, events: readonly BattleEvent[]): ReactionNews {
  const add: Partial<Record<ReactionId, number>> = {};
  for (const ev of events) if (ev.type === 'reaction') add[ev.id] = (add[ev.id] ?? 0) + 1;
  const out: ReactionNews = { found: [], starred: [] };
  for (const id of Object.keys(add) as ReactionId[]) {
    const was = m.achievements.stats.reactions[id];
    if (was === 0) out.found.push(id);
    const now = masteryStars(was + add[id]!);
    if (now > masteryStars(was)) out.starred.push([id, now]);
  }
  return out;
}
