// The leaderboards the collector keeps (POST /l and GET /l, scripts/collector.mjs): the ones the
// game shows where the host has none of its own (web, CrazyGames, iOS), and on every host the
// record of all scores, Playgama's too (it shows Bridge's boards, which hold its own players only),
// as a backup and for analysis. Each entry keeps the platform it was last posted from, so a board
// reads per platform or across all of them. A player is their
// save copy (scripts/saveVault.mjs): POST /l names the copy's id and brings its secret, and the
// scores are read from the copy the server already holds, never taken from the request, so a
// player cannot post a number their own save does not back. A save that could not have been
// played (more stars than battles, a wave no run reaches) posts nothing.
//
// The daily challenge's board ranks one day's furthest wave (the save's challenge.best on
// challenge.date); a later day's post starts the entry over. The weekly board ranks the tower's
// furthest floor under the week's rule (alchemy.week.best in the week starting alchemy.week.id),
// the same way by week. A rebrewed save starts the campaign over (cleared back to 0): its stars
// and its tower stand on the furthest it ever cleared (alchemy.rebrew.peak).
//
// One `<board>.json` per board in `<data>/boards`: each entry the copy's id, its score, when it
// first reached it and when it was last posted. The boards show a short tag hashed from the id,
// never the id; an entry not posted for KEEP_MONTHS goes (public/privacy.html §8).

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const KEEP_MONTHS = 14;
/** BALANCE.meta.stageCount and BALANCE.endless.unlock (src/sim/balance.json; leaderboard tests check). */
export const STAGES = 50;
export const ENDLESS_UNLOCK = 10;
/** Enemy hit points grow 3% a wave: wave 500 is a million times wave 1, past any real run. */
export const ENDLESS_MAX = 500;
/** Entries a board keeps; the lowest go past it. */
export const MAX_ENTRIES = 10_000;
/** Rows GET /l hands out at most. */
export const MAX_ROWS = 50;
/** A POST /l body: an id and a secret. */
export const MAX_POST = 1024;

export const BOARDS = ['endless', 'stars', 'daily_challenge', 'weekly'];
/** The boards that rank one day's (or week's) score, and start over on the next. */
const DATED = ['daily_challenge', 'weekly'];

/** A platform as the game names itself (Platform.name: web, crazygames, ios, playgama). */
const PLATFORM = /^[a-z][a-z0-9_]{1,23}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const ID = /^[0-9a-f]{24}$/;
const TOKEN = /^[0-9a-f]{32}$/;

/** The short name a board shows for a copy's id. */
export const tagOf = (id) => createHash('sha256').update(`board:${id}`).digest('hex').slice(0, 6).toUpperCase();

const count = (v, max) => (Number.isSafeInteger(v) && v >= 0 && v <= max ? v : null);

/** Stars per stage, STAGES of them at most, each 0 to 3; null when it is not that. */
function starList(v) {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > STAGES || !v.every((s) => count(s, 3) !== null)) return null;
  return v;
}

/** The daily challenge's best wave and its day; a 0 score without a day it can stand on. */
function dailyOf(c) {
  const best = count(c?.best ?? 0, ENDLESS_MAX);
  if (best === null) return null;
  return typeof c?.date === 'string' && DAY.test(c.date) ? { score: best, day: c.date } : { score: 0, day: '' };
}

/** The week's tower best and the Monday that names the week. */
function weekOf(w) {
  const best = count(w?.best ?? 0, ENDLESS_MAX);
  if (best === null) return null;
  return typeof w?.id === 'string' && DAY.test(w.id) ? { score: best, day: w.id } : { score: 0, day: '' };
}

/**
 * A save's scores, { endless, stars, daily_challenge, weekly, days: { daily_challenge, weekly } }, or null when the save could not have been played: stars on
 * a stage not cleared, more stars than battles, an endless wave before endless opens or past any run.
 */
export function scoresOf(saveText) {
  let save;
  try {
    save = JSON.parse(saveText);
  } catch {
    return null;
  }
  if (!save || typeof save !== 'object') return null;
  const runs = count(save.runs ?? 0, Number.MAX_SAFE_INTEGER);
  const cleared = count(save.cleared ?? 0, STAGES);
  const peak = count(save.alchemy?.rebrew?.peak ?? 0, STAGES);
  const week = weekOf(save.alchemy?.week);
  const en = save.endless ?? {};
  const best = count(en.best ?? 0, ENDLESS_MAX);
  const endlessRuns = count(en.runs ?? 0, Number.MAX_SAFE_INTEGER);
  const normal = starList(save.stars?.normal);
  const hard = starList(save.stars?.hard);
  const daily = dailyOf(save.challenge);
  if (!daily || !week || peak === null || runs === null || cleared === null || best === null || endlessRuns === null || !normal || !hard) return null;
  const reach = Math.max(cleared, peak);
  if (normal.some((s, i) => s > 0 && i >= reach) || hard.some((s, i) => s > 0 && normal[i] === 0)) return null;
  const stars = [...normal, ...hard].reduce((a, b) => a + b, 0);
  if (stars > 3 * runs) return null;
  if ((best > 0 || week.score > 0) && (reach < ENDLESS_UNLOCK || endlessRuns === 0)) return null;
  if (week.score > best) return null;
  return { endless: best, stars, daily_challenge: daily.score, weekly: week.score, days: { daily_challenge: daily.day, weekly: week.day } };
}

