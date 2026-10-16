import type { Prng } from './prng';

// Picks over a Prng, for the battle's dice (the old float Rng's pick and sample, on integers).

/** One of `items`, uniformly; undefined for none. */
export function pick<T>(rng: Prng, items: readonly T[]): T {
  return items[items.length > 0 ? rng.int(items.length) : 0];
}

/** k distinct items, in random order. */
export function sample<T>(rng: Prng, items: readonly T[], k: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < k && pool.length > 0) out.push(pool.splice(rng.int(pool.length), 1)[0]);
  return out;
}
