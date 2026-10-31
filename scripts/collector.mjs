// Minimal telemetry collector: accepts POSTed JSON arrays of events and appends them to NDJSON,
// one event per line. No dependencies; runs locally and, in server/, on the VPS behind a
// Cloudflare Tunnel at https://ps.gamestao.com/e.
//
//   node scripts/collector.mjs [port] [file]      (defaults: 8787, telemetry/events.ndjson)
//   build with VITE_ANALYTICS_URL=http://host:8787/e
//   npm run report -- telemetry/events.ndjson
//
// With COLLECTOR_DIR set (the container does) it writes one file per UTC day instead,
// <dir>/events-YYYY-MM-DD.ndjson, and deletes the day files older than 14 months (the period
// public/privacy.html §8 promises), checked on the first request of each UTC day, so the
// container's healthcheck alone keeps it going. GET /health answers 200 while the directory is
// writable with MIN_FREE left on its disk, 503 otherwise, so the healthcheck sees a full disk.
//
// GET /b?h=<host>&s=<step>&b=<build>[&ms=<n>][&n=0|1][&r=<source>] counts an anonymous load
// checkpoint, no id: `open_*` from the page's inline script before anything else downloads
// (scripts/openBeacon.mjs), `loaded_*` once the first battle frame is up (app.ts). `n` says
// whether it is a new player's launch, `r` is the acquisition source tag or referrer host. It
// lands in the same file as {name: 'beacon', step, host, build, ms, new, src, country}.
//
// POST /e keeps only what the privacy policy (§2) lists: events with a name the game sends
// (EVENTS) and TrackedEvent's fields (src/analytics/analytics.ts), each of its type, with props
// of the shapes Props allows. Unknown keys are dropped, strings lose their control characters and
// stop at 200 characters (the feedback line's own limit), and an event still over 4 KB is dropped.
// Each line, events and checkpoints alike, gets the `country` Cloudflare puts the request in
// (collectorLimits.mjs countryOf), never the address.
//
// POST /r keeps one battle's replay, sent by the game only while the player shares statistics
// (src/analytics/replayUpload.ts), in <dir>/replays for 15 days (scripts/replayShelf.mjs);
// `npm run replays` plays them again. Every route but /health is charged to a per-address budget
// before its body is read (scripts/collectorLimits.mjs).

import { accessSync, appendFileSync, constants, mkdirSync, readdirSync, statfsSync, statSync, unlinkSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { addressOf, BodyGate, countryOf, declared, Limits, MAX_BODY, MAX_REPLAY, rateOf, readBody, STATUS } from './collectorLimits.mjs';
import { cleanReplay, MAX_BYTES, ReplayShelf } from './replayShelf.mjs';
import { acctOfQuery, cleanSave, SaveVault } from './saveVault.mjs';

const port = Number(process.env.PORT) || Number(process.argv[2]) || 8787;
const dir = process.env.COLLECTOR_DIR;
const single = process.argv[3] || 'telemetry/events.ndjson';
/** One stored line, at most. */
const MAX_EVENT = 4096;
/** Any string in an event's props, at most. */
const MAX_TEXT = 200;
/** A day's file stops growing past this, so a flood cannot fill the disk. */
const MAX_FILE = 512 * 1024 * 1024;
/** Free disk below this and /health answers 503. */
const MIN_FREE = 256 * 1024 * 1024;
/** Day files are kept this many months (privacy policy §8). */
const KEEP_MONTHS = 14;
mkdirSync(dir ?? dirname(single), { recursive: true });

const fileFor = (now) => (dir ? join(dir, `events-${new Date(now).toISOString().slice(0, 10)}.ndjson`) : single);
const sizeOf = (file) => {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
};

let prunedOn = '';
/** Deletes the day files from before the retention window, once per UTC day. */
function prune(now) {
  const today = new Date(now).toISOString().slice(0, 10);
  if (!dir || today === prunedOn) return;
  prunedOn = today;
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - KEEP_MONTHS);
  const oldest = cutoff.toISOString().slice(0, 10);
  for (const name of readdirSync(dir)) {
    const day = /^events-(\d{4}-\d{2}-\d{2})\.ndjson$/.exec(name)?.[1];
    if (!day || day >= oldest) continue;
    try {
      unlinkSync(join(dir, name));
      console.log(`collector: deleted ${name} (older than ${KEEP_MONTHS} months)`);
    } catch (err) {
      console.log(`collector: could not delete ${name}: ${err}`);
    }
  }
}
prune(Date.now());

