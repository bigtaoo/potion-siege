// A host's own boards shown, with our server's beside them as the record of every score (Playgama:
// Bridge's boards hold its own players only; ours keep all hosts', for a backup and for analysis).

import type { BoardId, BoardPage, Leaderboard, Scores } from './types';

export class BackedBoard implements Leaderboard {
  constructor(
    private readonly shown: Leaderboard,
    private readonly backup: Leaderboard,
  ) {}

  submit(scores: Scores): void {
    this.shown.submit(scores);
    this.backup.submit(scores);
  }

  top(board: BoardId): Promise<BoardPage | null> {
    return this.shown.top(board);
  }

  daily(wave: number): void {
    this.shown.daily?.(wave);
    this.backup.daily?.(wave);
  }
}

/** `shown` backed by `backup` when there are both; else whichever there is; else none. A backup
 *  alone is shown, so the boards stay where the host's are missing. */
export const backed = (shown: Leaderboard | null, backup: Leaderboard | null): Leaderboard | null =>
  shown && backup ? new BackedBoard(shown, backup) : (shown ?? backup);
