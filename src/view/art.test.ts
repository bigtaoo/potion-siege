import { describe, expect, it, vi } from 'vitest';
import { LINEUP } from '../sim/types';
import { ART_TIERS } from './art';

describe('art tiers', () => {
  const all = [...ART_TIERS.FIRST, ...ART_TIERS.SOON, ...ART_TIERS.LATER].map((f) => `${f}.webp`);

  it('fetch every file in public/art once, but the later chapters\' fields (loadField)', () => {
    const files = Object.keys(import.meta.glob('../../public/art/*', { query: '?url' }))
      .map((p) => p.split('/').pop()!)
      .filter((f) => !/^bg_/.test(f) || f === 'bg_field.webp');
    expect([...all].sort()).toEqual(files.sort());
    expect(new Set(all).size).toBe(all.length);
  });

  it('wait for what the first battle shows at once, and only that', () => {
    expect([...ART_TIERS.FIRST].sort()).toEqual(['bg_field', 'commander', 'enemy_grunt', 'tutorial_hand', ...LINEUP.map((k) => `potion_${k}_body`)].sort());
  });
});

describe('loaded art', () => {
  it('opts out of Pixi\'s texture GC, first battle, rest and chapter fields alike', async () => {
    const { Assets } = await import('pixi.js');
    const { loadArt, loadField, restOfArt } = await import('./art');
    const made: { source: { autoGarbageCollect: boolean } }[] = [];
    vi.spyOn(Assets, 'load').mockImplementation(async () => {
      const t = { source: { autoGarbageCollect: true }, height: 1 };
      made.push(t);
      return t as never;
    });
    await loadArt();
    await restOfArt();
    await loadField('bg_snow');
    expect(made.length).toBe(ART_TIERS.FIRST.length + ART_TIERS.SOON.length + ART_TIERS.LATER.length + 1);
    expect(made.every((t) => !t.source.autoGarbageCollect)).toBe(true);
  });
});
