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

// --- loading: anonymous open/loaded checkpoints (collector GET /b), no id ---
const beacons = events.filter((e) => e.name === 'beacon');
if (beacons.length) {
  console.log('\n== Loading (launches, anonymous) ==');
  console.log('host        device    opened  loaded  loaded/opened  median load ms');
  for (const host of ['crazygames', 'web']) {
    for (const kind of ['desktop', 'touch']) {
      const opened = beacons.filter((e) => e.host === host && e.step === `open_${kind}`).length;
      const loaded = beacons.filter((e) => e.host === host && e.step === `loaded_${kind}`);
      if (!opened && !loaded.length) continue;
      // the web build has no inline open beacon: only its loads count
      const share = host === 'crazygames' ? pct(loaded.length, opened).padStart(13) : '-'.padStart(13);
      console.log(`${host.padEnd(12)}${kind.padEnd(10)}${String(opened).padStart(6)}  ${String(loaded.length).padStart(6)}  ${share}  ${String(median(loaded.flatMap((e) => (e.ms === undefined ? [] : [e.ms])))).padStart(14)}`);
    }
  }
  console.log('opened but never loaded = launches lost to download size, a crash or a closed tab before the first frame');
}

// --- new players by the first build they played (version+commit) ---
const firstBuild = new Map(); // uid -> build of their first session
for (const e of events) if (e.name === 'session_start' && e.session === 1 && !firstBuild.has(e.uid)) firstBuild.set(e.uid, e.build ?? '?');
if (firstBuild.size) {
  const firstsOf = (name) => new Set(events.filter((e) => e.name === name).map((e) => e.uid));
  const input = firstsOf('first_input');
  const merged = firstsOf('first_merge');
  const ran = new Set(events.filter((e) => e.name === 'run_end').map((e) => e.uid));
  const groups = new Map();
  for (const [uid, build] of firstBuild) groups.set(build, [...(groups.get(build) ?? []), uid]);
  console.log('\n== New players by first build played ==');
  console.log('build                   players  input   merge   run end  D1');
  for (const [build, uids] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const n = uids.length;
    const share = (set) => pct(uids.filter((u) => set.has(u)).length, n).padStart(7);
    const p1 = uids.map((u) => players.get(u)).filter((p) => p && p.installTs < Infinity && newest - p.installTs >= 2 * DAY);
    const d1 = pct(p1.filter((p) => p.days.has(1)).length, p1.length);
    console.log(`${build.padEnd(22)}${String(n).padStart(8)} ${share(input)} ${share(merged)} ${share(ran)}  ${d1} (${p1.length})`);
  }
}

// --- first-session funnel ---
const firstSession = (name) => new Set(events.filter((e) => e.name === name && e.session === 1).map((e) => e.uid));
const newUids = new Set(events.filter((e) => e.name === 'session_start' && e.session === 1).map((e) => e.uid));
console.log(`\n== First-session funnel (${newUids.size} players) ==`);
// first_input: the first tap or key (builds before the live first battle sent first_tap_start)
for (const step of ['session_start', 'first_input', 'first_summon', 'first_merge', 'first_level_up', 'run_end', 'run_start']) {
  const set = step === 'run_start'
    ? new Set(events.filter((e) => e.name === 'run_start' && e.session === 1 && e.props.cause === 'again').map((e) => e.uid))
    : firstSession(step);
  const label = step === 'run_start' ? 'second run' : step;
  console.log(label.padEnd(16), pct(set.size, newUids.size).padStart(7), `  (${set.size})`);
}

const assists = events.filter((e) => e.name === 'tutorial_assist');
if (assists.length) {
  const by = new Map();
  for (const e of assists) by.set(e.props.step, (by.get(e.props.step) ?? 0) + 1);
  console.log(`tutorial did it for them: ${[...by].map(([k, n]) => `${k} ${n}`).join(', ')}`);
}

