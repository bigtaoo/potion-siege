import type { Sink, TrackedEvent } from './analytics';
import { BATCH_EVENTS, batches } from './batches';

/** Logs every event; for development. */
export class ConsoleSink implements Sink {
  send(events: TrackedEvent[]): void {
    for (const e of events) console.debug(`[track] ${e.name}`, e.props, `day ${e.day} session ${e.session}`);
  }
}

/** Keeps the last events in memory, e.g. for tests or `__game.analytics` inspection in dev. */
export class MemorySink implements Sink {
  readonly events: TrackedEvent[] = [];

  send(events: TrackedEvent[]): void {
    this.events.push(...events);
    if (this.events.length > 500) this.events.splice(0, this.events.length - 500);
  }
}

/**
 * Batches events and POSTs them as JSON arrays to a collector (see scripts/collector.mjs), in
 * requests of at most 50 events and 32 KB (batches.ts). While the page is up a plain fetch sends
 * them, which has no size quota, so the up to 1000 events held until the player answers the
 * privacy question go out whole. Only `flush`, when the page is going away, uses sendBeacon (or a
 * keepalive fetch), which survives the tab closing but shares about 64 KB in flight per page.
 */
export class BeaconSink implements Sink {
  private queue: TrackedEvent[] = [];

  constructor(
    private readonly url: string,
    intervalMs = 15_000,
  ) {
    setInterval(() => this.post(), intervalMs);
  }

  send(events: TrackedEvent[]): void {
    this.queue.push(...events);
    if (this.queue.length >= BATCH_EVENTS) this.post();
  }

  /** Sends the queue with plain fetches, one per batch. */
  private post(): void {
    const bodies = batches(this.queue);
    this.queue = [];
    // text/plain (a string body's type) avoids a CORS preflight
    for (const body of bodies) void fetch(this.url, { method: 'POST', body, mode: 'no-cors' }).catch(() => {});
  }

  /**
   * The page is going away: beacons, batch by batch, until the browser refuses one, which then
   * tries a keepalive fetch. What is left stays queued, for the next tick if the page was only
   * hidden.
   */
  flush(): void {
    const bodies = batches(this.queue);
    this.queue = [];
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (navigator.sendBeacon?.(this.url, new Blob([body], { type: 'text/plain' }))) continue;
      void fetch(this.url, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {});
      for (const rest of bodies.slice(i + 1)) this.queue.push(...(JSON.parse(rest) as TrackedEvent[]));
      return;
    }
  }
}
