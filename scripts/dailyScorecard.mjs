// The Basic Launch daily scorecard in `npm run report`: per UTC day x device (desktop / touch),
// the three numbers CrazyGames scores, mapped to its 0-5 points (scripts/cgBenchmarks.mjs), so
// each morning of a Basic Launch shows yesterday's score out of 15 against the 9/15 bar, and the
// last 7 complete days (the window CG judges on) as one more row per device.
//
//   opens        `open_*` beacons: launches, new players or not (on CG every beacon reads as new:
//                the save is SDK data the inline script cannot see), the closest we get to CG's plays
//   new          players whose first session started that day
//   conv         sessions started that day with >= 60 s of battle / opens. Sessions, not players,
//                because the opens count launches: a player who opens the game twice is two of each
//   play         mean minutes per new player of that day over their install-day sessions (the
//                session's own calendar `day` 0), so a day's number is final once it is over; a
//                session's minutes are its time on screen (playtestMetrics.mjs sessionSecs)
//   D1           of that day's new players, back on their calendar day 1; shown once every one of
//                them is 2+ days older than the newest data (before that: "wait"); the 7-day row
//                counts the ones old enough so far
//   plays        sessions started that day, new and returning players
//   build        the build most of that day's sessions ran, "+n" for other builds that day
//
// Days are UTC dates. Events are put on a day by the device's `ts`, never the collector's
// `received` (one batch shares one `received`); beacons have only the collector's time. `~` marks a
// day with under 30 opens on that device: its conversion is +-15 points and not worth reacting to.

import { CATEGORY, PASS, rangeText, scoreDay } from './cgBenchmarks.mjs';
import { battleSecs, CONVERT_SECS, deviceOf, runsOf, sessionSecs, sessionSpans } from './playtestMetrics.mjs';

const DAY = 86_400_000;

/** Fewer opens than this on a device-day: noisy. */
export const NOISY_OPENS = 30;

/** CG judges the last 7 days. */
export const WINDOW_DAYS = 7;

/** The UTC date of a timestamp, 'YYYY-MM-DD'. */
export const dayOf = (ts) => new Date(ts).toISOString().slice(0, 10);

const DEVICES = ['desktop', 'touch'];

/**
 * Which events a scorecard reads: `{ host: 'crazygames' }` for the portal (events' `platform`,
 * beacons' `host`), `{ src: 'reddit' }` for a playtest source on any host.
 */
const matcher = (filter) => (e) =>
  (filter.host === undefined || (e.name === 'beacon' ? e.host : e.platform) === filter.host) && (filter.src === undefined || e.src === filter.src);

/**
 * The daily rows of the events `filter` picks out: { days, window, newestDay, opens }.
 * `days` has a row per day x device with any data, oldest first; `window` a row per device over
 * the last 7 complete days (null when there are none yet); `opens` all opens so far (CG's plays,
 * for the 500 mark). `category` picks the benchmarks the scores come from.
 */
