// Types for dailyScorecard.mjs, for the tests.

import type { DayScore } from './cgBenchmarks.mjs';

export const NOISY_OPENS: number;
export const WINDOW_DAYS: number;
export function dayOf(ts: number): string;

export interface DailyRow {
  label: string;
  device: 'desktop' | 'touch';
  opens: number;
  newPlayers: number;
  converted: number;
  d1Back: number;
  d1Eligible: number;
  d1Waiting: number;
  plays: number;
  builds: { build: string; n: number }[];
  noisy: boolean;
  conversion: number | null;
  playtime: number | null;
  d1: number | null;
  score: DayScore;
  actionScore: DayScore;
  partial?: boolean;
}
export interface Daily {
  days: DailyRow[];
  window: DailyRow[] | null;
  newestDay: string | null;
  opens: number;
}

type Event = { name: string; ts: number; [k: string]: unknown };

export function dailyRows(events: Event[], filter?: { host?: string; src?: string }, category?: string): Daily;
export function printDaily(result: Daily, title: string, log?: (line: string) => void, category?: string): void;
