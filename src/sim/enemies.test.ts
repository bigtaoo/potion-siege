import { describe, expect, it } from 'vitest';
import { RESIST, resist } from './enemies';

describe('enemy resistances', () => {
  it('defaults to full damage and keeps every listed value sensible', () => {
    expect(resist('grunt', 'fire')).toBe(1);
    expect(resist('brute', 'fire')).toBe(0.5);
    for (const table of Object.values(RESIST)) {
      for (const v of Object.values(table)) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(2);
      }
    }
  });
});
