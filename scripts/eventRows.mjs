// Reads collector NDJSON for the report scripts (report.mjs and what it calls). The file holds what
// anyone could post before the collector checked events, and a line can be cut short, so a row
// the reports cannot use is skipped and counted, not thrown on: one that is not JSON or not an
// object, without a string name, with a ts that is not a finite number Date can show, or with a
// uid, sid, build, platform or src that is not a string. Strings anywhere in a row lose their
// control characters, so a crafted one cannot rewrite the terminal the report is read in.

const CONTROLS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
/** Date's own range, ±8.64e15 ms. */
const MAX_TS = 8.64e15;
const STRINGS = ['uid', 'sid', 'build', 'platform', 'src'];

/** `v` with control characters in every string, keys included, blanked. */
export function clean(v) {
  if (typeof v === 'string') return v.replace(CONTROLS, ' ');
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [clean(k), clean(x)]));
  return v;
}

/** Whether a parsed row is one the reports can read. */
export function usable(e) {
  return (
    !!e &&
    typeof e === 'object' &&
    !Array.isArray(e) &&
    typeof e.name === 'string' &&
    typeof e.ts === 'number' &&
    Math.abs(e.ts) <= MAX_TS &&
    STRINGS.every((k) => e[k] === undefined || typeof e[k] === 'string') &&
    (e.props === undefined || (!!e.props && typeof e.props === 'object' && !Array.isArray(e.props)))
  );
}

/** The usable rows of an NDJSON text, cleaned, and how many lines were skipped. */
export function parseEvents(text) {
  const events = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    if (usable(e)) events.push(clean(e));
    else skipped++;
  }
  return { events, skipped };
}
