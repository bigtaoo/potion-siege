// Types for countryReport.mjs, for the tests.

export interface CountryRow {
  country: string;
  loads: number;
  players: number;
  fresh: number;
  sessions: number;
  minute: number;
  wins: number;
}

type Event = { name: string; ts: number; uid?: string; sid?: string; props?: Record<string, unknown>; [k: string]: unknown };

export function countryRows(events: Event[]): CountryRow[];
export function printCountries(rows: CountryRow[], log?: (line: string) => void): void;