/** What the collector takes of a posted body: the copy's id and secret and the platform it came
 *  from ('' when it named none it could); null when it is not that. */
export function cleanPost(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (typeof body.id !== 'string' || !ID.test(body.id) || typeof body.token !== 'string' || !TOKEN.test(body.token)) return null;
  return { id: body.id, token: body.token, platform: typeof body.platform === 'string' && PLATFORM.test(body.platform) ? body.platform : '' };
}

/** GET /l's query: the board, how many rows, whose rank to add, and the platform and (daily
 *  board) day to read it for; null without a known board. */
export function boardQuery(url) {
  const q = new URL(url, 'http://x').searchParams;
  const board = q.get('board');
  if (!BOARDS.includes(board)) return null;
  const n = Number(q.get('n') ?? 10);
  const me = q.get('me');
  const platform = q.get('platform');
  const day = q.get('day');
  return {
    board,
    n: Number.isInteger(n) ? Math.min(MAX_ROWS, Math.max(1, n)) : 10,
    me: me && ID.test(me) ? me : null,
    platform: platform && PLATFORM.test(platform) ? platform : null,
    day: day && DAY.test(day) ? day : null,
  };
}

/** Higher scores first, then whoever reached theirs first. */
const order = (a, b) => b.score - a.score || a.reached - b.reached;

export class Leaderboards {
  constructor(dir, log = console.log) {
    this.dir = dir;
    this.log = log;
    mkdirSync(dir, { recursive: true });
    this.boards = Object.fromEntries(BOARDS.map((b) => [b, this.read(b)]));
  }

  /**
   * Posts the scores of `save` (the copy's save text) for the copy `id` at `now` from `platform`
   * ('' for none named): 'posted', or
   * 'implausible' when the save could not have been played. A score of 0 is not ranked; a lower
   * score than the entry's replaces it (a save restored from an older copy), and only a higher one
   * moves when it was reached; on the daily and weekly boards a new day or week starts the entry over.
   */
  post(id, save, now, platform = '') {
    const scores = scoresOf(save);
    if (!scores) return 'implausible';
    for (const board of BOARDS) {
      const list = this.boards[board];
      const i = list.findIndex((e) => e.id === id);
      const was = i >= 0 ? list[i] : null;
      const score = scores[board];
      const daily = DATED.includes(board);
      const day = daily ? scores.days[board] : '';
      const same = was && (!daily || was.day === day);
      if (i >= 0) list.splice(i, 1);
      if (score > 0) list.push({ id, score, reached: same && was.score >= score ? was.reached : now, at: now, ...(platform ? { platform } : {}), ...(daily ? { day } : {}) });
      list.sort(order);
      if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
      if (was || score > 0) this.write(board);
    }
    return 'posted';
  }

  /** The top `n` rows of `board` and, when `me` is on it, their row too: only `platform`'s
   *  entries when one is named, and on the daily board only `day`'s (by default the latest day
   *  posted). Ties share a rank. */
  top(board, n, me = null, { platform = null, day = null } = {}) {
    const all = this.boards[board];
    const on = DATED.includes(board) ? (day ?? all.reduce((d, e) => (e.day > d ? e.day : d), '')) : null;
    const list = all.filter((e) => (!platform || e.platform === platform) && (on === null || e.day === on));
    const rows = [];
    let mine = null;
    let rank = 0;
    list.forEach((e, i) => {
      if (i === 0 || e.score !== list[i - 1].score) rank = i + 1;
      const row = { rank, tag: tagOf(e.id), score: e.score };
      if (i < n) rows.push(me === e.id ? { ...row, me: true } : row);
      if (me === e.id) mine = row;
    });
    return { board, total: list.length, rows, me: mine, ...(on !== null ? { day: on } : {}) };
  }

  /** Drops the entries not posted for KEEP_MONTHS; how many went. */
  prune(now) {
    const cutoff = new Date(now);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - KEEP_MONTHS);
    let n = 0;
    for (const board of BOARDS) {
      const list = this.boards[board];
      const kept = list.filter((e) => e.at >= cutoff.getTime());
      if (kept.length === list.length) continue;
      n += list.length - kept.length;
      this.boards[board] = kept;
      this.write(board);
    }
    if (n) this.log(`collector: dropped ${n} leaderboard entr(ies) older than ${KEEP_MONTHS} months`);
    return n;
  }

  read(board) {
    try {
      const doc = JSON.parse(String(readFileSync(join(this.dir, `${board}.json`))));
      const ok = (e) => e && ID.test(e.id) && Number.isSafeInteger(e.score) && e.score > 0 && Number.isFinite(e.reached) && Number.isFinite(e.at);
      return Array.isArray(doc.entries) ? doc.entries.filter(ok).sort(order) : [];
    } catch {
      return [];
    }
  }

  /** Written aside and renamed, so a reader never sees half a file. */
  write(board) {
    const path = join(this.dir, `${board}.json`);
    writeFileSync(`${path}.tmp`, JSON.stringify({ entries: this.boards[board] }));
    renameSync(`${path}.tmp`, path);
  }
}
