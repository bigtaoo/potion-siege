// Our server's leaderboards (POST /l and GET /l, scripts/leaderboard.mjs). A player is their save
// copy on the server (save/saveVault.ts): a post names the copy's id and brings its secret, and the
// server ranks the scores of the copy it holds, so the copy goes out first (flush) and the post
// follows POST_MS later. The numbers handed to submit() only decide whether anything changed.

import type { BoardId, BoardPage, BoardRow, Leaderboard, Scores } from './types';

/** How long after sending the save copy the post goes, so the server ranks the new copy. */
export const POST_MS = 3000;
/** Rows asked for. */
export const ROWS = 10;
/** A query given up after this, as offline. */
export const FETCH_MS = 6000;

export type Get = (url: string, signal: AbortSignal) => Promise<unknown>;
export type Post = (url: string, body: string) => void;

export interface CopyKey {
  id: string;
  token: string;
}

/** What the server board needs of the save keeper (save/saveKeeper.ts). */
export interface CopySource {
  /** This device's copy on our server, or null before it has one (no battle played yet). */
  copyKey(): CopyKey | null;
  /** Sends the copy that waits for the server now. */
  flush(): void;
}

const fetchGet: Get = async (url, signal) => {
  const res = await fetch(url, { signal });
  return res.ok ? res.json() : null;
};

// text/plain (a string body's type) avoids a CORS preflight
const fetchPost: Post = (url, body) => void fetch(url, { method: 'POST', body, mode: 'no-cors', keepalive: true }).catch(() => {});

/** The board route beside the save route (`…/s` → `…/l`). */
export const boardUrl = (vaultUrl: string): string => vaultUrl.replace(/\/s$/, '/l');

const rowOf = (r: unknown, me = false): BoardRow | null => {
  const o = r as { rank?: unknown; tag?: unknown; score?: unknown; me?: unknown } | null;
  if (!o || typeof o.rank !== 'number' || typeof o.tag !== 'string' || typeof o.score !== 'number') return null;
  return { rank: o.rank, name: o.tag, score: o.score, ...(me || o.me === true ? { me: true } : {}) };
};

export class ServerBoard implements Leaderboard {
  private sent = '';
  private timer: unknown = null;

  constructor(
    private readonly url: string,
    private readonly copies: CopySource,
    private readonly io: { get?: Get; post?: Post; later?: (fn: () => void, ms: number) => unknown } = {},
  ) {}

  submit(scores: Scores): void {
    const key = `${scores.endless}/${scores.stars}`;
    if (key === this.sent || (scores.endless === 0 && scores.stars === 0) || this.timer !== null) return;
    try {
      this.copies.flush();
    } catch {
      // the copy goes on the next change; the post then finds the older one
    }
    const later = this.io.later ?? ((fn, ms) => setTimeout(fn, ms));
    this.timer = later(() => {
      this.timer = null;
      const copy = this.copies.copyKey();
      if (!copy) return;
      this.sent = key;
      try {
        (this.io.post ?? fetchPost)(this.url, JSON.stringify({ id: copy.id, token: copy.token }));
      } catch {
        this.sent = '';
      }
    }, POST_MS);
  }

  async top(board: BoardId): Promise<BoardPage | null> {
    const me = this.copies.copyKey()?.id;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), FETCH_MS);
    try {
      const doc = (await (this.io.get ?? fetchGet)(`${this.url}?board=${board}&n=${ROWS}${me ? `&me=${me}` : ''}`, abort.signal)) as { rows?: unknown; me?: unknown } | null;
      if (!doc || !Array.isArray(doc.rows)) return null;
      const rows = doc.rows.map((r) => rowOf(r)).filter((r): r is BoardRow => r !== null);
      return { board, rows, me: rowOf(doc.me, true) };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** The server board for the save route `vault`, or null where no copy goes to our server. */
export const serverBoard = (vault: string | null, copies: CopySource): ServerBoard | null => (vault ? new ServerBoard(boardUrl(vault), copies) : null);
