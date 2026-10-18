// The playtest table in `npm run report`: new players by the first build they played, then by
// acquisition source (the `src` every event carries, src/analytics/source.ts) and device
// (desktop / touch, the beacons' pointer test), with the numbers CrazyGames scores a Basic
// Launch on, so a playtest before the submission reads like the portal's own dashboard.
//
//   conversion   new players with >= 60 s of battle in their first session / new players'
//                `open_*` beacons of the same build, source and device
//   playtime     mean minutes per new player over all their sessions: per session the longer of
//                `session_end`'s secs and the time between its first and last event
//   D1           back on calendar day 1, of the players whose install is 2+ days before the newest event
//   tutorial     finished the first battle's tutorial without skipping it
//   run 1 end .. run 3 end   the battles 1-3 funnel
//   stage        median / highest campaign stage started
//   quits        runs left mid-battle (`run_quit`, or a run whose end never arrived), and where:
//                s<stage>w<wave>
//   feedback     mean rating (n) from the one-time result-screen question after run 3 (app.ts), and
//                how many closed it or left it unanswered

const DAY = 86_400_000;

/** CrazyGames Basic Launch reference points (the scoring the playtest is read against). */
export const CG = { convDesktop: 0.63, convTouch: 0.2857, playMinutes: 12 };

/** Battle seconds that make a player count as converted. */
export const CONVERT_SECS = 60;

const RUN_EVENTS = new Set(['run_start', 'wave_start', 'skill_pick', 'ad_offer', 'ad_result', 'run_end', 'run_quit']);
const CAMPAIGN = new Set(['first', 'again', 'next']);

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/** desktop or touch for a session_start (`device` since the playtest build, `touch` before). */
const deviceOf = (props) => (props.device === 'touch' || props.device === 'desktop' ? props.device : props.touch ? 'touch' : 'desktop');

/**
 * One row per first build x source x device, plus an '(all)' source row per build and device.
 * `events` is the collector's NDJSON, beacons included.
 */
