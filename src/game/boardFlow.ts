// The leaderboards on the home screen: the scores go up each time the home screen comes up (the
// host's board drops the ones it already has), and the panel's page is fetched when it opens or
// its board is switched, then drawn again if the panel is still open.

import type { Game } from '../app';
import type { BoardId, Scores } from '../board/types';
import type { MetaSave } from '../sim/meta';
import { totalStars } from '../sim/stars';
import type { BoardView } from '../view/home/types';

interface BoardState {
  tab: BoardId;
  page: BoardView['page'];
  /** The fetch whose answer counts; an older one's is dropped. */
  ask: number;
}

const states = new WeakMap<Game, BoardState>();

function stateOf(g: Game): BoardState {
  let s = states.get(g);
  if (!s) states.set(g, (s = { tab: 'endless', page: 'loading', ask: 0 }));
  return s;
}

/** What a save puts on the boards. */
export const scoresOf = (m: MetaSave): Scores => ({ endless: m.endless.best, stars: totalStars(m) });

/** Puts this save's scores on the host's boards, where it has them. */
export function submitScores(g: Game): void {
  g.platform.leaderboard?.submit(scoresOf(g.save));
}

/** Fetches `tab`'s page and, once it is in, draws the panel again with `redraw` if it is still open. */
export function fetchBoard(g: Game, tab: BoardId, redraw: () => void): void {
  const board = g.platform.leaderboard;
  if (!board) return;
  const s = stateOf(g);
  s.tab = tab;
  s.page = 'loading';
  const ask = ++s.ask;
  void board.top(tab).then(
    (page) => {
      if (ask !== s.ask) return;
      s.page = page ?? 'offline';
      if (g.menu.visible && g.panel === 'board') redraw();
    },
    () => {
      if (ask !== s.ask) return;
      s.page = 'offline';
      if (g.menu.visible && g.panel === 'board') redraw();
    },
  );
}

/** What the panel shows, where the host has leaderboards. */
export function boardView(g: Game): BoardView | undefined {
  if (!g.platform.leaderboard) return undefined;
  const s = stateOf(g);
  return { tab: s.tab, page: s.page };
}
