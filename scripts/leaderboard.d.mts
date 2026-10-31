// The collector's leaderboards (leaderboard.mjs), as its tests use them.

export const KEEP_MONTHS: number;
export const STAGES: number;
export const ENDLESS_UNLOCK: number;
export const ENDLESS_MAX: number;
export const MAX_ENTRIES: number;
export const MAX_ROWS: number;
export const MAX_POST: number;
export const BOARDS: readonly ('endless' | 'stars')[];

export type BoardId = 'endless' | 'stars';

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
}

export function tagOf(id: string): string;
export function scoresOf(saveText: string): { endless: number; stars: number } | null;
export function cleanPost(body: unknown): { id: string; token: string } | null;
export function boardQuery(url: string): { board: BoardId; n: number; me: string | null } | null;

/** One ranked player as a board file keeps them. */
export interface BoardEntry {
  id: string;
  score: number;
  reached: number;
  at: number;
}

export class Leaderboards {
  boards: Record<BoardId, BoardEntry[]>;
  constructor(dir: string, log?: (line: string) => void);
  post(id: string, save: string, now: number): 'posted' | 'implausible';
  top(board: BoardId, n: number, me?: string | null): BoardPage;
  prune(now: number): number;
}