export function playtestRows(events) {
  const newest = events.reduce((m, e) => Math.max(m, e.ts ?? 0), 0);

  // new players: their first session is in the data
  const players = new Map(); // uid -> { build, src, device, installTs, days }
  for (const e of events) {
    if (e.name !== 'session_start' || e.session !== 1 || players.has(e.uid)) continue;
    players.set(e.uid, { build: e.build ?? '?', src: e.src ?? 'unknown', device: deviceOf(e.props ?? {}), installTs: e.ts, sid: e.sid, days: new Set() });
  }
  for (const e of events) if (e.name === 'session_start' && players.has(e.uid)) players.get(e.uid).days.add(e.day);

  // sessions: span and reported length
  const sessions = new Map(); // sid -> { uid, first, last, secs }
  for (const e of events) {
    if (!e.sid || !players.has(e.uid)) continue;
    const s = sessions.get(e.sid) ?? { uid: e.uid, first: e.ts, last: e.ts, secs: 0 };
    s.first = Math.min(s.first, e.ts);
    s.last = Math.max(s.last, e.ts);
    if (e.name === 'session_end') s.secs = Math.max(s.secs, Number(e.props?.secs) || 0);
    sessions.set(e.sid, s);
  }
  const playSecs = new Map(); // uid -> seconds over all sessions
  for (const s of sessions.values()) playSecs.set(s.uid, (playSecs.get(s.uid) ?? 0) + Math.max(s.secs, (s.last - s.first) / 1000));

  // runs, keyed by session and run number (a run left unfinished is numbered again next session)
  const runs = new Map(); // sid:run -> { uid, sid, stage, cause, start, last, lastWave, final }
  for (const e of events) {
    if (!RUN_EVENTS.has(e.name) || !players.has(e.uid) || typeof e.props?.run !== 'number') continue;
    const key = `${e.sid}:${e.props.run}`;
    const r = runs.get(key) ?? { uid: e.uid, sid: e.sid, run: e.props.run, stage: null, cause: null, start: e.ts, last: e.ts, lastWave: 1, final: null };
    if (e.name === 'run_start') {
      r.stage = e.props.stage ?? null;
      r.cause = e.props.cause ?? null;
      r.start = e.ts;
    }
    if (e.name === 'wave_start') r.lastWave = Math.max(r.lastWave, e.props.wave ?? 1);
    if (e.name === 'run_end' || e.name === 'run_quit') r.final = e.props; // a revived run reports twice: the last wins
    r.last = Math.max(r.last, e.ts);
    runs.set(key, r);
  }
  const battleSecs = (r) => (r.final ? Number(r.final.secs) || 0 : Math.max(0, (r.last - r.start) / 1000));

  const firstSessionBattle = new Map(); // uid -> battle seconds in session 1
  const stage = new Map(); // uid -> highest campaign stage started
  const runsOf = new Map(); // uid -> runs
  for (const r of runs.values()) {
    if (players.get(r.uid).sid === r.sid) firstSessionBattle.set(r.uid, (firstSessionBattle.get(r.uid) ?? 0) + battleSecs(r));
    if (CAMPAIGN.has(r.cause) && r.stage != null) stage.set(r.uid, Math.max(stage.get(r.uid) ?? 0, r.stage));
    runsOf.set(r.uid, [...(runsOf.get(r.uid) ?? []), r]);
  }

  const did = (pred) => new Set(events.filter((e) => players.has(e.uid) && pred(e)).map((e) => e.uid));
  const tutorialDone = did((e) => e.name === 'tutorial_end' && e.props?.skipped === false);
  const run1End = did((e) => e.name === 'run_end' && e.props?.run === 1);
  const run2Start = did((e) => e.name === 'run_start' && e.props?.run === 2);
  const run3Start = did((e) => e.name === 'run_start' && e.props?.run === 3);
  const run3End = did((e) => e.name === 'run_end' && e.props?.run === 3);
  const feedback = new Map(); // uid -> rating
  const skipped = new Set(); // closed or left unanswered
  for (const e of events) {
    if (e.name === 'feedback' && players.has(e.uid) && typeof e.props?.rating === 'number') feedback.set(e.uid, e.props.rating);
    if (e.name === 'feedback_skip' && players.has(e.uid)) skipped.add(e.uid);
  }

  // new players' launches
  const opens = events.filter((e) => e.name === 'beacon' && e.new !== false);

  const keyOf = (build, src, device) => `${build}\u0000${src}\u0000${device}`;
  const cells = new Map();
  const cell = (build, src, device) => {
    const k = keyOf(build, src, device);
    if (!cells.has(k)) cells.set(k, { build, src, device, uids: [], opens: 0, loaded: 0 });
    return cells.get(k);
  };
  for (const [uid, p] of players) for (const src of [p.src, '(all)']) cell(p.build, src, p.device).uids.push(uid);
  for (const b of opens) {
    const device = b.step.endsWith('_touch') ? 'touch' : 'desktop';
    for (const src of [b.src ?? 'unknown', '(all)']) {
      const c = cell(b.build ?? '?', src, device);
      if (b.step.startsWith('open_')) c.opens++;
      else c.loaded++;
    }
  }

  const rows = [];
  for (const c of cells.values()) {
    const count = (set) => c.uids.filter((u) => set.has(u)).length;
    const eligible = c.uids.filter((u) => newest - players.get(u).installTs >= 2 * DAY);
    const cellRuns = c.uids.flatMap((u) => runsOf.get(u) ?? []);
    const quitRuns = cellRuns.filter((r) => !r.final || r.final.result === 'quit');
    const where = new Map();
    for (const r of quitRuns) {
      const at = `s${r.stage ?? '?'}w${r.final?.wave ?? r.lastWave}`;
      where.set(at, (where.get(at) ?? 0) + 1);
    }
    const stages = c.uids.flatMap((u) => (stage.has(u) ? [stage.get(u)] : []));
    const ratings = c.uids.flatMap((u) => (feedback.has(u) ? [feedback.get(u)] : []));
    rows.push({
      build: c.build,
      src: c.src,
      device: c.device,
      players: c.uids.length,
      opens: c.opens,
      loaded: c.loaded,
      converted: c.uids.filter((u) => (firstSessionBattle.get(u) ?? 0) >= CONVERT_SECS).length,
      conversion: c.opens ? c.uids.filter((u) => (firstSessionBattle.get(u) ?? 0) >= CONVERT_SECS).length / c.opens : null,
      playMinutes: c.uids.length ? c.uids.reduce((sum, u) => sum + (playSecs.get(u) ?? 0), 0) / c.uids.length / 60 : null,
      d1: { back: eligible.filter((u) => players.get(u).days.has(1)).length, eligible: eligible.length },
      tutorial: count(tutorialDone),
      run1End: count(run1End),
      run2Start: count(run2Start),
      run3Start: count(run3Start),
      run3End: count(run3End),
      stageMedian: median(stages),
      stageMax: stages.length ? Math.max(...stages) : null,
      runs: cellRuns.length,
      quits: quitRuns.length,
      quitAt: [...where].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
      feedback: { n: ratings.length, mean: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null, skipped: c.uids.filter((u) => skipped.has(u) && !feedback.has(u)).length },
    });
  }

  const buildSize = new Map();
  for (const r of rows) if (r.src === '(all)') buildSize.set(r.build, (buildSize.get(r.build) ?? 0) + r.players + r.opens);
  return rows.sort(
    (a, b) =>
      (buildSize.get(b.build) ?? 0) - (buildSize.get(a.build) ?? 0) ||
      a.build.localeCompare(b.build) ||
      a.device.localeCompare(b.device) ||
      (a.src === '(all)' ? -1 : b.src === '(all)' ? 1 : b.players - a.players || a.src.localeCompare(b.src)),
  );
}

