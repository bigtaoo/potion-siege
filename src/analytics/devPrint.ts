import type { Props } from './analytics';

/**
 * Prints a frame (`perf`) or stall/error (`anomaly`) report to the console in a development
 * build. There the reports otherwise go only to the in-memory sink, and only once the player has
 * said yes to sharing, and anomalies stop at the cap: a stall felt while testing left no trace.
 * Prints past the cap too. Nothing in a release build or under the tests.
 */
export function devPrint(name: 'perf' | 'anomaly', props: Props): void {
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') console.info(`[${name}] ${JSON.stringify(props)}`);
}
