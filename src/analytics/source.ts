// Where a player came from, recorded once on the first visit and kept in the player record
// (analytics.ts): the playtest's links carry `?src=` (or utm_source), a build for a portal that
// strips the query has its own default (scripts/build-zip.mjs), anything else falls back to the
// referring page's host, else `direct`. Only a short tag or a host name, never the referrer's
// path or query. The inline `open_*` beacon (scripts/openBeacon.mjs) does the same in plain
// JS; source.test.ts keeps the two in step.

/** A player record from before sources were recorded. */
export const UNKNOWN_SOURCE = 'unknown';

/** Lower case, letters, digits, `.`, `_` and `-` only, at most 40 characters; '' when nothing is left. */
export function cleanSource(raw: string | null | undefined): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 40);
}

/**
 * The acquisition source of a first visit: `?src=`, else `?utm_source=`, else `fallback` (the
 * build's default), else the referrer's host without `www.` (not when it is this site), else
 * `direct`.
 */
export function sourceOf(search: string, referrer: string, ownHost: string, fallback = ''): string {
  const q = new URLSearchParams(search);
  const tagged = cleanSource(q.get('src')) || cleanSource(q.get('utm_source')) || cleanSource(fallback);
  if (tagged) return tagged;
  let host = '';
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    // no referrer, or not a URL
  }
  if (host && host !== ownHost.toLowerCase().replace(/^www\./, '')) return cleanSource(host) || 'direct';
  return 'direct';
}
