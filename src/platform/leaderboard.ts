// The host's leaderboards, Playgama's only for now (its SaaS boards, vite.playgama.config.js
// BRIDGE_CONFIG): the furthest wave of a daily challenge run and the best endless wave. Elsewhere
// the platform has no setScore and nothing is sent.

import type { Platform } from './types';

/** The board ids, as made in Playgama's developer console. */
export const LEADERBOARDS = { challenge: 'daily_challenge', endless: 'endless' } as const;
export type Board = keyof typeof LEADERBOARDS;

/** Sends a whole wave count above 0; never throws into the game. */
export function reportScore(p: Platform, board: Board, waves: number): void {
  if (!p.setScore || !Number.isFinite(waves) || waves < 1) return;
  try {
    p.setScore(LEADERBOARDS[board], Math.floor(waves));
  } catch {
    /* a leaderboard is never worth a broken game end */
  }
}
