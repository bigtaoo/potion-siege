// Types for eventRows.mjs, for the tests.

export function clean<T>(v: T): T;
export function usable(e: unknown): boolean;
export function parseEvents(text: string): { events: Record<string, unknown>[]; skipped: number };
