// collector.mjs starts the server on import. The tests import it with node:http and node:fs
// mocked (src/analytics/collector.test.ts, collectorSchema.test.ts).

/** The line POST /e stores for one posted event, or null when it is dropped. */
export function cleanEvent(e: unknown, received: number): string | null;
