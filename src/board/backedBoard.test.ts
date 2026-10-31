// The host's boards shown, ours fed beside them (backedBoard.ts).

import { describe, expect, it } from 'vitest';
import { BackedBoard, backed } from './backedBoard';
import type { BoardPage, Leaderboard, Scores } from './types';

function stub(name: string, daily = true) {
  const got: unknown[] = [];
  const b: Leaderboard = {
    submit: (s: Scores) => void got.push(s),
    top: async (board) => ({ board, rows: [{ rank: 1, name, score: 1 }], me: null }) as BoardPage,
    ...(daily ? { daily: (w: number) => void got.push(w) } : {}),
  };
  return { b, got };
}

describe('BackedBoard', () => {
  it('sends every score to both and reads the shown one', async () => {
    const shown = stub('host');
    const backup = stub('ours');
    const b = new BackedBoard(shown.b, backup.b);
    b.submit({ endless: 4, stars: 9 });
    b.daily(7);
    expect(shown.got).toEqual([{ endless: 4, stars: 9 }, 7]);
    expect(backup.got).toEqual(shown.got);
    expect((await b.top('stars'))?.rows[0].name).toBe('host');
  });

  it('skips a daily the shown board has none for', () => {
    const backup = stub('ours');
    new BackedBoard(stub('host', false).b, backup.b).daily(3);
    expect(backup.got).toEqual([3]);
  });

  it('is both, either one alone, or none', () => {
    const a = stub('a').b;
    const b = stub('b').b;
    expect(backed(a, b)).toBeInstanceOf(BackedBoard);
    expect(backed(a, null)).toBe(a);
    expect(backed(null, b)).toBe(b);
    expect(backed(null, null)).toBeNull();
  });
});
