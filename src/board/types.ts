// The leaderboards the home screen shows: our server's on the web, CrazyGames and iOS
// (serverBoard.ts, scripts/leaderboard.mjs), Playgama's through Bridge where its SaaS boards are set
// up (bridgeBoard.ts), none elsewhere. Two boards: endless's best wave and the total stars.

export type BoardId = 'endless' | 'stars';
export const BOARD_IDS: readonly BoardId[] = ['endless', 'stars'];

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

export type Scores = Record<BoardId, number>;

export interface Leaderboard {
  /** Puts this player's scores on the boards (after a battle, at boot); never throws. */
  submit(scores: Scores): void;
  /** The top rows of `board` and this player's own; null when they cannot be had (offline). */
  top(board: BoardId): Promise<BoardPage | null>;
}
