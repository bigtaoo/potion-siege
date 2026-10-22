// Reading stored saves: numbers that can be trusted, and the fields a newer build wrote that
// this one does not know, carried through so a rollback (an older OTA bundle) never erases them
// (only for a save of a higher version: see parseMeta).

/** `v` as a whole number in [min, max]; `fallback` for anything that is not a finite number
 *  ("Infinity", NaN, an object). */
export function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function plain(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** `parsed` over the stored `raw`: every field this build reads comes from `parsed`, every other
 *  one stays as it was stored, at the top level and one level down. */
export function carry<T extends object>(raw: Record<string, unknown>, parsed: T): T {
  const out: Record<string, unknown> = { ...raw, ...parsed };
  for (const [k, v] of Object.entries(parsed)) if (plain(v) && plain(raw[k])) out[k] = { ...raw[k], ...v };
  return out as T;
}
