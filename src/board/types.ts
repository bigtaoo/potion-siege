// The leaderboards the home screen shows: our server's on the web, CrazyGames and iOS
// (serverBoard.ts, scripts/leaderboard.mjs), Playgama's through Bridge where its SaaS boards are set
// up (bridgeBoard.ts), with every score sent to ours there too (backedBoard.ts). Two boards shown:
// endless's best wave and the total stars; the daily challenge's wave goes to the boards that rank it.

/** The boards a save's standing scores go to. */
export type ScoreId = 'endless' | 'stars';
export const SCORE_IDS: readonly ScoreId[] = ['endless', 'stars'];
/** The boards the panel shows: the standing ones and this week's tower (ours only; sim/week.ts). */
export type BoardId = ScoreId | 'weekly';
export const BOARD_IDS: readonly BoardId[] = ['endless', 'stars', 'weekly'];

export interface BoardRow {
  rank: number;
  /** The name the board shows: the portal's name, or a short tag hashed from the save copy's id. */
  name: string;
  score: number;
  /** This player's own row. */
  me?: boolean;
}

export interface BoardPage {
  board: BoardId;
  rows: BoardRow[];
  /** This player's row, also when it is past the top rows; null when they are not on the board. */
  me: BoardRow | null;
}

export type Scores = Record<ScoreId, number>;

export interface Leaderboard {
  /** Puts this player's scores on the boards (after a battle, at boot); never throws. */
  submit(scores: Scores): void;
  /** The top rows of `board` and this player's own; null when they cannot be had (offline). */
  top(board: BoardId): Promise<BoardPage | null>;
  /** The wave a daily challenge run reached, for the boards that rank it ('daily_challenge' on
   *  Playgama's and on ours). Never throws. */
  daily?(wave: number): void;
  /** A new best tower floor this week, for the weekly board (ours only). Never throws. */
  weekly?(floor: number): void;
}