export function dailyRows(events, filter = {}, category = CATEGORY) {
  const keep = matcher(filter);
  const picked = events.filter(keep);
  // the data's "now": the collector's clock where there is one, so a device clock ahead cannot move it
  const newest = events.reduce((m, e) => Math.max(m, e.received ?? e.ts ?? 0), 0);
  const newestDay = newest ? dayOf(newest) : null;

  // sessions by their session_start
  const starts = new Map(); // sid -> { uid, date, ts, device, build, isNew, localDay }
  for (const e of picked) {
    if (e.name !== 'session_start' || !e.sid || starts.has(e.sid)) continue;
    starts.set(e.sid, { uid: e.uid, date: dayOf(e.ts), ts: e.ts, device: deviceOf(e.props ?? {}), build: e.build ?? '?', isNew: e.session === 1, localDay: e.day });
  }
  const battle = new Map(); // sid -> battle seconds
  for (const r of runsOf(picked).values()) battle.set(r.sid, (battle.get(r.sid) ?? 0) + battleSecs(r));
  const spans = sessionSpans(picked);

  // new players: the day and device of their first session, their install-day time and whether day 1 came
  const players = new Map(); // uid -> { date, device, ts, secs, back }
  for (const s of starts.values()) if (s.isNew && !players.has(s.uid)) players.set(s.uid, { date: s.date, device: s.device, ts: s.ts, secs: 0, back: false });
  for (const [sid, s] of starts) {
    const p = players.get(s.uid);
    if (!p) continue;
    if (s.localDay === 0 && spans.has(sid)) p.secs += sessionSecs(spans.get(sid));
    if (s.localDay === 1) p.back = true;
  }

  const opens = picked.filter((e) => e.name === 'beacon' && e.step?.startsWith('open_'));
  const deviceOfBeacon = (b) => (b.step.endsWith('_touch') ? 'touch' : 'desktop');

  /** One row over the days `inDays` lets through, for one device. */
  const row = (label, device, inDays, partialD1 = false) => {
    const sessions = [...starts].filter(([, s]) => s.device === device && inDays(s.date));
    const fresh = [...players.values()].filter((p) => p.device === device && inDays(p.date));
    const eligible = fresh.filter((p) => newest - p.ts >= 2 * DAY);
    const nOpens = opens.filter((b) => deviceOfBeacon(b) === device && inDays(dayOf(b.ts))).length;
    const converted = sessions.filter(([sid]) => (battle.get(sid) ?? 0) >= CONVERT_SECS).length;
    const builds = new Map();
    for (const [, s] of sessions) builds.set(s.build, (builds.get(s.build) ?? 0) + 1);
    const values = {
      conversion: nOpens ? converted / nOpens : null,
      playtime: fresh.length ? fresh.reduce((sum, p) => sum + p.secs, 0) / fresh.length / 60 : null,
      // D1 once every new player of these days could have come back (the window: those who could)
      d1: eligible.length && (partialD1 || eligible.length === fresh.length) ? eligible.filter((p) => p.back).length / eligible.length : null,
    };
    return {
      label,
      device,
      opens: nOpens,
      newPlayers: fresh.length,
      converted,
      d1Back: eligible.filter((p) => p.back).length,
      d1Eligible: eligible.length,
      d1Waiting: fresh.length - eligible.length,
      plays: sessions.length,
      builds: [...builds].sort((a, b) => b[1] - a[1]).map(([build, n]) => ({ build, n })),
      noisy: nOpens < NOISY_OPENS,
      ...values,
      score: scoreDay(values, device, category),
      actionScore: scoreDay(values, device, 'action'),
    };
  };

  const dates = new Set([...starts.values()].map((s) => s.date));
  for (const b of opens) dates.add(dayOf(b.ts));
  const days = [];
  for (const date of [...dates].sort()) {
    for (const device of DEVICES) {
      const r = row(date, device, (d) => d === date);
      if (r.opens || r.plays) days.push({ ...r, partial: date === newestDay });
    }
  }

  // the window: the 7 days before the newest (still running) day
  let window = null;
  if (newestDay && [...dates].some((d) => d < newestDay)) {
    const end = Date.parse(newestDay);
    const from = dayOf(end - WINDOW_DAYS * DAY);
    window = DEVICES.map((device) => row(`${from.slice(5)}..${dayOf(end - DAY).slice(5)}`, device, (d) => d >= from && d < newestDay, true));
  }

  return { days, window, newestDay, opens: opens.length };
}

/** Prints the scorecard of `dailyRows`; `title` says whose numbers they are. */
export function printDaily(result, title, log = console.log, category = CATEGORY) {
  log(`\n== Basic Launch daily: ${title} (CG benchmarks: ${category}; a platform passes at ${PASS}/15) ==`);
  if (!result.days.length) {
    log('no data');
    return;
  }
  log(`days are UTC; [n] = CG points 0-5, [a-b] = not known yet (scripts/cgBenchmarks.mjs); ~ = under ${NOISY_OPENS} opens, noisy; * = day still running`);
  log(`conv = sessions with >= ${CONVERT_SECS}s of battle / opens; play = min per new player on their install day; D1 waits until every new player is 2 days old`);
  const showAction = category !== 'action';
  log(`day          device   opens  new  conv                 play          D1                 plays  score/15     ${showAction ? 'action    ' : ''}build`);
  const pct = (x) => `${(100 * x).toFixed(1)}%`;
  const cell = (text, score) => `${text}${score ? ` [${rangeText(score)}]` : ''}`;
  const line = (r) => {
    const conv = r.conversion === null ? `- (${r.converted})` : `${cell(pct(r.conversion), r.conversion > 1 ? null : r.score.conversion)}${r.conversion > 1 ? '!' : ''} ${r.converted}/${r.opens}`;
    const play = r.playtime === null ? '-' : cell(`${r.playtime.toFixed(1)}m`, r.score.playtime);
    const d1 = r.newPlayers === 0 ? '-' : r.d1 === null ? `wait (${r.d1Waiting})` : `${cell(pct(r.d1), r.score.d1)} ${r.d1Back}/${r.d1Eligible}`;
    const verdict = (s) => `${rangeText(s.total)}${s.pass === true ? ' pass' : s.pass === false ? ' fail' : ' ?'}`;
    const build = r.builds.length ? `${r.builds[0].build}${r.builds.length > 1 ? ` +${r.builds.length - 1}` : ''}` : '-';
    const label = `${r.label}${r.partial ? '*' : ''}`;
    log(
      `${label.padEnd(13)}${r.device.padEnd(8)}${String(r.opens).padStart(6)}${r.noisy ? '~' : ' '}${String(r.newPlayers).padStart(4)}  ${conv.padEnd(21)}${play.padEnd(14)}${d1.padEnd(19)}${String(r.plays).padStart(5)}  ${verdict(r.score).padEnd(13)}${showAction ? verdict(r.actionScore).padEnd(10) : ''}${build}`,
    );
  };
  for (const r of result.days) line(r);
  if (result.window) {
    log(`-- last ${WINDOW_DAYS} complete days (what CG judges once Basic Launch ends) --`);
    for (const r of result.window) line(r);
  }
  log(`opens so far: ${result.opens} (Basic Launch can end once there are 500 plays and 7 days have passed)`);
}