/** Prints the rows as one table per build. */
export function printPlaytest(rows, log = console.log) {
  const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-');
  log('\n== Playtest: new players by source x device (CrazyGames Basic Launch metrics) ==');
  log(`reference: conversion desktop ${CG.convDesktop * 100}% = 3/5, mobile ${CG.convTouch * 100}% = 2/5; avg playtime ${CG.playMinutes} min = 5/5  (+ = meets it)`);
  log('conv over 100% (!) = fewer open beacons than players: the build sent none (dev server, a build from before them) or they were blocked');
  log(`conv = players with >= ${CONVERT_SECS}s of battle in their first session / open beacons of new players; play = mean min/player`);
  const builds = [...new Set(rows.map((r) => r.build))];
  for (const build of builds) {
    log(`\nbuild ${build}`);
    log('source          device   new  opens  load  conv          play    D1         tut   r1end r2    r3    r3end stage   quits       feedback');
    for (const r of rows.filter((x) => x.build === build)) {
      const meets = r.conversion === null ? ' ' : r.conversion > 1 ? '!' : r.conversion >= (r.device === 'touch' ? CG.convTouch : CG.convDesktop) ? '+' : ' ';
      const conv = r.conversion === null ? `- (${r.converted})` : `${pct(r.converted, r.opens)}${meets} ${r.converted}/${r.opens}`;
      const play = r.playMinutes === null ? '-' : `${r.playMinutes.toFixed(1)}${r.playMinutes >= CG.playMinutes ? '+' : ''}`;
      const d1 = r.d1.eligible ? `${pct(r.d1.back, r.d1.eligible)} ${r.d1.back}/${r.d1.eligible}` : '-';
      const share = (n) => pct(n, r.players).padEnd(6);
      const stage = r.stageMedian === null ? '-' : `${r.stageMedian}/${r.stageMax}`;
      const quits = `${pct(r.quits, r.runs)} ${r.quits}/${r.runs}`;
      const fb = `${r.feedback.n ? `${r.feedback.mean.toFixed(1)} (${r.feedback.n})` : '-'}${r.feedback.skipped ? ` skip ${r.feedback.skipped}` : ''}`;
      log(
        `${r.src.slice(0, 15).padEnd(16)}${r.device.padEnd(8)}${String(r.players).padStart(4)}${String(r.opens).padStart(7)}${String(r.loaded).padStart(6)}  ${conv.padEnd(14)}${play.padEnd(8)}${d1.padEnd(11)}${share(r.tutorial)}${share(r.run1End)}${share(r.run2Start)}${share(r.run3Start)}${share(r.run3End)}${stage.padEnd(8)}${quits.padEnd(12)}${fb}`,
      );
      if (r.quitAt.length) log(`${''.padEnd(24)}quit at ${r.quitAt.slice(0, 5).map(([at, n]) => `${at} x${n}`).join(', ')}`);
    }
  }
}

/** The feedback texts, newest first, with source, device and rating. */
export function feedbackLines(events) {
  const device = new Map();
  for (const e of events) if (e.name === 'session_start' && !device.has(e.uid)) device.set(e.uid, deviceOf(e.props ?? {}));
  return events
    .filter((e) => e.name === 'feedback')
    .sort((a, b) => b.ts - a.ts)
    .map((e) => `${new Date(e.ts).toISOString().slice(0, 16)}  ${String(e.props?.rating ?? '-')}/5  ${(e.src ?? 'unknown').padEnd(14)} ${(device.get(e.uid) ?? '?').padEnd(8)} ${e.props?.text ? JSON.stringify(e.props.text) : ''}`);
}
