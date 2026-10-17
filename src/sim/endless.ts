// Endless mode: opens once the first chapter is cleared. One fixed battlefield (the stage
// `endless.stage`, so best waves compare across saves) whose waves never run out: they keep
// growing until the wall falls. It pays a little for every wave reached, capped per run so a
// long run is no crystal farm, and a bigger sum the first time each milestone wave is reached.

import { battleSetup, workshopValue, type BattleSetup, type MetaSave } from './meta';
import { BALANCE } from './types';

const E = BALANCE.endless;

export interface EndlessSave {
  /** The furthest wave any endless run reached. */
  best: number;
  /** Milestones paid so far, in order: the first `paid` of `endless.milestones`. */
  paid: number;
  /** Endless runs started. */
  runs: number;
}

/** What one finished run booked. */
export interface EndlessResult {
  wave: number;
  /** The best wave before this run, and whether this run beat it. */
  before: number;
  record: boolean;
  /** Crystals the milestones this run reached first paid. */
  milestones: number;
}

export function newEndless(): EndlessSave {
  return { best: 0, paid: 0, runs: 0 };
}

/** Reads the stored endless part, dropping anything that does not fit. */
export function parseEndless(v: unknown): EndlessSave {
  const out = newEndless();
  if (!v || typeof v !== 'object') return out;
  const d = v as Record<string, unknown>;
  const n = (x: unknown, max: number) => Math.min(max, Math.max(0, Math.floor(Number(x)) || 0));
  out.best = n(d.best, 9999);
  out.paid = n(d.paid, E.milestones.length);
  out.runs = n(d.runs, Number.MAX_SAFE_INTEGER);
  return out;
}

/** Endless mode is open: the first chapter is cleared. */
export function endlessOpen(m: MetaSave): boolean {
  return m.cleared >= E.unlock;
}

/** The battle setup of an endless run: the player's potions and workshop on the endless stage,
 *  its enemies `endless.hpScale` as tough (the stage is a chapter finale, whose extra hit points
 *  are for the one stage battle, not for a run that keeps growing). */
export function endlessSetup(m: MetaSave): BattleSetup {
  const setup = battleSetup(m, E.stage);
  return { ...setup, enemyHp: setup.enemyHp * E.hpScale, endless: true };
}

/** Counts a run as started. */
export function beginEndless(m: MetaSave): void {
  m.endless.runs++;
}

/** Crystals for the waves a run reached, capped, with the workshop's crystal bonus: paid
 *  through the battle's purse like a stage's reward, so a revive pays only the rest. */
export function endlessPay(m: MetaSave, wave: number): number {
  const base = Math.min(E.runCap, E.perWave * wave);
  return Math.round(base * (1 + workshopValue('crystals', m.workshop.crystals)));
}

/** The milestones reached by `wave` (a count, into `endless.milestones`). */
export function milestonesOf(wave: number): number {
  return E.milestones.filter((s) => wave >= s.wave).length;
}

/** Books a run that reached `wave`: the best wave, and the milestones it reached for the first
 *  time, paid once each. A revived run booked again books only what it added. */
export function bookEndless(m: MetaSave, wave: number): EndlessResult {
  const s = m.endless;
  const before = s.best;
  s.best = Math.max(s.best, wave);
  const reached = milestonesOf(wave);
  let milestones = 0;
  for (let i = s.paid; i < reached; i++) milestones += E.milestones[i].reward;
  s.paid = Math.max(s.paid, reached);
  m.crystals += milestones;
  return { wave, before, record: wave > before, milestones };
}

/** The next milestone not paid yet, or null once all are. */
export function nextMilestone(m: MetaSave): { wave: number; reward: number } | null {
  return E.milestones[m.endless.paid] ?? null;
}

export const ENDLESS_MILESTONES: readonly { wave: number; reward: number }[] = E.milestones;
export const ENDLESS_UNLOCK = E.unlock;
