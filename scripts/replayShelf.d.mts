// The collector's replay shelf (replayShelf.mjs), as its tests and `npm run replays` use it.

import type { Replay } from '../src/sim/replay';

export const KEEP_DAYS: number;
export const MAX_BYTES: number;

/** One kept replay: who sent it, which battle, how it ended, when it came. */
export interface ShelfDoc {
  uid: string;
  run: number;
  end: 'won' | 'lost' | 'quit' | 'hidden';
  at: number;
  build?: string;
  platform?: string;
  replay: Replay;
}

export function cleanReplay(body: unknown, at: number): ShelfDoc | null;
export function unzipReplay(zip: Uint8Array): ShelfDoc;
export function readShelf(dir: string, log?: (line: string) => void): ShelfDoc[];

export class ReplayShelf {
  constructor(dir: string, maxBytes?: number, log?: (line: string) => void);
  readonly bytes: number;
  put(doc: ShelfDoc): boolean;
  prune(now: number): number;
}
