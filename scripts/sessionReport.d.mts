// Types for sessionReport.mjs, for the tests.

export interface SessionStats {
  ended: number;
  endedMedian: number | null;
  beating: number;
  visMedian: number | null;
  visMean: number | null;
  died: [string, number][];
}

type Event = { name: string; ts: number; uid?: string; sid?: string; props?: Record<string, unknown>; [k: string]: unknown };

export function sessionStats(events: Event[]): SessionStats;
export function printSessions(st: SessionStats, log?: (line: string) => void): void;
