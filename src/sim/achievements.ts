// Achievements: a few tracks of long goals (stages, potion levels, the codex, lifetime counts),
// each in tiers paid in crystals. A tier is claimed by hand once reached, in order; a reached
// tier further along waits for the ones before it. Lifetime counts are kept in `stats`, fed by
// the battle's events; the rest is read straight off the save.

import type { MetaSave } from './meta';
import { BALANCE, ENEMY_KINDS, HERO_KINDS, isBoss, LINEUP, type BattleEvent, type EnemyKind, type HeroKind } from './types';
import { FIRST_STAGE } from './waves';

export const TRACK_IDS = ['stages', 'level', 'ultimates', 'unlock', 'enemies', 'merges', 'kills', 'battles', 'challenge', 'endless', 'login', 'workshop'] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export interface Tier {
  goal: number;
  reward: number;
}

/** Lifetime counts the save does not keep otherwise. */
export interface Stats {
  merges: number;
  kills: number;
  /** Potions brewed to their ultimate (top star) at least once. */
  ultimates: HeroKind[];
  /** Enemy kinds defeated at least once. */
  beaten: EnemyKind[];
  /** The best tier a daily challenge attempt ever reached. */
  challengeTier: number;
}

export interface AchievementSave {
  stats: Stats;
  /** Tiers claimed on each track. */
  claimed: Record<TrackId, number>;
}

const T = (goal: number, reward: number): Tier => ({ goal, reward });

export const TRACKS: Record<TrackId, readonly Tier[]> = {
  stages: [T(1, 30), T(5, 100), T(10, 200), T(15, 300), T(20, 400)],
  level: [T(5, 60), T(10, 150), T(20, 300)],
  ultimates: [T(1, 80), T(3, 150), T(6, 300)],
  unlock: [T(5, 100), T(6, 200)],
  // the first tier is one boss, the second every kind
  enemies: [T(1, 80), T(ENEMY_KINDS.length, 150)],
  merges: [T(100, 60), T(1000, 200)],
  kills: [T(1000, 80), T(10000, 200)],
  battles: [T(10, 60), T(50, 150)],
  challenge: [T(BALANCE.challenge.tiers.length, 100)],
  // the best endless wave
  endless: BALANCE.endless.achievement,
  login: [T(7, 100)],
  workshop: [T(1, 200)],
};

export function newAchievements(): AchievementSave {
  const claimed = {} as Record<TrackId, number>;
  for (const id of TRACK_IDS) claimed[id] = 0;
  return { stats: { merges: 0, kills: 0, ultimates: [], beaten: [], challengeTier: 0 }, claimed };
}

/** Reads the stored part; a save from before achievements gets the enemies its cleared stages
 *  have sent counted as beaten, everything else that can be read off the save counts as is. */
export function parseAchievements(v: unknown, cleared: number): AchievementSave {
  const out = newAchievements();
  const d = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const n = (x: unknown, max = Number.MAX_SAFE_INTEGER) => Math.min(max, Math.max(0, Math.floor(Number(x)) || 0));
  const s = (d.stats ?? {}) as Record<string, unknown>;
  out.stats.merges = n(s.merges);
  out.stats.kills = n(s.kills);
  out.stats.challengeTier = n(s.challengeTier, BALANCE.challenge.tiers.length);
  const list = <K extends string>(x: unknown, all: readonly K[]): K[] => all.filter((k) => Array.isArray(x) && x.includes(k));
  out.stats.ultimates = list(s.ultimates, HERO_KINDS);
  out.stats.beaten = d.stats === undefined ? ENEMY_KINDS.filter((k) => cleared >= FIRST_STAGE[k]) : list(s.beaten, ENEMY_KINDS);
  const c = (d.claimed ?? {}) as Record<string, unknown>;
  for (const id of TRACK_IDS) out.claimed[id] = n(c[id], TRACKS[id].length);
  return out;
}

/** How far along a track is, measured against the goal of `tier` (0-based). */
export function trackProgress(m: MetaSave, id: TrackId, tier: number): number {
  const s = m.achievements.stats;
  switch (id) {
    case 'stages':
      return m.cleared;
    case 'level':
      return Math.max(...HERO_KINDS.filter((k) => LINEUP.includes(k) || m.unlocked.includes(k)).map((k) => m.heroes[k]));
    case 'ultimates':
      return s.ultimates.length;
    case 'unlock':
      return LINEUP.length + m.unlocked.length;
    case 'enemies':
      return tier === 0 ? Number(s.beaten.some(isBoss)) : s.beaten.length;
    case 'merges':
      return s.merges;
    case 'kills':
      return s.kills;
    case 'battles':
      return m.runs;
    case 'challenge':
      return s.challengeTier;
    case 'endless':
      return m.endless.best;
    case 'login':
      return m.daily.claims;
    case 'workshop':
      return Number(Object.entries(BALANCE.meta.workshop).some(([w, def]) => m.workshop[w as keyof MetaSave['workshop']] >= def.max));
  }
}

/** The tier a track works toward next (0-based), or null when every tier is claimed. */
export function nextTier(m: MetaSave, id: TrackId): number | null {
  const i = m.achievements.claimed[id];
  return i < TRACKS[id].length ? i : null;
}

/** The next tier is reached and waits to be claimed. */
export function trackReady(m: MetaSave, id: TrackId): boolean {
  const i = nextTier(m, id);
  return i !== null && trackProgress(m, id, i) >= TRACKS[id][i].goal;
}

export function achievementsClaimable(m: MetaSave): boolean {
  return TRACK_IDS.some((id) => trackReady(m, id));
}

/** Claims the next tier of a track; the crystals it paid, 0 when it is not reached. */
export function claimTier(m: MetaSave, id: TrackId): number {
  if (!trackReady(m, id)) return 0;
  const reward = TRACKS[id][m.achievements.claimed[id]++].reward;
  m.crystals += reward;
  return reward;
}

/** Counts a battle's events toward the lifetime stats. */
export function recordEvents(m: MetaSave, events: readonly BattleEvent[]): void {
  const s = m.achievements.stats;
  for (const ev of events) {
    if (ev.type === 'merge') {
      s.merges++;
      if (ev.star === BALANCE.maxStar && !s.ultimates.includes(ev.kind)) s.ultimates.push(ev.kind);
    } else if (ev.type === 'kill') {
      s.kills++;
      if (!s.beaten.includes(ev.kind)) s.beaten.push(ev.kind);
    }
  }
}

/** A daily challenge attempt reached `tier`. */
export function recordChallenge(m: MetaSave, tier: number): void {
  m.achievements.stats.challengeTier = Math.max(m.achievements.stats.challengeTier, tier);
}
