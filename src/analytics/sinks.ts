import type { Sink, TrackedEvent } from './analytics';

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
 * Batches events and POSTs them as a JSON array to a collector (see scripts/collector.mjs).
 * Uses sendBeacon so the last batch survives the tab closing.
 */
export class BeaconSink implements Sink {
  private queue: TrackedEvent[] = [];

  constructor(
    private readonly url: string,
    intervalMs = 15_000,
  ) {
    setInterval(() => this.flush(), intervalMs);
  }

  send(events: TrackedEvent[]): void {
    this.queue.push(...events);
    if (this.queue.length >= 50) this.flush();
  }

  flush(): void {
    if (this.queue.length === 0) return;
    const body = JSON.stringify(this.queue);
    this.queue = [];
    const blob = new Blob([body], { type: 'text/plain' }); // text/plain avoids a CORS preflight
    if (!navigator.sendBeacon?.(this.url, blob)) {
      void fetch(this.url, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {});
    }
  }
}
