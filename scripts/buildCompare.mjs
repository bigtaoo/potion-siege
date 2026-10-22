// `npm run report -- <file> --compare <host>`: a new upload's first hours beside the build before
// it (Holy Kicker's tools/launch_check.mjs, 0af6559). The host's two newest builds, by the first
// new player each had; each new player's events only up to the same age after their install for
// both builds (the time the newer build has been out, or --hours), so a build out for a week does
// not look better than one out since this morning. Per build and device (desktop / touch):
//
//   new          players whose first session ran that build
//   launches     their session starts within the window
//   conv         first sessions with >= 60 s of battle, of new players (the conversion proxy)
//   play         mean minutes on screen per new player within the window (playtestMetrics sessionSecs)
//   run 2        started a second run
//   no end       runs with neither run_end nor run_quit (a page killed mid-run), with the wave the
//                last `alive` beat or wave_start saw, s<stage>w<wave>
//   stalls       `anomaly` stall reports per new player; errors the same for error + rejection
//
// Events are placed by the device's `ts`. Builds are the `build` field (scripts/buildId.mjs).

import { battleSecs, CONVERT_SECS, deviceOf, runsOf, sessionSecs, sessionSpans } from './playtestMetrics.mjs';

const HOUR = 3_600_000;
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-');

/** The two newest builds `host` had new players on, newest first, with when each first did. */
export function newestBuilds(events, host) {
  const first = new Map(); // build -> ts of its first new player
  for (const e of events) {
    if (e.name !== 'session_start' || e.session !== 1 || e.platform !== host) continue;
    const b = e.build ?? '?';
    first.set(b, Math.min(first.get(b) ?? Infinity, e.ts));
  }
  return [...first].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([build, since]) => ({ build, since }));
}

/** One row per build x device over the same age; `hours` overrides the window. */
export function compareBuilds(events, host, hours = null) {
  const builds = newestBuilds(events, host);
  if (builds.length < 2) return { builds, hours: 0, rows: [] };
  const newest = events.reduce((m, e) => Math.max(m, e.ts ?? 0), 0);
  const age = (hours ?? (newest - builds[0].since) / HOUR) * HOUR;
  const players = new Map(); // uid -> { build, device, installTs, sid }
  for (const e of events) {
    if (e.name !== 'session_start' || e.session !== 1 || e.platform !== host || players.has(e.uid)) continue;
    if (builds.some((b) => b.build === e.build)) players.set(e.uid, { build: e.build, device: deviceOf(e.props ?? {}), installTs: e.ts, sid: e.sid });
  }
  // a player's events up to the same age after their install
  const picked = events.filter((e) => players.has(e.uid) && e.ts - players.get(e.uid).installTs <= age);
  const spans = sessionSpans(picked);
  const runs = [...runsOf(picked).values()];
  const lastSeen = new Map(); // sid -> the last wave and stage an `alive` beat reported
  for (const e of picked) if (e.name === 'alive' && e.props?.wave !== undefined) lastSeen.set(e.sid, e.props);

  const rows = [];
  for (const { build } of builds) {
    for (const device of ['desktop', 'touch']) {
      const uids = [...players].filter(([, p]) => p.build === build && p.device === device).map(([uid]) => uid);
      if (!uids.length) continue;
      const mine = new Set(uids);
      const firstSids = new Set(uids.map((u) => players.get(u).sid));
      const myRuns = runs.filter((r) => mine.has(r.uid));
      const battle = new Map(); // first session's battle seconds per player
      for (const r of myRuns) if (firstSids.has(r.sid)) battle.set(r.uid, (battle.get(r.uid) ?? 0) + battleSecs(r));
      const open = myRuns.filter((r) => !r.final);
      const count = (pred) => picked.filter((e) => mine.has(e.uid) && pred(e)).length;
      rows.push({
        build,
        device,
        players: uids.length,
        launches: count((e) => e.name === 'session_start'),
        converted: [...battle.values()].filter((s) => s >= CONVERT_SECS).length,
        playMinutes: [...spans.values()].filter((s) => mine.has(s.uid)).reduce((n, s) => n + sessionSecs(s), 0) / uids.length / 60,
        run2: new Set(myRuns.filter((r) => r.run >= 2).map((r) => r.uid)).size,
        noEnd: open.length,
        noEndAt: open.map((r) => {
          const beat = lastSeen.get(r.sid);
          return `s${r.stage ?? beat?.stage ?? '?'}w${Math.max(r.lastWave, Number(beat?.wave) || 0)}`;
        }),
        stalls: count((e) => e.name === 'anomaly' && e.props?.kind === 'stall'),
        errors: count((e) => e.name === 'anomaly' && (e.props?.kind === 'error' || e.props?.kind === 'rejection')),
      });
    }
  }
  return { builds, hours: age / HOUR, rows };
}

export function printCompare(host, cmp, log = console.log) {
  log(`\n== ${host}: newest build vs the one before, first ${cmp.hours.toFixed(1)} h after each install ==`);
  if (cmp.builds.length < 2) return log(`needs two builds with new players on ${host}; found ${cmp.builds.length}`);
  log(`${'build'.padEnd(26)}${'device'.padEnd(9)}${'new'.padStart(5)}${'launch'.padStart(8)}${'conv'.padStart(7)}${'play'.padStart(8)}${'run 2'.padStart(7)}${'no end'.padStart(8)}${'stall'.padStart(7)}${'error'.padStart(7)}`);
  for (const r of cmp.rows) {
    const at = r.noEndAt.length ? `  ${[...new Set(r.noEndAt)].slice(0, 4).join(' ')}` : '';
    log(
      `${r.build.slice(0, 25).padEnd(26)}${r.device.padEnd(9)}${String(r.players).padStart(5)}${String(r.launches).padStart(8)}${pct(r.converted, r.players).padStart(7)}${`${r.playMinutes.toFixed(1)}m`.padStart(8)}${pct(r.run2, r.players).padStart(7)}${String(r.noEnd).padStart(8)}${(r.stalls / r.players).toFixed(1).padStart(7)}${(r.errors / r.players).toFixed(1).padStart(7)}${at}`,
    );
  }
}
