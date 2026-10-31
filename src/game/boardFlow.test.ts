// The leaderboards on the home screen (boardFlow.ts, view/home/boardPanel.ts): the real game over a
// host with a stand-in board, the scores sent on the way home, the panel opened from the top bar,
// its boards switched, and the page drawn as it comes in, or where it is at.
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BoardId, BoardPage, Leaderboard, Scores } from '../board/types';
import { t } from '../i18n';
import { gameDay } from '../sim/daily';
import { totalStars } from '../sim/stars';
import { scoreText, trophyIcon } from '../view/home/boardPanel';
import { scoresOf } from './boardFlow';
import { home } from './homeScreen';
import { buttons, englishPage, flush, tap, texts, veteran, world } from './testWorld';

beforeAll(englishPage);

/** A board whose pages a test answers by hand, in any order. */
function stand() {
  const asks: { board: BoardId; answer: (p: BoardPage | null | Error) => void }[] = [];
  const board: Leaderboard & { sent: Scores[] } = {
    sent: [],
    submit: (s) => void board.sent.push(s),
    top: (b) =>
      new Promise((ok, fail) => asks.push({ board: b, answer: (p) => (p instanceof Error ? fail(p) : ok(p)) })),
  };
  return { board, asks };
}

/** A veteran on the shop tab (the battle tab has its own Endless button), the login put away. */
function at(board: Leaderboard | null) {
  const m = veteran();
  m.daily.lastClaim = gameDay(m, new Date());
  m.endless.best = 17;
  m.stars.normal.fill(2, 0, 19);
  const w = world(m, (h) => Object.assign(h, { leaderboard: board }));
  w.game['tab'] = 'shop';
  home(w.game);
  return w;
}

const page = (board: BoardId, n: number, me?: number): BoardPage => {
  const rows = Array.from({ length: n }, (_, i) => ({ rank: i + 1, name: `P${i}`, score: 40 - i, ...(i === me ? { me: true } : {}) }));
  return { board, rows, me: rows.find((r) => r.me) ?? null };
};

describe('the leaderboards on the home screen', () => {
  it("send the save's endless best and stars on the way home", () => {
    const { board } = stand();
    const w = at(board);
    expect(board.sent).toEqual([{ endless: 17, stars: 38 }]);
    expect(scoresOf(w.game.save)).toEqual({ endless: 17, stars: totalStars(w.game.save) });
  });

  it('have no medal where the host has no board', () => {
    const w = at(null);
    expect(buttons(w.stage, t('board.button'))).toEqual([]);
    home(w.game, 'board');
    expect(texts(w.stage)).toContain(t('board.offline'));
  });

  it('open on the endless board, loading, then draw its rows with the own one in green', async () => {
    const { board, asks } = stand();
    const w = at(board);
    tap(w.stage, t('board.button'));
    expect(w.game['panel']).toBe('board');
    expect(texts(w.stage)).toContain(t('board.loading'));
    expect(asks.map((a) => a.board)).toEqual(['endless']);
    asks[0].answer(page('endless', 10, 2));
    await flush();
    const shown = texts(w.stage);
    expect(shown).toEqual(expect.arrayContaining(['P0', 'P9', scoreText('endless', 40), t('board.note')]));
    expect(shown).not.toContain(t('board.loading'));
    expect(shown).not.toContain('···');
  });

  it('show the own row below a gap when it is past the top rows', async () => {
    const { board, asks } = stand();
    const w = at(board);
    tap(w.stage, t('board.button'));
    asks[0].answer({ ...page('endless', 10), me: { rank: 57, name: 'ME0001', score: 3, me: true } });
    await flush();
    expect(texts(w.stage)).toEqual(expect.arrayContaining(['···', '57', 'ME0001', scoreText('endless', 3)]));
  });

  it('switch to the stars board, dropping a page that comes in late', async () => {
    const { board, asks } = stand();
    const w = at(board);
    tap(w.stage, t('board.button'));
    tap(w.stage, t('board.stars'));
    expect(asks.map((a) => a.board)).toEqual(['endless', 'stars']);
    asks[1].answer(page('stars', 1, 0));
    await flush();
    asks[0].answer(page('endless', 3));
    await flush();
    expect(texts(w.stage)).toContain(scoreText('stars', 40));
    expect(texts(w.stage)).not.toContain('P2');
    // opened again, it keeps the board picked
    home(w.game);
    tap(w.stage, t('board.button'));
    expect(asks[2].board).toBe('stars');
  });

  it('say when the board is empty or cannot be reached', async () => {
    const { board, asks } = stand();
    const w = at(board);
    tap(w.stage, t('board.button'));
    asks[0].answer(page('endless', 0));
    await flush();
    expect(texts(w.stage)).toContain(t('board.empty'));
    tap(w.stage, t('board.stars'));
    asks[1].answer(null);
    await flush();
    expect(texts(w.stage)).toContain(t('board.offline'));
    tap(w.stage, t('board.endless'));
    asks[2].answer(new Error('offline'));
    await flush();
    expect(texts(w.stage)).toContain(t('board.offline'));
  });

  it('leave the page alone when the answer comes after the panel closed', async () => {
    const { board, asks } = stand();
    const w = at(board);
    tap(w.stage, t('board.button'));
    home(w.game, null);
    const before = w.game['menu'].children[0];
    asks[0].answer(page('endless', 2));
    await flush();
    expect(w.game['menu'].children[0]).toBe(before);
    const failed = stand();
    const w2 = at(failed.board);
    tap(w2.stage, t('board.button'));
    home(w2.game, null);
    const kept = w2.game['menu'].children[0];
    failed.asks[0].answer(new Error('offline'));
    await flush();
    expect(w2.game['menu'].children[0]).toBe(kept);
  });

  it('draw a cup for the medal and words for the scores', () => {
    expect(trophyIcon().bounds.width).toBeGreaterThan(40);
    expect([scoreText('endless', 12), scoreText('stars', 1)]).toEqual([t('board.wave', { n: 12 }), t('board.starCount', { n: 1 })]);
  });
});
