// The daily hooks: a seven-day login reward and three tasks a day, both paid in crystals.
// Days are local calendar dates ('2026-10-15'), passed in so the rules stay testable. A missed
// day does not reset the login streak; the next claim simply gives the next day's reward.

import type { MetaSave } from './meta';
import { Rng } from './rng';
import { BALANCE } from './types';

const D = BALANCE.daily;

export type TaskId = keyof typeof D.tasks;
export const TASK_IDS = Object.keys(D.tasks) as TaskId[];

export interface DailyTask {
  id: TaskId;
  progress: number;
  claimed: boolean;
}

export interface DailySave {
  /** The day the tasks were rolled for. */
  day: string;
  tasks: DailyTask[];
  /** Login rewards claimed so far, all time; the next one is day `claims % 7 + 1`. */
  claims: number;
  /** The day of the last login claim. */
  lastClaim: string;
  /** Today's bonus for claiming all three tasks was paid. */
  bonus: boolean;
}

/** The local calendar date of `now`. */
export function dayOf(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function newDaily(): DailySave {
  return { day: '', tasks: [], claims: 0, lastClaim: '', bonus: false };
}

/** Reads the stored daily part, dropping anything that does not fit. */
export function parseDaily(v: unknown): DailySave {
  const out = newDaily();
  if (!v || typeof v !== 'object') return out;
  const d = v as Record<string, unknown>;
  if (typeof d.day === 'string') out.day = d.day;
  if (typeof d.lastClaim === 'string') out.lastClaim = d.lastClaim;
  out.claims = Math.max(0, Math.floor(Number(d.claims)) || 0);
  out.bonus = d.bonus === true;
  if (Array.isArray(d.tasks)) {
    for (const t of d.tasks as Record<string, unknown>[]) {
      if (!t || !TASK_IDS.includes(t.id as TaskId)) continue;
      out.tasks.push({ id: t.id as TaskId, progress: Math.max(0, Math.floor(Number(t.progress)) || 0), claimed: t.claimed === true });
    }
  }
  return out;
}

/** A day string (or any string) as a seed. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** On a new day, rolls that day's tasks (the same for everyone on that date). */
export function rollDay(m: MetaSave, today: string): void {
  if (m.daily.day === today) return;
  m.daily.day = today;
  m.daily.bonus = false;
  m.daily.tasks = new Rng(hash(today)).sample(TASK_IDS, D.taskCount).map((id) => ({ id, progress: 0, claimed: false }));
}

export function taskGoal(id: TaskId): number {
  return D.tasks[id].n;
}

export function taskReward(id: TaskId): number {
  return D.tasks[id].reward;
}

export function addProgress(m: MetaSave, id: TaskId, n = 1): void {
  for (const t of m.daily.tasks) if (t.id === id) t.progress = Math.min(taskGoal(id), t.progress + n);
}

export function taskDone(t: DailyTask): boolean {
  return t.progress >= taskGoal(t.id);
}

export function claimTask(m: MetaSave, index: number): number {
  const t = m.daily.tasks[index];
  if (!t || t.claimed || !taskDone(t)) return 0;
  t.claimed = true;
  m.crystals += taskReward(t.id);
  return taskReward(t.id);
}

/** 0-based day of the seven-day login track the next claim pays. */
export function loginDay(m: MetaSave): number {
  return m.daily.claims % D.login.length;
}

export function loginReward(day: number): number {
  return D.login[day];
}

export function canClaimLogin(m: MetaSave, today: string): boolean {
  return m.daily.lastClaim !== today;
}

export function claimLogin(m: MetaSave, today: string): number {
  if (!canClaimLogin(m, today)) return 0;
  const reward = loginReward(loginDay(m));
  m.crystals += reward;
  m.daily.claims++;
  m.daily.lastClaim = today;
  return reward;
}

/** Crystals for claiming all of today's tasks. */
export const ALL_DONE_BONUS = D.allDone;

/** Every task of today is claimed and the bonus for it is not yet. */
export function bonusReady(m: MetaSave): boolean {
  return !m.daily.bonus && m.daily.tasks.length > 0 && m.daily.tasks.every((t) => t.claimed);
}

export function claimBonus(m: MetaSave): number {
  if (!bonusReady(m)) return 0;
  m.daily.bonus = true;
  m.crystals += D.allDone;
  return D.allDone;
}

/** Something on the tasks panel waits to be claimed. */
export function tasksClaimable(m: MetaSave): boolean {
  return m.daily.tasks.some((t) => !t.claimed && taskDone(t)) || bonusReady(m);
}