// --- first session, battle 1 to battle 3: who gets how far, and what the result screen's tap was ---
const s1 = events.filter((e) => e.session === 1 && newUids.has(e.uid));
const reached = (pred) => new Set(s1.filter(pred).map((e) => e.uid));
const funnelRow = (label, set, extra = '') => console.log(label.padEnd(24), pct(set.size, newUids.size).padStart(7), `  (${set.size})${extra}`);
console.log(`\n== First session, battles 1-3 (${newUids.size} players) ==`);
funnelRow('loaded', newUids);
funnelRow('first_input', reached((e) => e.name === 'first_input'));
for (const step of ['summon', 'merge', 'upgrade', 'pick']) {
  const rows = s1.filter((e) => e.name === 'tutorial_step' && e.props.step === step);
  if (!rows.length) continue;
  const helped = rows.filter((e) => e.props.by === 'assist').length;
  const secs = median(rows.flatMap((e) => (e.props.shownT === null ? [] : [e.props.doneT - e.props.shownT])));
  funnelRow(`tutorial ${step}`, new Set(rows.map((e) => e.uid)), `  assist ${pct(helped, rows.length)}, median ${secs}s on screen`);
}
const run1 = reached((e) => e.name === 'run_end' && e.props.run === 1);
funnelRow('run 1 end', run1);
const acts = s1.filter((e) => e.name === 'result_action' && e.props.run === 1);
const firstAct = new Map(); // uid -> the first tap on run 1's result
for (const e of acts) if (!firstAct.has(e.uid)) firstAct.set(e.uid, e);
const byAct = new Map();
for (const e of firstAct.values()) byAct.set(e.props.action, [...(byAct.get(e.props.action) ?? []), e.props.secs]);
for (const [action, secs] of byAct) funnelRow(`  result: ${action}`, new Set([...firstAct].filter(([, e]) => e.props.action === action).map(([uid]) => uid)), `  median ${median(secs)}s`);
funnelRow('run 2 start', reached((e) => e.name === 'run_start' && e.props.run === 2));
funnelRow('run 3 start', reached((e) => e.name === 'run_start' && e.props.run === 3));

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

// --- runs on a shared seed: a new player's stage 1 battles until the first win (FIRST_SEED in
// src/sim/meta.ts) all play the same waves, so they compare run for run. A seed more than one
// player has started on is a fixed one (random seeds do not repeat); builds before run_start
// carried the seed have none and are left out.
const starts = events.filter((e) => e.name === 'run_start' && e.props.seed !== undefined);
const seedPlayers = new Map(); // seed -> Set of uids
for (const e of starts) seedPlayers.set(e.props.seed, (seedPlayers.get(e.props.seed) ?? new Set()).add(e.uid));
const shared = [...seedPlayers].filter(([, uids]) => uids.size > 1);
if (shared.length) {
  console.log('\n== Runs on a shared seed (first battles) ==');
  console.log('seed        cause  players  runs   won     quit    median s  median wave  ended at wave');
  for (const [seed] of shared) {
    for (const cause of ['first', 'again']) {
      const rs = starts
        .filter((e) => e.props.seed === seed && e.props.cause === cause)
        .map((e) => finals.get(`${e.uid}:${e.props.run}`))
        .filter(Boolean);
      if (!rs.length) continue;
      const waves = new Map();
      for (const r of rs) waves.set(r.wave, (waves.get(r.wave) ?? 0) + 1);
      const hist = [...waves].sort((a, b) => a[0] - b[0]).map(([w, n]) => `w${w}:${n}`).join(' ');
      const who = new Set(starts.filter((e) => e.props.seed === seed && e.props.cause === cause).map((e) => e.uid)).size;
      const won = rs.filter((r) => r.result === 'won').length;
      const quit = rs.filter((r) => r.result === 'quit').length;
      console.log(
        `${String(seed).padEnd(12)}${cause.padEnd(7)}${String(who).padStart(7)}${String(rs.length).padStart(6)}  ${pct(won, rs.length).padEnd(8)}${pct(quit, rs.length).padEnd(8)}${String(median(rs.map((r) => r.secs))).padStart(8)}  ${String(median(rs.map((r) => r.wave))).padStart(11)}  ${hist}`,
      );
    }
  }
}

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