const shelf = new ReplayShelf(join(dir ?? dirname(single), 'replays'), Number(process.env.COLLECTOR_REPLAY_BYTES) || MAX_BYTES);
const vault = new SaveVault(join(dir ?? dirname(single), 'saves'));
let replaysPrunedAt = -1;
/** Drops the replays past their days and the save copies past their months, once an hour. */
function pruneReplays(now) {
  const hour = Math.floor(now / 3600_000);
  if (hour === replaysPrunedAt) return;
  replaysPrunedAt = hour;
  shelf.prune(now);
  vault.prune(now);
}

const BEACONS = ['open_desktop', 'open_touch', 'loaded_desktop', 'loaded_touch'];
// playgama sends only `loaded_*` (its build has no inline `open_*`, vite.playgama.config.js)
const HOSTS = ['crazygames', 'web', 'ios', 'playgama'];

/** The line a checkpoint request writes, or null when it is not one. */
function beaconLine(url, received, country) {
  const q = new URL(url, 'http://x').searchParams;
  const step = q.get('s');
  const host = q.get('h');
  const build = q.get('b') ?? '';
  if (!BEACONS.includes(step) || !HOSTS.includes(host) || !/^[\w.+-]{1,40}$/.test(build)) return null;
  const ms = q.has('ms') ? Number(q.get('ms')) : NaN;
  const line = { name: 'beacon', step, host, build, ts: received, received };
  if (Number.isInteger(ms) && ms >= 0 && ms < 3_600_000) line.ms = ms;
  const n = q.get('n');
  if (n === '0' || n === '1') line.new = n === '1';
  const src = q.get('r');
  if (src && /^[a-z0-9._-]{1,40}$/.test(src)) line.src = src;
  if (country) line.country = country;
  return line;
}

// Every event name the game sends (src/analytics/collectorSchema.test.ts checks); first_star<n>
// is the one family. tutorial_assist is only sent by builds from before the tutorial held the
// battle (2026-10-25); kept so their cached pages still land.
const EVENTS = new Set([
  'ad_challenge', 'ad_midgame', 'ad_offer', 'ad_paced', 'ad_result', 'ad_shop', 'alive', 'anomaly', 'battle_start_tap',
  'challenge_end', 'challenge_start', 'crystals', 'daily_claim', 'dialog', 'endless_end', 'endless_start',
  'feedback', 'feedback_shown', 'feedback_skip', 'first_input', 'first_merge', 'first_summon', 'first_ultimate',
  'first_upgrade', 'first_win', 'hint_upgrade_button', 'hint_upgrade_done', 'hint_upgrade_tab', 'home_view', 'iap',
  'language', 'lineup', 'meta_buy', 'perf', 'privacy', 'result_action', 'result_shown', 'run_end', 'run_hidden',
  'run_quit', 'run_start', 'session_end', 'session_start', 'skill_pick', 'stars', 'tutorial_assist', 'tutorial_end',
  'tutorial_step', 'viewport', 'wave_start',
]);
const knownName = (n) => typeof n === 'string' && (EVENTS.has(n) || /^first_star\d$/.test(n));

// C0 and C1 controls and the two JSON-legal line breaks a log viewer would split on
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const CONTROLS = new RegExp(CONTROL.source, 'g');
const text = (s) => s.replace(CONTROLS, ' ').slice(0, MAX_TEXT);
const id = (v) => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
const short = (max) => (v) => typeof v === 'string' && v.length <= max && !CONTROL.test(v);
const number = (v) => typeof v === 'number' && Number.isFinite(v);
/** TrackedEvent's fields besides name and props, with the check each must pass. */
const FIELDS = {
  uid: id,
  sid: id,
  ts: number,
  day: Number.isInteger,
  session: Number.isInteger,
  build: short(40),
  platform: short(20),
  src: short(64),
};
const PROP_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const MAX_PROPS = 64;
const MAX_LIST = 50;

/** A props value the way Props allows it, cleaned, or undefined to drop it. */
function propValue(v) {
  if (v === null || typeof v === 'boolean' || number(v)) return v;
  if (typeof v === 'string') return text(v);
  if (!Array.isArray(v) || v.length > MAX_LIST) return undefined;
  if (v.every((x) => typeof x === 'string')) return v.map(text);
  if (v.every(number)) return v;
  return undefined;
}

