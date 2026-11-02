// Types for guideReport.mjs, for the tests.

export interface GuideRow {
  id: string;
  players: number;
  done: number;
  skipped: number;
  other: number;
  none: number;
  medianWait: number | null;
}

type Event = { name: string; ts: number; uid?: string; sid?: string; props?: Record<string, unknown>; [k: string]: unknown };

export const GUIDE_ORDER: string[];
export function guideRows(events: Event[]): GuideRow[];
export function printGuide(rows: GuideRow[], log?: (line: string) => void): void;
