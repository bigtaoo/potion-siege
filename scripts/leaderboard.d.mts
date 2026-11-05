// The collector's leaderboards (leaderboard.mjs), as its tests use them.

export const KEEP_MONTHS: number;
export const STAGES: number;
export const ENDLESS_UNLOCK: number;
export const ENDLESS_MAX: number;
export const MAX_ENTRIES: number;
export const MAX_ROWS: number;
export const MAX_POST: number;
export const BOARDS: readonly ('endless' | 'stars' | 'daily_challenge' | 'weekly')[];

export type BoardId = 'endless' | 'stars' | 'daily_challenge' | 'weekly';

/** One row of a board as GET /l hands it out. */
export interface BoardRow {
  rank: number;
  tag: string;
  score: number;
  me?: boolean;
}

export interface BoardPage {
  board: BoardId;
  total: number;
  rows: BoardRow[];
  me: BoardRow | null;
  /** The day (or the week's Monday) the daily or weekly board was read for. */
  day?: string;
}

export interface BoardQuery {
  board: BoardId;
  n: number;
  me: string | null;
  platform: string | null;
  day: string | null;
}

export function tagOf(id: string): string;
export function scoresOf(saveText: string): { endless: number; stars: number; daily_challenge: number; weekly: number; days: { daily_challenge: string; weekly: string } } | null;
export function cleanPost(body: unknown): { id: string; token: string; platform: string } | null;
export function boardQuery(url: string): BoardQuery | null;

/** One ranked player as a board file keeps them. */
export interface BoardEntry {
  id: string;
  score: number;
  reached: number;
  at: number;
  platform?: string;
  day?: string;
}

export class Leaderboards {
  boards: Record<BoardId, BoardEntry[]>;
  constructor(dir: string, log?: (line: string) => void);
  post(id: string, save: string, now: number, platform?: string): 'posted' | 'implausible';
  top(board: BoardId, n: number, me?: string | null, only?: { platform?: string | null; day?: string | null }): BoardPage;
  prune(now: number): number;
}
