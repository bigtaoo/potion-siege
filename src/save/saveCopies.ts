// Which of a player's save copies the game starts from (docs: public/privacy.html §4). A save can
// sit in three places: the host's store (Playgama Bridge: the portal's cloud for a signed-in
// player, the browser's storage for a guest), our own mirror in the browser's storage beside it
// (saveMirror.ts), and our server (saveVault.ts). The host's store can come back empty: a cloud
// read that failed, a portal that lost the player's sign-in, a new page address. Then the copy with
// the most progress wins, but only among the copies of the same owner, so a second account on the
// device never takes the first one's progress:
// - an owner's own copies always count, the most progress first; for an account, so does the
//   device's guest copy that it took over or handed on (a guest copy remembers its account);
// - a fresh account (no battle yet) takes the device's guest copy that belongs to no account yet,
//   which from then on is that account's;
// - a fresh guest takes the device's latest account copy: the portal signed the player out, and
//   the browser is theirs. That copy is marked with the account it came from.

import { parseMeta } from '../sim/meta';

/** Who a save belongs to: 'guest', or an account: Playgama's ('pg:<hash>'), CrazyGames' ('cg:')
 *  or Game Center's ('gc:'). */
export type Owner = string;
export const GUEST: Owner = 'guest';

/** Where an account comes from: Playgama, CrazyGames or Game Center. */
export type AccountHost = 'pg' | 'cg' | 'gc';

/** An account's owner: a hash of its id, so our server never holds the host's own id. */
export function accountOwner(accountId: string, host: AccountHost = 'pg'): Owner {
  // cyrb53's mixing (public domain), both 32-bit lanes kept
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < accountId.length; i++) {
    const c = accountId.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${host}:${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export interface SaveCopy {
  owner: Owner;
  /** When it was written (ms since 1970). */
  at: number;
  /** The save as the store keeps it (MetaSave JSON). */
  save: string;
  /** The account a guest copy was taken from, if it was. */
  from?: Owner;
}

/** Where the copy the game starts from was found. */
export type CopySource = 'host' | 'mirror' | 'server';

export interface CopyPick {
  save: string;
  source: CopySource;
  /** The owner it came from when that is another one (the copy was adopted). */
  adopted?: Owner;
  /** What a guest copy remembers: the account its progress came from. */
  from?: Owner;
}

/** Progress, compared field by field: battles played, then potion and workshop levels, then stages won. */
export function progressOf(raw: string | null): [number, number, number] {
  const m = parseMeta(raw);
  const levels = Object.values(m.heroes).reduce((a, b) => a + b, 0) + Object.values(m.workshop).reduce((a, b) => a + b, 0);
  return [m.runs, levels, m.cleared];
}

/** Negative when `a` has less progress than `b`. */
export function compareProgress(a: string | null, b: string | null): number {
  const pa = progressOf(a);
  const pb = progressOf(b);
  for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** No battle played yet: what a lost save looks like. */
export const isFresh = (raw: string | null): boolean => progressOf(raw)[0] === 0;

interface Candidate extends CopyPick {
  at: number;
}

/**
 * The copy to start from, or null when the host's own save is the best there is. `host` is what
 * the host's store gave, `mirror` the copies kept on this device (any owner), `server` the
 * owner's copy on our server, if one came.
 */
export function pickCopy(owner: Owner, host: string | null, mirror: SaveCopy[], server: SaveCopy | null): CopyPick | null {
  const own: Candidate[] = [];
  const mine = mirror.find((c) => c.owner === owner);
  if (mine) own.push({ save: mine.save, source: 'mirror', at: mine.at, from: mine.from });
  if (server && server.owner === owner) own.push({ save: server.save, source: 'server', at: server.at, from: server.from });
  // a guest copy this account handed on or took over carries on its progress
  const kept = owner === GUEST ? undefined : mirror.find((c) => c.owner === GUEST && c.from === owner);
  if (kept) own.push({ save: kept.save, source: 'mirror', at: kept.at, adopted: GUEST });
  let best: Candidate | null = null;
  for (const c of own) if (better(c, best, host)) best = c;
  const start = best?.save ?? host;
  const found: CopyPick | null = best && { save: best.save, source: best.source, ...(best.adopted ? { adopted: best.adopted } : {}), ...(best.from ? { from: best.from } : {}) };
  if (!isFresh(start)) return found;
  // nothing of its own: a fresh owner may take over the device's other copy
  const other = owner === GUEST ? latestAccount(mirror) : mirror.find((c) => c.owner === GUEST && c.from === undefined);
  if (!other || isFresh(other.save)) return found;
  return { save: other.save, source: 'mirror', adopted: other.owner, ...(owner === GUEST ? { from: other.owner } : {}) };
}

/** Whether `c` beats the best so far (or, with none, the host's save): more progress, or as much and newer. */
function better(c: Candidate, best: Candidate | null, host: string | null): boolean {
  const vs = compareProgress(c.save, best ? best.save : host);
  return vs > 0 || (vs === 0 && best !== null && c.at > best.at);
}

function latestAccount(mirror: SaveCopy[]): SaveCopy | undefined {
  let out: SaveCopy | undefined;
  for (const c of mirror) if (c.owner !== GUEST && (!out || c.at > out.at)) out = c;
  return out;
}
