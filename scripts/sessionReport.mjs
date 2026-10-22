// The Sessions block of `npm run report`: how long sessions last, one row per session (a page
// restored from the back/forward cache can send `session_end` again, with the larger total), and,
// for builds with the `alive` beat (src/analytics/heartbeat.ts), the time on screen CrazyGames
// counts and the sessions whose page died with no `session_end`, by where their last beat was.

import { sessionSecs, sessionSpans } from './playtestMetrics.mjs';

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/** The block's numbers. */
export function sessionStats(events) {
  const spans = sessionSpans(events, (e) => e.name !== 'beacon');
  const ended = [...spans.values()].filter((s) => s.ended);
  const beating = [...spans.values()].filter((s) => s.vis !== null);
  // the last beat of each session that never sent session_end: where its page died
  const lastBeat = new Map();
  for (const e of events) if (e.name === 'alive' && e.sid && (lastBeat.get(e.sid)?.props?.vis ?? -1) <= Number(e.props?.vis)) lastBeat.set(e.sid, e);
  const died = new Map();
  for (const [sid, s] of spans) {
    const b = lastBeat.get(sid);
    if (s.ended || !b) continue;
    const p = b.props ?? {};
    const at = p.place === 'run' || p.place === 'results' ? `${p.place} s${p.stage ?? '?'}w${p.wave ?? '?'}` : String(p.place ?? '?');
    died.set(at, (died.get(at) ?? 0) + 1);
  }
  return {
    ended: ended.length,
    endedMedian: median(ended.map((s) => s.secs)),
    beating: beating.length,
    visMedian: median(beating.map((s) => Math.round(sessionSecs(s)))),
    visMean: beating.length ? beating.reduce((n, s) => n + sessionSecs(s), 0) / beating.length / 60 : null,
    died: [...died].sort((a, b) => b[1] - a[1]),
  };
}

export function printSessions(st, log = console.log) {
  log(`\n== Sessions ==\nmedian length ${st.endedMedian ?? '-'}s over ${st.ended} ended sessions (wall clock, hidden time included)`);
  if (!st.beating) return;
  log(`on screen (alive beat): median ${st.visMedian}s, mean ${st.visMean.toFixed(1)} min over ${st.beating} sessions`);
  const n = st.died.reduce((sum, [, c]) => sum + c, 0);
  if (n) log(`page died with no session_end: ${n}, last beat at ${st.died.slice(0, 8).map(([at, c]) => `${at} x${c}`).join(', ')}`);
}
