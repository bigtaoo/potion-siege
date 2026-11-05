// The week (plan 5c and 6): every week the tower climbs under one rule that bends the reactions,
// the same for everyone (its own board ranks the week's furthest floor), and four weekly tasks
// pay crystals. A week is named by its Monday ('2026-11-02'); days come in as gameDay does
// them, so a clock turned back never opens a week twice.

import type { BattleSetup, MetaSave } from './meta';
import { hash, Rng } from './rng';
import { BALANCE, REACTION_IDS, type ReactionId } from './types';

const W = BALANCE.alchemy.week;

export type WeekRuleId = keyof typeof W.rules;
export const WEEK_RULES = Object.keys(W.rules) as WeekRuleId[];
export type WeekTaskId = keyof typeof W.tasks;
export const WEEK_TASKS = Object.keys(W.tasks) as WeekTaskId[];

export interface WeekSave {
  /** The Monday of the week the rest is for; '' before the first. */
  id: string;
  /** The furthest tower floor this week. */
  best: number;
  /** Reactions set off this week, and the kinds among them. */
  reactions: number;
  kinds: ReactionId[];
  /** Daily challenges played this week. */
  challenges: number;
  claimed: WeekTaskId[];
}

export interface WeekRule {
  id: WeekRuleId;
  /** The reaction `focus` favours (every rule names one, for the panel's picture). */
  reaction: ReactionId;
}

export function newWeek(): WeekSave {
  return { id: '', best: 0, reactions: 0, kinds: [], challenges: 0, claimed: [] };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const n = (v: unknown) => (Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : 0);

export function parseWeek(raw: unknown): WeekSave {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = newWeek();
  if (typeof d.id === 'string' && DAY.test(d.id)) out.id = d.id;
  out.best = Math.min(999, n(d.best));
  out.reactions = n(d.reactions);
  out.challenges = Math.min(7, n(d.challenges));
  if (Array.isArray(d.kinds)) out.kinds = REACTION_IDS.filter((id) => (d.kinds as unknown[]).includes(id));
  if (Array.isArray(d.claimed)) out.claimed = WEEK_TASKS.filter((id) => (d.claimed as unknown[]).includes(id));
  return out;
}

/** Days since 1970-01-01 of a civil date (Howard Hinnant's days_from_civil), so no Date is needed. */
export function civilDays(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The civil date `days` after 1970-01-01, as 'YYYY-MM-DD'. */
export function civilDate(days: number): string {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${String(y).padStart(4, '0')}-${p(m)}-${p(d)}`;
}

/** 0 on Monday to 6 on Sunday (1970-01-01 was a Thursday). */
function weekday(days: number): number {
  return (((days + 3) % 7) + 7) % 7;
}

const daysOf = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return civilDays(y!, m!, d!);
};

/** The Monday of the week `day` falls in. */
export function weekOf(day: string): string {
  const at = daysOf(day);
  return civilDate(at - weekday(at));
}

/** Days from `day` to the next Monday, 1 to 7. */
export function daysLeft(day: string): number {
  return 7 - weekday(daysOf(day));
}

/** The week's rule: the same for every player in that week. */
export function weekRule(week: string): WeekRule {
  const rng = new Rng(hash(`week:${week}`));
  return { id: rng.pick(WEEK_RULES), reaction: rng.pick(REACTION_IDS) };
}

/** The furthest floor of `day`'s week: the save's best while its week is that one, else none
 *  yet (the save rolls on with the next day roll or climb). */
export function weekBest(m: MetaSave, day: string): number {
  return m.alchemy.week.id === weekOf(day) ? m.alchemy.week.best : 0;
}

/** Starts the save on the week of `day` when it is a later one. */
export function rollWeek(m: MetaSave, day: string): void {
  const id = weekOf(day);
  if (!(id > m.alchemy.week.id)) return;
  m.alchemy.week = { ...newWeek(), id };
}

/** The tower's setup under the week's rule. */
export function weekSetup(s: BattleSetup, rule: WeekRule): BattleSetup {
  const r = W.rules[rule.id] as { power: number; hp?: number; damage?: number; wall?: number };
  const out: BattleSetup = { ...s, enemyHp: s.enemyHp * (r.hp ?? 1), wallHp: s.wallHp * (r.wall ?? 1) };
  if (rule.id === 'focus') out.focus = { id: rule.reaction, power: r.power };
  else out.reactionScale = (s.reactionScale ?? 1) * r.power;
  if (r.damage) {
    out.heroDamage = { ...s.heroDamage };
    for (const k of Object.keys(out.heroDamage) as (keyof typeof out.heroDamage)[]) out.heroDamage[k] *= r.damage;
  }
  return out;
}

/** A tower run that reached `wave` this week: true on a new best of the week. */
export function bookWeekFloor(m: MetaSave, wave: number, week = m.alchemy.week.id): boolean {
  const w = m.alchemy.week;
  // a climb begun under last week's rule ending in this week counts for neither
  if (week !== w.id || wave <= w.best) return false;
  w.best = wave;
  return true;
}

/** Reactions set off in a live battle. */
export function countWeekReaction(m: MetaSave, id: ReactionId): void {
  const w = m.alchemy.week;
  w.reactions++;
  if (!w.kinds.includes(id)) w.kinds.push(id);
}

export function weekGoal(id: WeekTaskId): number {
  return W.tasks[id].n;
}

export function weekReward(id: WeekTaskId): number {
  return W.tasks[id].reward;
}

export function weekProgress(m: MetaSave, id: WeekTaskId): number {
  const w = m.alchemy.week;
  const v = id === 'kinds' ? w.kinds.length : id === 'react' ? w.reactions : id === 'tower' ? w.best : w.challenges;
  return Math.min(weekGoal(id), v);
}

export function weekTaskDone(m: MetaSave, id: WeekTaskId): boolean {
  return weekProgress(m, id) >= weekGoal(id);
}

/** The weekly tasks on offer: the tower one only once the tower is open. */
export function weekTasks(towerOpen: boolean): WeekTaskId[] {
  return WEEK_TASKS.filter((id) => id !== 'tower' || towerOpen);
}

export function claimWeekTask(m: MetaSave, id: WeekTaskId): number {
  const w = m.alchemy.week;
  if (w.claimed.includes(id) || !weekTaskDone(m, id)) return 0;
  w.claimed.push(id);
  m.crystals += weekReward(id);
  return weekReward(id);
}

export function weekClaimable(m: MetaSave, towerOpen: boolean): boolean {
  return weekTasks(towerOpen).some((id) => !m.alchemy.week.claimed.includes(id) && weekTaskDone(m, id));
}
