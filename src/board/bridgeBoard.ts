// Playgama's leaderboards through Bridge (platform/playgama/bridge.ts), there only where Bridge
// says the game draws them itself (`in_game`: its SaaS leaderboards, set up in the Playgama
// dashboard with the ids 'endless', 'stars' and 'daily_challenge'). Bridge ranks the numbers it is given.

import type { PlaygamaBridge } from '../platform/playgama/bridge';
import type { BoardId, BoardPage, BoardRow, Leaderboard, Scores } from './types';
import { SCORE_IDS } from './types';

/** The daily challenge's board, which the home screen does not show (Bridge ranks it itself). */
export const DAILY = 'daily_challenge';

/** Rows shown. */
export const ROWS = 10;

export class BridgeBoard implements Leaderboard {
  private readonly sent: Scores = { endless: 0, stars: 0 };

  constructor(private readonly bridge: Pick<PlaygamaBridge, 'setScore' | 'entries' | 'accountId'>) {}

  submit(scores: Scores): void {
    for (const board of SCORE_IDS) {
      if (scores[board] <= this.sent[board]) continue;
      this.sent[board] = scores[board];
      this.bridge.setScore(board, scores[board]);
    }
  }

  daily(wave: number): void {
    if (Number.isFinite(wave) && wave >= 1) this.bridge.setScore(DAILY, Math.floor(wave));
  }

  async top(board: BoardId): Promise<BoardPage | null> {
    if (board === 'weekly') return null;
    const entries = await this.bridge.entries(board);
    if (!entries) return null;
    const me = this.bridge.accountId();
    const all: BoardRow[] = [...entries].sort((a, b) => a.rank - b.rank).map((e) => ({ rank: e.rank, name: e.name || '—', score: e.score, ...(me && e.id === me ? { me: true } : {}) }));
    return { board, rows: all.slice(0, ROWS), me: all.find((r) => r.me) ?? null };
  }
}

/** Bridge's boards where the game draws them, else none. */
export const bridgeBoard = (bridge: PlaygamaBridge): BridgeBoard | null => (bridge.boardsInGame() ? new BridgeBoard(bridge) : null);
