// The players' save copies the collector keeps (POST /s and GET /s, scripts/collector.mjs), so a
// save the portal or the browser lost can come back (src/save/saveCopies.ts). One `<id>.json` per
// device and owner in `<data>/saves`, under the random id the game made for it, replaced only by a
// post with the same secret (kept as its SHA-256 only). A signed-in portal account's copy is also
// found by the account's hash: `acct-<hash>.json` names the copy with the most battles. A copy is
// dropped KEEP_MONTHS after its last change (public/privacy.html §8). Synchronous like the rest of
// the collector.

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const KEEP_MONTHS = 14;
/** A save is about 3 KB; this leaves room for years of stars and achievements. */
export const MAX_SAVE = 60_000;

const ID = /^[0-9a-f]{24}$/;
const TOKEN = /^[0-9a-f]{32}$/;
const ACCT = /^[0-9a-f]{16}$/;

const hash = (token) => createHash('sha256').update(token).digest('hex');

/** The battles a save has played (MetaSave.runs), 0 when it does not say. */
function runsOf(save) {
  const runs = JSON.parse(save).runs;
  return Number.isSafeInteger(runs) && runs >= 0 ? runs : 0;
}

/**
 * What the collector takes of a posted copy (src/save/saveVault.ts sends it): its id, secret,
 * account hash if any and the save, which must be a JSON object; null when it is not one.
 */
export function cleanSave(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (typeof body.id !== 'string' || !ID.test(body.id) || typeof body.token !== 'string' || !TOKEN.test(body.token)) return null;
  if (body.acct !== undefined && (typeof body.acct !== 'string' || !ACCT.test(body.acct))) return null;
  if (typeof body.save !== 'string' || body.save.length > MAX_SAVE) return null;
  try {
    const save = JSON.parse(body.save);
    if (!save || typeof save !== 'object' || Array.isArray(save)) return null;
  } catch {
    return null;
  }
  return { id: body.id, token: body.token, ...(body.acct ? { acct: body.acct } : {}), save: body.save };
}

/** An account's id in the query (`?acct=<hash>`), or null. */
export function acctOfQuery(url) {
  const acct = new URL(url, 'http://x').searchParams.get('acct');
  return acct && ACCT.test(acct) ? acct : null;
}

export class SaveVault {
  constructor(dir, log = console.log) {
    this.dir = dir;
    this.log = log;
    mkdirSync(dir, { recursive: true });
  }

  /** Keeps `copy` (cleanSave's) at `now`: 'kept', or 'refused' when its id is another device's. */
  put(copy, now) {
    const path = join(this.dir, `${copy.id}.json`);
    const was = this.read(path);
    const tokenHash = hash(copy.token);
    if (was && was.tokenHash !== tokenHash) return 'refused';
    const runs = runsOf(copy.save);
    this.write(path, { id: copy.id, tokenHash, ...(copy.acct ? { acct: copy.acct } : {}), at: now, runs, save: copy.save });
    if (copy.acct) {
      const index = join(this.dir, `acct-${copy.acct}.json`);
      const named = this.read(index);
      if (!named || named.id === copy.id || runs >= named.runs) this.write(index, { id: copy.id, runs, at: now });
    }
    return 'kept';
  }

  /** The account's copy with the most battles, as the game takes it, or null. */
  get(acct) {
    const named = this.read(join(this.dir, `acct-${acct}.json`));
    const doc = named && this.read(join(this.dir, `${named.id}.json`));
    return doc ? { at: doc.at, save: doc.save } : null;
  }

  /** Drops the copies and account names not written for KEEP_MONTHS; how many went. */
  prune(now) {
    const cutoff = new Date(now);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - KEEP_MONTHS);
    let n = 0;
    for (const f of readdirSync(this.dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        if (statSync(join(this.dir, f)).mtimeMs >= cutoff.getTime()) continue;
        unlinkSync(join(this.dir, f));
        n++;
      } catch {
        // gone since the listing
      }
    }
    if (n) this.log(`collector: deleted ${n} save file(s) older than ${KEEP_MONTHS} months`);
    return n;
  }

  read(path) {
    try {
      return JSON.parse(String(readFileSync(path)));
    } catch {
      return null;
    }
  }

  /** Written aside and renamed, so a reader never sees half a file. */
  write(path, doc) {
    writeFileSync(`${path}.tmp`, JSON.stringify(doc));
    renameSync(`${path}.tmp`, path);
  }
}