/** The line to store for one posted event, or null to drop it. */
export function cleanEvent(e, received, country) {
  if (!e || typeof e !== 'object' || Array.isArray(e) || !knownName(e.name) || !id(e.uid)) return null;
  const out = { name: e.name };
  for (const [k, ok] of Object.entries(FIELDS)) {
    if (e[k] === undefined) continue;
    if (!ok(e[k])) return null;
    out[k] = e[k];
  }
  if (e.props !== undefined) {
    if (!e.props || typeof e.props !== 'object' || Array.isArray(e.props)) return null;
    const props = {};
    let n = 0;
    for (const [k, v] of Object.entries(e.props)) {
      if (n >= MAX_PROPS) break;
      const clean = PROP_KEY.test(k) ? propValue(v) : undefined;
      if (clean === undefined) continue;
      props[k] = clean;
      n++;
    }
    out.props = props;
  }
  out.received = received;
  if (country) out.country = country;
  const line = JSON.stringify(out);
  return line.length <= MAX_EVENT ? line : null;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
/** A refusal that leaves the client's body unread: the connection goes with it. */
const refuse = (res, status, extra = {}) => res.writeHead(status, { ...cors, ...extra, Connection: 'close' }).end();

const limits = new Limits();
const bigReads = new BodyGate();

let fullFile = '';
/** Appends `lines` to the day's file unless it is full, which it says once per file. */
function append(file, lines) {
  if (sizeOf(file) < MAX_FILE) return appendFileSync(file, lines);
  if (fullFile === file) return;
  fullFile = file;
  console.log(`collector: ${file} reached ${MAX_FILE} bytes, dropping events until the next file`);
}

/** Whether the collector can keep what it is sent: its directory writable, with room on the disk. */
function healthy() {
  const target = dir ?? dirname(single);
  try {
    accessSync(target, constants.W_OK);
    const fs = statfsSync(target);
    return fs.bavail * fs.bsize >= MIN_FREE;
  } catch {
    return false;
  }
}

/** POST /e: an array of events, each kept as one line of the day's file. */
function events(text, res, country) {
  try {
    const list = JSON.parse(text);
    if (!Array.isArray(list)) throw new Error('not an array');
    const received = Date.now();
    const lines = list.map((e) => cleanEvent(e, received, country)).filter(Boolean);
    if (lines.length) append(fileFor(received), lines.join('\n') + '\n');
    res.writeHead(204, cors).end();
  } catch {
    res.writeHead(400, cors).end();
  }
}

/** POST /r: one battle's replay, kept on the shelf. */
function replay(text, res) {
  let doc = null;
  try {
    doc = cleanReplay(JSON.parse(text), Date.now());
  } catch {
    // not JSON
  }
  if (!doc) return res.writeHead(400, cors).end();
  try {
    shelf.put(doc);
  } catch (err) {
    console.log(`collector: could not keep a replay: ${err}`);
    return res.writeHead(503, cors).end();
  }
  res.writeHead(204, cors).end();
}

/** POST /s: one save copy, kept unless its id belongs to another device. */
function saveCopy(text, res) {
  let copy = null;
  try {
    copy = cleanSave(JSON.parse(text));
  } catch {
    // not JSON
  }
  if (!copy) return res.writeHead(400, cors).end();
  try {
    return res.writeHead(vault.put(copy, Date.now()) === 'kept' ? 204 : 403, cors).end();
  } catch (err) {
    console.log(`collector: could not keep a save: ${err}`);
    return res.writeHead(503, cors).end();
  }
}

/** GET /s?acct=<hash>: the account's save copy. */
function savedCopy(url, res) {
  const acct = acctOfQuery(url);
  if (!acct) return res.writeHead(400, cors).end();
  const doc = vault.get(acct);
  if (!doc) return res.writeHead(404, cors).end();
  res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(doc));
}

createServer((req, res) => {
  const now = Date.now();
  prune(now);
  pruneReplays(now);
  if (req.method === 'GET' && req.url === '/health') {
    const ok = healthy();
    return res.writeHead(ok ? 200 : 503, { 'Content-Type': 'text/plain' }).end(ok ? 'ok' : 'unhealthy');
  }
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  const rate = rateOf(req.method, req.url);
  if (!rate) return res.writeHead(404, cors).end();
  const ip = addressOf(req);
  const length = declared(req);
  if (!limits.allow(rate, ip, length)) return refuse(res, 429);
  if (rate === 'saves' && req.method === 'GET') return savedCopy(req.url, res);
  if (req.method === 'GET') {
    const line = beaconLine(req.url, now, countryOf(req));
    if (!line) return res.writeHead(400, cors).end();
    append(fileFor(now), JSON.stringify(line) + '\n');
    return res.writeHead(204, cors).end();
  }
  const big = rate === 'replays';
  const limit = big ? MAX_REPLAY : MAX_BODY;
  if (length > limit) return refuse(res, 413);
  if (big && !bigReads.take()) return refuse(res, 503, { 'Retry-After': '5' });
  readBody(req, { limit, over: (n) => limits.spend(rate, ip, n) }, (err, text) => {
    if (big) bigReads.give();
    if (err) return err in STATUS ? refuse(res, STATUS[err]) : undefined;
    if (big) replay(text, res);
    else if (rate === 'saves') saveCopy(text, res);
    else events(text, res, countryOf(req));
  });
}).listen(port, () => console.log(`collector on :${port}/e -> ${dir ? join(dir, 'events-<day>.ndjson') : single}`));
