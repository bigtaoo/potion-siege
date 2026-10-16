// Retention / funnel report from collector NDJSON.  npm run report -- telemetry/events.ndjson
//
// D1/D7 here = share of players whose `session_start` shows up on calendar day 1 / 7 after their
// first one (the classic "came back that day" definition), counted only for cohorts old enough.

import { readFileSync } from 'node:fs';
import { perfSummary, printPerf } from './perfSummary.mjs';

const file = process.argv[2] || 'telemetry/events.ndjson';
const events = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');
const median = (xs) => {
  if (!xs.length) return '-';
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};
const DAY = 86_400_000;
const newest = Math.max(...events.map((e) => e.ts));

// --- players and retention ---
const players = new Map(); // uid -> { installTs, days:Set }
for (const e of events) {
  if (e.name !== 'session_start') continue;
  const p = players.get(e.uid) ?? { installTs: Infinity, days: new Set() };
  p.days.add(e.day);
  if (e.day === 0) p.installTs = Math.min(p.installTs, e.ts);
  players.set(e.uid, p);
}
const installs = [...players.values()].filter((p) => p.installTs < Infinity);
console.log(`\n== Retention (${installs.length} new players, ${players.size} total) ==`);
for (const d of [1, 2, 3, 7, 14, 30]) {
  const eligible = installs.filter((p) => newest - p.installTs >= (d + 1) * DAY);
  const back = eligible.filter((p) => p.days.has(d));
  console.log(`D${d}`.padEnd(5), pct(back.length, eligible.length).padStart(7), `  (${back.length}/${eligible.length})`);
}

// --- first-session funnel ---
const firstSession = (name) => new Set(events.filter((e) => e.name === name && e.session === 1).map((e) => e.uid));
const newUids = new Set(events.filter((e) => e.name === 'session_start' && e.session === 1).map((e) => e.uid));
console.log(`\n== First-session funnel (${newUids.size} players) ==`);
for (const step of ['session_start', 'first_tap_start', 'first_summon', 'first_merge', 'first_level_up', 'run_end', 'run_start']) {
  const set = step === 'run_start'
    ? new Set(events.filter((e) => e.name === 'run_start' && e.session === 1 && e.props.cause === 'again').map((e) => e.uid))
    : firstSession(step);
  const label = step === 'run_start' ? 'second run' : step;
  console.log(label.padEnd(16), pct(set.size, newUids.size).padStart(7), `  (${set.size})`);
}

// --- session length ---
const sessionSecs = events.filter((e) => e.name === 'session_end').map((e) => e.props.secs);
console.log(`\n== Sessions ==\nmedian length ${median(sessionSecs)}s over ${sessionSecs.length} ended sessions`);

// --- run outcomes and where runs end ---
const ends = events.filter((e) => e.name === 'run_end' || e.name === 'run_quit');
const finals = new Map(); // one row per (uid, run): the last report wins (revived runs report twice)
for (const e of ends) finals.set(`${e.uid}:${e.props.run}`, e.props);
const runs = [...finals.values()];
const wins = runs.filter((r) => r.result === 'won').length;
const quits = runs.filter((r) => r.result === 'quit').length;
console.log(`\n== Runs (${runs.length}) ==\nwon ${pct(wins, runs.length)}  quit mid-run ${pct(quits, runs.length)}  median ${median(runs.map((r) => r.secs))}s`);
const byWave = new Map();
for (const r of runs) byWave.set(r.wave, (byWave.get(r.wave) ?? 0) + 1);
console.log('ended at wave:');
for (const [w, n] of [...byWave].sort((a, b) => a[0] - b[0])) console.log(`  ${String(w).padStart(2)} ${'#'.repeat(Math.ceil((40 * n) / runs.length))} ${n}`);

// --- skills and ads ---
const picks = new Map();
const offers = new Map();
for (const e of events.filter((e) => e.name === 'skill_pick')) {
  picks.set(e.props.id, (picks.get(e.props.id) ?? 0) + 1);
  for (const o of e.props.offered) offers.set(o, (offers.get(o) ?? 0) + 1);
}
console.log('\n== Skill pick rate (picked / offered) ==');
for (const [id, n] of [...offers].sort((a, b) => (picks.get(b[0]) ?? 0) / b[1] - (picks.get(a[0]) ?? 0) / a[1])) {
  console.log(`  ${id.padEnd(15)} ${pct(picks.get(id) ?? 0, n).padStart(7)}  (${picks.get(id) ?? 0}/${n})`);
}
const adOffers = events.filter((e) => e.name === 'ad_offer').length;
const adOk = events.filter((e) => e.name === 'ad_result' && e.props.ok).length;
console.log(`\n== Ads ==\nrevive offered ${adOffers}, watched ${adOk} (${pct(adOk, adOffers)}), midgame ${events.filter((e) => e.name === 'ad_midgame').length}`);

printPerf(perfSummary(events));
