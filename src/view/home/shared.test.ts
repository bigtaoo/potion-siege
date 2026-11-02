// A round button's caption: one line while it fits, two before it shrinks far, never wider than
// its room.
import '../layout/measure';
import { describe, expect, it } from 'vitest';
import { caption } from './shared';

describe('a caption', () => {
  it('keeps a short name on one line at its size', () => {
    const one = caption('Bonus', 128, 30);
    expect(one.scale.x).toBe(1);
    expect(one.text).not.toContain('\n');
  });

  it('breaks a long name with a space onto two lines rather than shrink it hard', () => {
    expect(caption('Heutige Herausforderung', 1000, 30).text).not.toContain('\n');
    const two = caption('Heutige Herausforderung', 200, 30);
    expect(two.text).toBe('Heutige\nHerausforderung');
    expect(two.width).toBeLessThanOrEqual(200);
  });

  it('shrinks a long word it cannot break', () => {
    const word = caption('Einstellungen', 80, 30);
    expect(word.width).toBeLessThanOrEqual(80);
    expect(word.scale.x).toBeLessThan(1);
  });
});
