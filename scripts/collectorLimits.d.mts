// The collector's budgets and body reads (collectorLimits.mjs), as its tests use them
// (src/analytics/collectorLimits.test.ts).

export type Rate = 'events' | 'replays' | 'saves';
export const MAX_BODY: number;
export const MAX_REPLAY: number;
export const RATES: Record<Rate, { requests: number; bytes: number }>;
export const BIG_READS: number;
export const BODY_MS: number;
/** The budget a request is charged to, from its method and path alone, or null for none. */
export function rateOf(method: string, url: string): Rate | null;
