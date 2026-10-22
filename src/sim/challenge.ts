// The daily challenge: one run a day, seeded by the date so everyone fights the same waves,
// a little past the player's furthest stage and bent by two modifiers drawn for that day. It
// pays crystals by the wave it reached, once a day at the best tier, plus a bonus for every
// seven days in a row it was played. Days are local calendar dates, as in `daily`.

import { hash } from './daily';
import { battleSetup, type BattleModifiers, type BattleSetup, type MetaSave } from './meta';
import { Rng } from './rng';
import { BALANCE, HERO_KINDS, type HeroKind } from './types';

const C = BALANCE.challenge;

export const MODIFIER_IDS = ['swift', 'ironWall', 'cheap', 'twinBoss', 'critDay', 'trial', 'solo', 'goldRain'] as const;
export type ModifierId = (typeof MODIFIER_IDS)[number];

export interface ChallengeSave {
  /** The last day a challenge attempt was started. */
  date: string;
  /** Attempts started on `date`: the free one, then the one a rewarded ad buys. */
  attempts: number;
  /** The furthest wave reached on `date`. */
  best: number;
  /** Days in a row played, up to `date`. */
  streak: number;
}

/** One day's challenge for one player: the run's seed and modifiers are the day's, the stage
 *  follows the player's progress. */
export interface Challenge {
  day: string;
  seed: number;
  stage: number;
  mods: ModifierId[];
  /** The potion the trial modifier puts in the lineup, or null without it. */
  trial: HeroKind | null;
}

/** What one attempt booked. */
export interface ChallengeResult {
  wave: number;
  /** Today's furthest wave, this attempt included. */
  best: number;
  /** Tiers this attempt reached, and today's best. */
  tier: number;
  bestTier: number;
  /** Crystals paid now: what the best tier is worth over what was paid for it already. */
  crystals: number;
}

export function newChallenge(): ChallengeSave {
  return { date: '', attempts: 0, best: 0, streak: 0 };
}

/** Reads the stored challenge part, dropping anything that does not fit. */
export function parseChallenge(v: unknown): ChallengeSave {
  const out = newChallenge();
  if (!v || typeof v !== 'object') return out;
  const d = v as Record<string, unknown>;
  const n = (x: unknown, max: number) => Math.min(max, Math.max(0, Math.floor(Number(x)) || 0));
  if (typeof d.date === 'string') out.date = d.date;
  out.attempts = n(d.attempts, BALANCE.challenge.attempts + BALANCE.challenge.adAttempts);
  out.best = n(d.best, 999);
  out.streak = n(d.streak, Number.MAX_SAFE_INTEGER);
  return out;
}

