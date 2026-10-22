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

export function deviceOf(props: Record<string, unknown>): 'desktop' | 'touch';
export const ALIVE_EVERY: number;
export interface SessionSpan {
  uid: string;
  first: number;
  last: number;
  secs: number;
  vis: number | null;
  beat: number | null;
  ended: boolean;
}
export function sessionSpans(events: Event[], keep?: (e: Event) => boolean): Map<string, SessionSpan>;
export function sessionSecs(s: { first: number; last: number; secs: number; vis?: number | null; beat?: number | null }): number;
export interface Run {
  uid: string;
  sid: string;
  run: number;
  stage: number | null;
  cause: string | null;
  start: number;
  last: number;
  lastWave: number;
  final: Record<string, unknown> | null;
}
export function runsOf(events: Event[], keep?: (e: Event) => boolean): Map<string, Run>;
export function battleSecs(r: Run): number;
export function playtestRows(events: Event[]): PlaytestRow[];
export function printPlaytest(rows: PlaytestRow[], log?: (line: string) => void): void;
export function feedbackLines(events: Event[]): string[];
