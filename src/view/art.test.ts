import { describe, expect, it } from 'vitest';
import { LINEUP } from '../sim/types';
import { ART_TIERS } from './art';

describe('art tiers', () => {
  const all = [...ART_TIERS.FIRST, ...ART_TIERS.SOON, ...ART_TIERS.LATER].map((f) => (f.includes('.') ? f : `${f}.png`));

  it('fetch every file in public/art once, but the later chapters\' fields (loadField)', () => {
    const files = Object.keys(import.meta.glob('../../public/art/*', { query: '?url' }))
      .map((p) => p.split('/').pop()!)
      .filter((f) => !/^bg_/.test(f) || f === 'bg_field.jpg');
    expect([...all].sort()).toEqual(files.sort());
    expect(new Set(all).size).toBe(all.length);
  });

  it('wait for what the first battle shows at once, and only that', () => {
    expect([...ART_TIERS.FIRST].sort()).toEqual(['bg_field.jpg', 'commander', 'enemy_grunt', 'tutorial_hand', ...LINEUP.map((k) => `potion_${k}_body`)].sort());
  });
});
