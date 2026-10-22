// Types for buildCompare.mjs, for the tests.

export interface CompareRow {
  build: string;
  device: 'desktop' | 'touch';
  players: number;
  launches: number;
  converted: number;
  playMinutes: number;
  run2: number;
  noEnd: number;
  noEndAt: string[];
  stalls: number;
  errors: number;
}

type Event = { name: string; ts: number; uid?: string; sid?: string; session?: number; build?: string; platform?: string; props?: Record<string, unknown>; [k: string]: unknown };

export function newestBuilds(events: Event[], host: string): { build: string; since: number }[];
export function compareBuilds(events: Event[], host: string, hours?: number | null): { builds: { build: string; since: number }[]; hours: number; rows: CompareRow[] };
export function printCompare(host: string, cmp: ReturnType<typeof compareBuilds>, log?: (line: string) => void): void;
