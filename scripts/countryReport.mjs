// The Countries block of `npm run report`: where players and page loads come from, by the
// `country` the collector stamps on each line from Cloudflare (scripts/collectorLimits.mjs
// countryOf). Lines from before 2026-10-29 have none and count as '?'. A player belongs to the
// first country seen for them; a session plays a minute once an `alive` beat or its `session_end`
// counts 60 s on screen (`vis`).

const UNKNOWN = '?';

/** One row per country, most players first: loads (checkpoints), players, new players, sessions, minute sessions, first wins. */
export function countryRows(events) {
  const rows = new Map();
  const row = (c) => {
    const key = c ?? UNKNOWN;
    if (!rows.has(key)) rows.set(key, { country: key, loads: 0, players: new Set(), fresh: new Set(), sessions: new Set(), minute: new Set(), wins: new Set() });
    return rows.get(key);
  };
  const home = new Map(); // uid -> first country seen
  for (const e of [...events].sort((a, b) => a.ts - b.ts)) {
    if (e.name === 'beacon') {
      if (String(e.step).startsWith('loaded_')) row(e.country).loads++;
      continue;
    }
    if (!e.uid) continue;
    if (!home.has(e.uid)) home.set(e.uid, e.country);
    const r = row(home.get(e.uid));
    r.players.add(e.uid);
    if (e.sid) r.sessions.add(e.sid);
    if (e.name === 'session_start' && e.day === 0) r.fresh.add(e.uid);
    if (e.sid && (e.name === 'alive' || e.name === 'session_end') && Number(e.props?.vis) >= 60) r.minute.add(e.sid);
    if (e.name === 'first_win') r.wins.add(e.uid);
  }
  return [...rows.values()]
    .map((r) => ({ country: r.country, loads: r.loads, players: r.players.size, fresh: r.fresh.size, sessions: r.sessions.size, minute: r.minute.size, wins: r.wins.size }))
    .sort((a, b) => b.players - a.players || b.loads - a.loads || a.country.localeCompare(b.country));
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-');

export function printCountries(rows, log = console.log) {
  if (!rows.some((r) => r.country !== UNKNOWN)) return;
  log('\n== Countries (Cloudflare, first seen per player) ==');
  log(`${'country'.padEnd(8)}${'loads'.padStart(6)}${'players'.padStart(8)}${'new'.padStart(6)}${'sess'.padStart(6)}${'60s+'.padStart(6)}${'won1'.padStart(6)}`);
  for (const r of rows) {
    log(`${r.country.padEnd(8)}${String(r.loads).padStart(6)}${String(r.players).padStart(8)}${String(r.fresh).padStart(6)}${String(r.sessions).padStart(6)}${pct(r.minute, r.sessions).padStart(6)}${pct(r.wins, r.players).padStart(6)}`);
  }
}
