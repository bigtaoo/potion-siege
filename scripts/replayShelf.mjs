// The battles' replays the collector keeps (POST /r, scripts/collector.mjs), for the operator to
// re-simulate (`npm run replays`). One gzipped `<uid>-<run>.json.gz` per install and battle in
// `<data>/replays`: a battle's later upload (its end after the one sent when the page was hidden)
// replaces the earlier. Each is dropped KEEP_DAYS after it came (public/privacy.html §8), or the
// oldest first once the shelf is full. Ported from Holy Kicker's DiskShelf (D:\standing
// server/src/replayShelf.ts), synchronous like the rest of the collector.

import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

/** Days a replay is kept, and the most the shelf holds by default (COLLECTOR_REPLAY_BYTES overrides). */
export const KEEP_DAYS = 15;
export const MAX_BYTES = 1024 ** 3;
const KEEP_MS = KEEP_DAYS * 24 * 3600_000;
const SUFFIX = '.json.gz';

/** How the game ends an upload: its result, left for another battle, or the page hidden mid-battle. */
const ENDS = ['won', 'lost', 'quit', 'hidden'];
/** Commands in one replay, at most: a long endless run issues a few thousand. */
const MAX_COMMANDS = 20_000;
/** Ticks in one replay, at most: six hours at 30 Hz. */
const MAX_TICKS = 6 * 3600 * 30;

const id = (v) => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
const short = (max) => (v) => typeof v === 'string' && v.length <= max && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(v);
const count = (max) => (v) => Number.isInteger(v) && v >= 0 && v <= max;
const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * What the collector keeps of a posted replay (src/analytics/replayUpload.ts sends it): the
 * install's player ID, the battle's number on it, how it ended, and the replay as
 * src/sim/replay.ts takes it. Unknown keys are dropped; null when it is not one.
 */
export function cleanReplay(body, at) {
  if (!object(body) || !id(body.uid) || !count(1e7)(body.run) || body.run < 1 || !ENDS.includes(body.end)) return null;
  const r = body.replay;
  if (!object(r) || !count(1000)(r.version) || !Number.isSafeInteger(r.seed) || !object(r.setup)) return null;
  if (!Array.isArray(r.commands) || r.commands.length > MAX_COMMANDS || !r.commands.every(object)) return null;
  if (!count(MAX_TICKS)(r.ticks) || !Number.isSafeInteger(r.hash)) return null;
  const doc = { uid: body.uid, run: body.run, end: body.end, at };
  if (short(40)(body.build)) doc.build = body.build;
  if (short(20)(body.platform)) doc.platform = body.platform;
  doc.replay = { version: r.version, seed: r.seed, setup: r.setup, commands: r.commands, ticks: r.ticks, hash: r.hash };
  return doc;
}

/** One file per replay in `dir`; their sizes and times are kept in memory to cap and prune them. */
export class ReplayShelf {
  constructor(dir, maxBytes = MAX_BYTES, log = console.log) {
    this.dir = dir;
    this.maxBytes = maxBytes;
    this.log = log;
    this.files = new Map();
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(SUFFIX)) continue;
      try {
        const s = statSync(join(dir, f));
        this.files.set(f.slice(0, -SUFFIX.length), { at: s.mtimeMs, bytes: s.size });
      } catch {
        // gone since the listing
      }
    }
  }

  get bytes() {
    let n = 0;
    for (const f of this.files.values()) n += f.bytes;
    return n;
  }

  /** Keeps `doc` as `<uid>-<run>`, over an earlier one of that name; false when it alone is too big. */
  put(doc) {
    const name = `${doc.uid}-${doc.run}`;
    const zip = gzipSync(JSON.stringify(doc));
    if (zip.length > this.maxBytes) return false;
    this.makeRoom(name, zip.length);
    // written aside and renamed, so a reader never sees half a file; dated `at`, as a restart reads it
    const path = join(this.dir, name + SUFFIX);
    writeFileSync(`${path}.tmp`, zip);
    utimesSync(`${path}.tmp`, doc.at / 1000, doc.at / 1000);
    renameSync(`${path}.tmp`, path);
    this.files.set(name, { at: doc.at, bytes: zip.length });
    return true;
  }

  /** Drops the oldest replays (never `name`'s own) until `bytes` more fit beside the rest. */
  makeRoom(name, bytes) {
    let used = this.bytes - (this.files.get(name)?.bytes ?? 0);
    if (used + bytes <= this.maxBytes) return;
    const oldest = [...this.files].filter(([n]) => n !== name).sort((a, b) => a[1].at - b[1].at);
    let dropped = 0;
    for (const [n, f] of oldest) {
      if (used + bytes <= this.maxBytes) break;
      this.drop(n);
      used -= f.bytes;
      dropped++;
    }
    this.log(`collector: replay shelf full, dropped the ${dropped} oldest`);
  }

  drop(name) {
    try {
      unlinkSync(join(this.dir, name + SUFFIX));
    } catch {
      // already gone
    }
    this.files.delete(name);
  }

  /** Drops the replays older than KEEP_DAYS; how many went. */
  prune(now) {
    let n = 0;
    for (const [name, f] of this.files) {
      if (f.at >= now - KEEP_MS) continue;
      this.drop(name);
      n++;
    }
    if (n) this.log(`collector: deleted ${n} replay(s) older than ${KEEP_DAYS} days`);
    return n;
  }
}

/** A shelf file's document, as put() wrote it. */
export const unzipReplay = (zip) => JSON.parse(gunzipSync(zip).toString('utf8'));

/** Every replay kept in `dir` (`npm run replays`), oldest first; a file that does not read is skipped. */
export function readShelf(dir, log = console.log) {
  const docs = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(SUFFIX)) continue;
    try {
      docs.push(unzipReplay(readFileSync(join(dir, f))));
    } catch (e) {
      log(`replays: skipped ${f}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return docs.sort((a, b) => a.at - b.at);
}
