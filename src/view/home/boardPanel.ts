// The leaderboards as a panel over the home screen: the endless and stars boards, the top rows
// and the player's own (board/types.ts; Bridge on Playgama, the collector elsewhere).

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import type { BoardId, BoardRow } from '../../board/types';
import { BOARD_IDS } from '../../board/types';
import { fit as fitText, ink, LIGHT, lightTile, P, PillButton } from '../kit';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import type { BoardView, HomeActions } from './types';

const ROW_H = 66;

/** The top bar's leaderboards medal: a brass cup on a stand. */
export function trophyIcon(): Graphics {
  return new Graphics()
    .moveTo(-30, -36)
    .lineTo(30, -36)
    .lineTo(24, -6)
    .quadraticCurveTo(0, 14, -24, -6)
    .closePath()
    .fill(P.brass)
    .stroke({ width: 5, color: P.line })
    .roundRect(-6, 4, 12, 18, 3)
    .fill(P.brassDark)
    .stroke({ width: 4, color: P.line })
    .roundRect(-24, 22, 48, 14, 5)
    .fill(P.wood)
    .stroke({ width: 4, color: P.line })
    .rect(-14, -28, 8, 18)
    .fill(P.brassLight);
}

/** A row's score in words: the endless wave, or the stars. */
export function scoreText(board: BoardId, score: number): string {
  return board === 'endless' ? t('board.wave', { n: score }) : t('board.starCount', { n: score });
}

function row(board: BoardId, r: BoardRow, y: number): Container {
  const c = new Container();
  c.y = y;
  const tile = r.me
    ? new Graphics().roundRect(-420, -ROW_H / 2 + 4, 840, ROW_H - 8, 18).fill(0xd4eec0).stroke({ width: 4, color: P.greenOn })
    : lightTile(840, ROW_H - 8, 18);
  const rank = ink(`${r.rank}`, 36, { fontWeight: '900', fill: r.rank <= 3 ? P.brassDark : P.ink });
  rank.anchor.set(0.5);
  rank.x = -360;
  const name = fitText(ink(r.name, 34, { fill: r.me ? P.greenInk : P.ink, fontWeight: r.me ? '900' : 'normal' }), 400);
  name.anchor.set(0, 0.5);
  name.x = -300;
  const score = ink(scoreText(board, r.score), 34, { fontWeight: '900', fill: r.me ? P.greenInk : P.ink });
  score.anchor.set(1, 0.5);
  score.x = 390;
  c.addChild(tile, rank, name, score);
  return c;
}

/** The leaderboards in full: a switch between the boards, then the top rows with the player's own
 *  in green (below a gap when it is past the top), or where the page is at. */
export function boardPanel(act: HomeActions, fit: MenuFit, view: BoardView): Container {
  const h = 1140;
  const { panel, box } = frame(act, t('board.title'), h, fit);
  const top = -h / 2;
  BOARD_IDS.forEach((id, i) => {
    const on = id === view.tab;
    const pill = new PillButton(t(`board.${id}`), 380, 100, on ? 'green' : 'brass', () => act.boardTab(id), 40);
    pill.position.set((i - 0.5) * 400, top + 150);
    pill.alpha = on ? 1 : 0.8;
    box.addChild(pill);
  });
  const first = top + 260;
  const { page } = view;
  if (page === 'loading' || page === 'offline' || page.rows.length === 0) {
    const key = page === 'loading' ? 'board.loading' : page === 'offline' ? 'board.offline' : 'board.empty';
    const say = fitText(ink(t(key), 38, { fill: P.inkSoft }), 760);
    say.y = first + 200;
    box.addChild(say);
  } else {
    page.rows.forEach((r, i) => box.addChild(row(view.tab, r, first + i * ROW_H)));
    if (page.me && !page.rows.some((r) => r.me)) {
      const dots = ink('···', 36, { fill: P.inkSoft });
      dots.y = first + page.rows.length * ROW_H - 10;
      box.addChild(dots, row(view.tab, page.me, first + (page.rows.length + 0.6) * ROW_H));
    }
  }
  const note = fitText(ink(t('board.note'), 28, { fill: LIGHT.edge }), 820);
  note.y = h / 2 - 60;
  box.addChild(note);
  return panel;
}