/** The calendar day before `day`. */
export function prevDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const p = (n: number) => String(n).padStart(2, '0');
  const at = new Date(y, m - 1, d - 1);
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}`;
}

/** The stage the challenge is fought on: two past the furthest cleared, never below 3. */
export function challengeStage(m: MetaSave): number {
  return Math.min(BALANCE.meta.stageCount, Math.max(C.minStage, m.cleared + C.stageAhead));
}

export function todaysChallenge(m: MetaSave, today: string): Challenge {
  const rng = new Rng(hash(`challenge:${today}`));
  const mods = rng.sample(MODIFIER_IDS, C.modifiers);
  const trial = rng.pick(HERO_KINDS);
  return { day: today, seed: hash(`run:${today}`), stage: challengeStage(m), mods, trial: mods.includes('trial') ? trial : null };
}

/** The potions the challenge summons from: the player's lineup, with the trial potion in place
 *  of one of them, and cut down to three kinds (the trial one kept) under solo. */
export function challengeLineup(m: MetaSave, c: Challenge): HeroKind[] {
  const rng = new Rng(c.seed ^ 0x5eed);
  let lineup = [...m.lineup];
  if (c.trial && !lineup.includes(c.trial)) lineup[rng.int(lineup.length)] = c.trial;
  if (c.mods.includes('solo')) {
    const keep = c.trial ? [c.trial] : [];
    lineup = [...keep, ...rng.sample(lineup.filter((k) => !keep.includes(k)), C.mods.solo.kinds - keep.length)];
  }
  return HERO_KINDS.filter((k) => lineup.includes(k));
}

export function challengeSetup(m: MetaSave, c: Challenge): BattleSetup {
  const s = battleSetup(m, c.stage);
  const has = (id: ModifierId) => c.mods.includes(id);
  const X = C.mods;
  const bossWaves = has('twinBoss') ? [...new Set([...BALANCE.waves.bossWaves, ...X.twinBoss.waves])].sort((a, b) => a - b) : BALANCE.waves.bossWaves;
  const modifiers: BattleModifiers = {
    enemySpeed: has('swift') ? X.swift.speed : 1,
    summonCost: has('cheap') ? X.cheap.summon : 1,
    waveGold: has('cheap') ? X.cheap.waveGold : 1,
    killGold: has('goldRain') ? X.goldRain.killGold : 1,
    crit: has('critDay') ? X.critDay.crit : 0,
    bossWaves,
    banned: has('ironWall') ? ['wallRepair'] : [],
  };
  return {
    ...s,
    enemyHp: s.enemyHp * (has('critDay') ? X.critDay.hp : 1) * (has('swift') ? X.swift.hp : 1),
    wallHp: s.wallHp * (has('ironWall') ? X.ironWall.wall : 1),
    startGold: has('goldRain') ? X.goldRain.startGold : s.startGold,
    lineup: challengeLineup(m, c),
    modifiers,
  };
}

/** Attempts started today. */
export function attemptsUsed(m: MetaSave, today: string): number {
  return m.challenge.date === today ? m.challenge.attempts : 0;
}

/** The furthest wave reached today, 0 before the first attempt. */
export function bestToday(m: MetaSave, today: string): number {
  return m.challenge.date === today ? m.challenge.best : 0;
}

/** Today's challenge has not been tried yet. */
export function challengeFresh(m: MetaSave, today: string): boolean {
  return attemptsUsed(m, today) === 0;
}

/** The free attempt is still there. */
export function canPlayFree(m: MetaSave, today: string): boolean {
  return attemptsUsed(m, today) < C.attempts;
}

/** The free attempt is used and the one a rewarded ad buys is not. */
export function canPlayAd(m: MetaSave, today: string): boolean {
  const used = attemptsUsed(m, today);
  return used >= C.attempts && used < C.attempts + C.adAttempts;
}

/** Days in a row played, as it stands today: broken once a day was missed. */
export function streak(m: MetaSave, today: string): number {
  const s = m.challenge;
  return s.date === today || s.date === prevDay(today) ? s.streak : 0;
}

/** Starts an attempt (`ad`: the one a rewarded ad bought). The first of a day moves the streak
 *  on, and pays its bonus every seven days. Returns the bonus paid, or null when the attempt is
 *  not on offer. */
export function beginAttempt(m: MetaSave, today: string, ad: boolean): number | null {
  if (ad ? !canPlayAd(m, today) : !canPlayFree(m, today)) return null;
  const s = m.challenge;
  let bonus = 0;
  if (s.date !== today) {
    s.streak = s.date === prevDay(today) ? s.streak + 1 : 1;
    s.date = today;
    s.attempts = 0;
    s.best = 0;
    if (s.streak % C.streakDays === 0) bonus = C.streakReward;
  }
  s.attempts++;
  m.crystals += bonus;
  return bonus;
}

/** Tiers reached by a run that got to `wave`: 0 to 3. */
export function tierOf(wave: number): number {
  return C.tiers.filter((t) => wave >= t.wave).length;
}

/** What a day's best tier is worth in all. */
export function tierReward(tier: number): number {
  return tier > 0 ? C.tiers[tier - 1].reward : 0;
}

/** Books an attempt that reached `wave` into the day it was started on; pays what a better
 *  tier adds. */
export function bookAttempt(m: MetaSave, wave: number): ChallengeResult {
  const s = m.challenge;
  const before = tierOf(s.best);
  s.best = Math.max(s.best, wave);
  const bestTier = tierOf(s.best);
  const crystals = tierReward(bestTier) - tierReward(before);
  m.crystals += crystals;
  return { wave, best: s.best, tier: tierOf(wave), bestTier, crystals };
}

/** The reward tiers, for the screens. */
export const CHALLENGE_TIERS: readonly { wave: number; reward: number }[] = C.tiers;
export const STREAK_DAYS = C.streakDays;
export const STREAK_REWARD = C.streakReward;

/** Milliseconds from `now` to the next local midnight, when a new challenge is drawn. */
export function msToTomorrow(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
