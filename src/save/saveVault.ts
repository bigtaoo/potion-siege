// Our server's copy of a player's save (the collector's /s, scripts/saveVault.mjs): every change
// goes up a little later (SEND_MS) or at once when the page is hidden, under the copy's random id
// and secret (saveMirror.ts). A signed-in portal account's copy is also found by the account's
// hash, which the game asks for at boot (FETCH_MS at most): a save its host lost comes back from
// there (saveCopies.ts). A game service rather than play statistics: sent whatever the player's
// statistics choice (public/privacy.html §2).

import type { Owner, SaveCopy } from './saveCopies';
import type { MirrorCopy } from './saveMirror';

/** How long a change waits before it goes up, so a burst of saves sends one. */
export const SEND_MS = 10_000;
/** How long boot waits for the server's copy of an account. */
export const FETCH_MS = 1500;
/** keepalive requests share about 64 KB in flight per page; a bigger body goes as a plain fetch. */
const KEEPALIVE_MAX = 60_000;

/** The collector's save route beside its events one (VITE_ANALYTICS_URL ends in /e). */
export const vaultUrl = (eventsUrl: string): string => `${eventsUrl.replace(/\/e$/, '')}/s`;

/** What POST /s takes. */
export interface VaultPost {
  id: string;
  token: string;
  /** The account's hash, for a portal account's copy. */
  acct?: string;
  at: number;
  save: string;
}

/** The account part of a portal owner ('pg:<hash>'), or null for a guest. */
export const acctOf = (owner: Owner): string | null => (owner.startsWith('pg:') ? owner.slice(3) : null);

export type Get = (url: string, signal: AbortSignal) => Promise<unknown>;
export type Post = (url: string, body: string) => void;

const fetchGet: Get = async (url, signal) => {
  const res = await fetch(url, { signal });
  return res.ok ? res.json() : null;
};

const fetchPost: Post = (url, body) => {
  // text/plain (a string body's type) avoids a CORS preflight
  void fetch(url, { method: 'POST', body, mode: 'no-cors', keepalive: body.length <= KEEPALIVE_MAX }).catch(() => {});
};

/** The server's copy of `owner`, an account; null for a guest, when there is none, or after FETCH_MS. */
export async function fetchCopy(url: string, owner: Owner, get: Get = fetchGet, ms = FETCH_MS): Promise<SaveCopy | null> {
  const acct = acctOf(owner);
  if (!acct) return null;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), ms);
  try {
    const doc = (await get(`${url}?acct=${encodeURIComponent(acct)}`, abort.signal)) as { at?: unknown; save?: unknown } | null;
    if (!doc || typeof doc.save !== 'string' || typeof doc.at !== 'number') return null;
    return { owner, at: doc.at, save: doc.save };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Sends the latest copy SEND_MS after a change, or at once on `flush` (the page hidden). */
export class VaultUpload {
  private waiting: VaultPost | null = null;
  private timer: unknown = null;

  constructor(
    private readonly url: string,
    private readonly post: Post = fetchPost,
    private readonly timers: { set: (fn: () => void, ms: number) => unknown; clear: (t: unknown) => void } = {
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
    },
  ) {}

  queue(copy: MirrorCopy): void {
    const acct = acctOf(copy.owner);
    this.waiting = { id: copy.id, token: copy.token, ...(acct ? { acct } : {}), at: copy.at, save: copy.save };
    if (this.timer === null) this.timer = this.timers.set(() => this.flush(), SEND_MS);
  }

  flush(): void {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
    const body = this.waiting;
    this.waiting = null;
    if (!body) return;
    try {
      this.post(this.url, JSON.stringify(body));
    } catch {
      // the next change sends it again
    }
  }

  /** Hidden and leaving pages send what waits. */
  listen(doc: Pick<Document, 'addEventListener' | 'visibilityState'>, win: Pick<Window, 'addEventListener'>): this {
    doc.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'hidden') this.flush();
    });
    win.addEventListener('pagehide', () => this.flush());
    return this;
  }
}
