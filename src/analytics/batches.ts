import type { TrackedEvent } from './analytics';

/** Events per request, at most. */
export const BATCH_EVENTS = 50;
/**
 * Body bytes per request, at most. Beacons and keepalive fetches share about 64 KB in flight per
 * page, and the collector cuts a body off at 64 KB (scripts/collector.mjs MAX_BODY), so half that
 * leaves room for a second batch on the way out.
 */
export const BATCH_BYTES = 32 * 1024;
/** An event this large is dropped here: the collector drops a line over 4 KB, `received` included. */
export const EVENT_BYTES = 4000;

const encoder = new TextEncoder();

/**
 * `events` as request bodies (JSON arrays) of at most BATCH_EVENTS events and BATCH_BYTES bytes,
 * in order, without the events the collector would drop for their size.
 */
export function batches(events: readonly TrackedEvent[]): string[] {
  const out: string[] = [];
  let parts: string[] = [];
  let bytes = 2; // the brackets
  for (const e of events) {
    const json = JSON.stringify(e);
    const size = encoder.encode(json).length;
    if (size > EVENT_BYTES) continue;
    if (parts.length && (parts.length >= BATCH_EVENTS || bytes + 1 + size > BATCH_BYTES)) {
      out.push(`[${parts.join(',')}]`);
      parts = [];
      bytes = 2;
    }
    bytes += (parts.length ? 1 : 0) + size;
    parts.push(json);
  }
  if (parts.length) out.push(`[${parts.join(',')}]`);
  return out;
}
