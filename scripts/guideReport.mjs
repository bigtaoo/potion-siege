// The new-player guide's funnel for `npm run report`: each home guide step and one-time word in
// battle (src/game/homeGuide.ts, battleTips.ts) in the order a player meets them, and how its
// `guide_step` went, one per player: done, skipped, gone round (other) or passed over (none:
// nothing to do then), with the median seconds it was up before the player acted.

/** The steps in the order a player meets them (src/sim/guide.ts). */
export const GUIDE_ORDER = [
  'gift', 'upgrade', 'upgradeMore', 'upgradeLast', 'bossCard', 'toBattle1',
  'upgrade2', 'castTip', 'stars', 'login', 'tasks', 'heroes2', 'workshop', 'toBattle2',
  'pickTip', 'flyerTip', 'codex', 'shop', 'heroes3', 'challenge', 'toBattle3',
  'speedTip', 'lineup', 'sieve', 'starChest', 'chapterChest', 'hard', 'endless',
];
const RESULTS = ['done', 'skipped', 'other', 'none'];

/** One row per step any player reached: players, each result's count, the median wait. */
export function guideRows(events) {
  const first = new Map(); // `${uid}:${id}` -> props, the first report only
  for (const e of events) {
    if (e.name !== 'guide_step' || !e.uid) continue;
    const key = `${e.uid}:${e.props?.id}`;
    if (!first.has(key)) first.set(key, e.props ?? {});
  }
  const rows = [];
  for (const id of GUIDE_ORDER) {
    const all = [...first.values()].filter((p) => p.id === id);
    if (!all.length) continue;
    const row = { id, players: all.length };
    for (const r of RESULTS) row[r] = all.filter((p) => p.result === r).length;
    const waits = all.filter((p) => p.result !== 'none' && typeof p.waitS === 'number' && p.waitS > 0).map((p) => p.waitS).sort((a, b) => a - b);
    row.medianWait = waits.length ? waits[Math.floor(waits.length / 2)] : null;
    rows.push(row);
  }
  return rows;
}

export function printGuide(rows, log = console.log) {
  if (!rows.length) return;
  log('\n== New-player guide (guide_step, one per player) ==');
  log(`${'step'.padEnd(13)}${'players'.padStart(8)}${RESULTS.map((r) => r.padStart(9)).join('')}   wait`);
  for (const r of rows) {
    const wait = r.medianWait === null ? '-' : `${r.medianWait}s`;
    log(`${r.id.padEnd(13)}${String(r.players).padStart(8)}${RESULTS.map((k) => String(r[k]).padStart(9)).join('')}   ${wait}`);
  }
}
