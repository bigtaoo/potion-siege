import type { Battle } from './battle';

// State hashing for the replay test and checkReplay (after standing's engine/hash.ts): walks
// the battle in a fixed field order and folds every number into a 32-bit FNV-1a. What is
// worked out from the rest (the setup and the skill multipliers), the event queue and the
// command log are skipped. A non-integer anywhere in the state is a bug (the battle is
// integer-only) and throws, so tests catch a float creeping in.

const SKIP = new Set(['setup', 'mods', 'fixed', 'perks', 'events', 'drained', 'dead', 'commands']);

export function hashBattle(b: Battle): number {
  let h = 0x811c9dc5;
  const num = (v: number, path: string) => {
    if (!Number.isSafeInteger(v)) throw new Error(`non-integer in battle state at ${path}: ${v}`);
    // two 32-bit halves, so values past 2^32 are folded in whole
    const lo = v >>> 0;
    const hi = Math.floor(v / 4294967296) >>> 0;
    h = Math.imul(h ^ lo, 0x01000193);
    h = Math.imul(h ^ hi, 0x01000193);
  };
  const str = (v: string) => {
    for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v.charCodeAt(i), 0x01000193);
  };
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'number') return num(v, path);
    if (typeof v === 'boolean') return num(v ? 1 : 0, path);
    if (typeof v === 'string') return str(v);
    if (v === null || v === undefined) return num(-1, path);
    if (Array.isArray(v)) {
      num(v.length, path);
      v.forEach((x, i) => walk(x, `${path}[${i}]`));
      return;
    }
    if (v instanceof Map) return walk([...v.entries()], path);
    if (typeof v === 'object') {
      // the dice hash by their cursor
      const peek = (v as { peek?: () => number }).peek;
      if (typeof peek === 'function') return num(peek.call(v), path);
      for (const k of Object.keys(v).sort()) {
        if (SKIP.has(k)) continue;
        str(k);
        walk((v as Record<string, unknown>)[k], `${path}.${k}`);
      }
    }
  };
  walk(b, 'battle');
  return h >>> 0;
}
