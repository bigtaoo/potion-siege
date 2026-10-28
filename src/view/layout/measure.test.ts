import { describe, expect, it } from 'vitest';
import { unknownChars, width100 } from './measure';

const SEGOE = '800 100px "Segoe UI"';

describe('glyph widths', () => {
  it('sum a string\'s characters, skipping line breaks and zero-width spaces', () => {
    const ab = width100('ab', SEGOE);
    expect(ab).toBeGreaterThan(0);
    expect(width100('a\nb', SEGOE)).toBe(ab);
    expect(width100('a​b', SEGOE)).toBe(ab);
  });

  it('read each script\'s own table by the family the font names', () => {
    const ja = width100('ア', '800 40px "Hiragino Sans"');
    expect(ja).toBeGreaterThan(0);
    expect(ja).toBeLessThanOrEqual(100);
    expect(width100('가', '800 40px "Apple SD Gothic Neo"')).toBeGreaterThan(0);
    expect(width100('ก', '800 40px Leelawadee')).toBeGreaterThan(0);
  });

  it('charge a full em for Han missing from a table, without calling it unknown', () => {
    const before = unknownChars().length;
    expect(width100('龠', SEGOE)).toBe(100);
    expect(unknownChars()).toHaveLength(before);
  });

  it('charge a full em for any other glyph not measured, and name it', () => {
    expect(width100('\u{1f9ea}', SEGOE)).toBe(100);
    expect(unknownChars()).toContain('\u{1f9ea}');
  });
});

describe('the canvas stand-in', () => {
  it('measures at the font\'s size, the ink above and below the line in proportion', () => {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d') as unknown as CanvasRenderingContext2D;
    ctx.font = SEGOE.replace('100px', '50px');
    const m = ctx.measureText('ab');
    expect(m.width).toBeCloseTo(width100('ab', SEGOE) / 2);
    expect(m.actualBoundingBoxAscent).toBeCloseTo(46.5);
    expect(m.actualBoundingBoxDescent).toBeCloseTo(12.5);
    ctx.font = 'bold sans-serif';
    expect(ctx.measureText('ab').width).toBeCloseTo(width100('ab', SEGOE) / 10);
    expect(ctx.getImageData(0, 0, 1, 1).data).toHaveLength(4);
    expect(() => {
      ctx.save();
      ctx.fillText('a', 0, 0);
      ctx.strokeText('a', 0, 0);
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillRect(0, 0, 1, 1);
      ctx.restore();
    }).not.toThrow();
  });
});
