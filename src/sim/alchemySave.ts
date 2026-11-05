// The save's part for the long-term features (ref/design/long-term-plan.md): the brewing rack's
// clock, today's replays of the latest stage, the losses in a row on one stage. A save from
// before them starts each one fresh.

import { int } from './parse';
import { newRebrew, parseRebrew, type RebrewSave } from './rebrew';
import { parseTalents, type TalentPicks } from './talents';
import { newWeek, parseWeek, type WeekSave } from './week';

export interface AlchemySave {
  /** When the brewing rack was last emptied, ms since the epoch; 0 until it is set up (rack.ts). */
  rack: number;
  /** Battles on the latest stage cleared on `day` (replayPay.ts). */
  replay: { day: string; stage: number; n: number };
  /** Losses in a row on `stage`, normal mode (stuck.ts). */
  stuck: { stage: number; n: number };
  /** Each potion's talent picks, Lv 10, 20, 30 (talents.ts). */
  talents: TalentPicks;
  /** Rebrews, essence and its perks (rebrew.ts). */
  rebrew: RebrewSave;
  /** This week's tower best, reactions and tasks (week.ts). */
  week: WeekSave;
}

export function newAlchemy(): AlchemySave {
  return { rack: 0, replay: { day: '', stage: 0, n: 0 }, stuck: { stage: 0, n: 0 }, talents: {}, rebrew: newRebrew(), week: newWeek() };
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

export function parseAlchemy(raw: unknown): AlchemySave {
  const d = obj(raw);
  const out = newAlchemy();
  out.rack = int(d.rack, 0, Number.MAX_SAFE_INTEGER, 0);
  const r = obj(d.replay);
  out.replay = { day: typeof r.day === 'string' ? r.day.slice(0, 10) : '', stage: int(r.stage, 0, 999, 0), n: int(r.n, 0, 9999, 0) };
  const s = obj(d.stuck);
  out.stuck = { stage: int(s.stage, 0, 999, 0), n: int(s.n, 0, 999, 0) };
  out.talents = parseTalents(d.talents);
  out.rebrew = parseRebrew(d.rebrew);
  out.week = parseWeek(d.week);
  return out;
}
