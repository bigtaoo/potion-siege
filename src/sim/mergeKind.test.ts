import { describe, expect, it } from 'vitest';
import { Prng } from './math/prng';
import { KEEP_KIND, mergedKind } from './mergeKind';
import type { HeroKind } from './types';

const LINEUP: HeroKind[] = ['fire', 'ice', 'poison', 'lightning'];

describe('mergedKind', () => {
  it('keeps the kind about three times in ten and draws from the lineup otherwise', () => {
    const rng = new Prng(3);
    let kept = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const k = mergedKind(rng, 'ice', LINEUP);
      expect(LINEUP).toContain(k);
      if (k === 'ice') kept++;
    }
    // KEEP_KIND% kept outright, plus a quarter of the rest drawn back to ice
    const want = KEEP_KIND / 100 + (1 - KEEP_KIND / 100) / LINEUP.length;
    expect(kept / N).toBeGreaterThan(want - 0.03);
    expect(kept / N).toBeLessThan(want + 0.03);
  });

  it('is deterministic for a seed', () => {
    const a = new Prng(9), b = new Prng(9);
    for (let i = 0; i < 50; i++) expect(mergedKind(a, 'fire', LINEUP)).toBe(mergedKind(b, 'fire', LINEUP));
  });
});
