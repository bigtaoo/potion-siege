// Types for playtestMetrics.mjs, for the tests.

export const CG: { convDesktop: number; convTouch: number; playMinutes: number };
export const CONVERT_SECS: number;

export interface PlaytestRow {
  build: string;
  src: string;
  device: 'desktop' | 'touch';
  players: number;
  opens: number;
  loaded: number;
  converted: number;
  conversion: number | null;
  playMinutes: number | null;
  d1: { back: number; eligible: number };
  tutorial: number;
  run1End: number;
  run2Start: number;
  run3Start: number;
  run3End: number;
  stageMedian: number | null;
  stageMax: number | null;
  runs: number;
  quits: number;
  quitAt: [string, number][];
  feedback: { n: number; mean: number | null; skipped: number };
}

type Event = { name: string; ts: number; uid?: string; sid?: string; session?: number; day?: number; build?: string; src?: string; props?: Record<string, unknown>; [k: string]: unknown };

export function playtestRows(events: Event[]): PlaytestRow[];
export function printPlaytest(rows: PlaytestRow[], log?: (line: string) => void): void;
export function feedbackLines(events: Event[]): string[];
