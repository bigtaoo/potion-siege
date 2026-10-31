import { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { PotionLook } from './potion';
import { FRAMES, limbFrame } from './potionFrames';
import { blankTexture, countColor } from './potionKit';
import { drawMark, LOOP } from './potionMarks';

const GLOW: [number, number, number] = [0xc10000, 0x00c200, 0x0000c3];

function look(mark: PotionLook['mark']): PotionLook {
  return { body: blankTexture(100, 200), eyes: [[0.35, 0.5], [0.65, 0.5]], eyeSize: [0.05, 0.04], lid: 0xa1a1a1, limb: 0xb2b2b2, mark, glow: GLOW, neck: [0.5, 0.1] };
}

describe('limbFrame', () => {
  it('keeps one frame per step of the loop and gives the same one back', () => {
    const l = look('flame');
    const step = LOOP / FRAMES;
    expect(limbFrame(l, 0.3 * step)).toBe(limbFrame(l, 0.9 * step));
    expect(limbFrame(l, 1.1 * step)).not.toBe(limbFrame(l, 0.3 * step));
    expect(new Set(Array.from({ length: FRAMES * 2 }, (_, i) => limbFrame(l, (i + 0.5) * step))).size).toBe(FRAMES);
  });

  it('loops: a loop later and before 0 it is the same frame', () => {
    const l = look('spark');
    expect(limbFrame(l, 0.7 + LOOP)).toBe(limbFrame(l, 0.7));
    expect(limbFrame(l, 0.7 - 3 * LOOP)).toBe(limbFrame(l, 0.7));
    expect(limbFrame(l, LOOP - 1e-9)).toBe(limbFrame(l, -1e-9));
  });

  it('keeps each look\'s frames apart', () => {
    expect(limbFrame(look('frost'), 0.2)).not.toBe(limbFrame(look('frost'), 0.2));
  });

  it('draws the feet, the mark and the idle arms apart', () => {
    const l = look('star');
    const part = (k: keyof ReturnType<typeof limbFrame>) => new Graphics(limbFrame(l, 0.5)[k]);
    expect(countColor(part('back'), 'fill', 0xb2b2b2)).toBe(2);
    expect(countColor(part('mark'), 'fill', GLOW[1])).toBe(3);
    expect(countColor(part('front'), 'fill', 0xb2b2b2)).toBe(2);
    expect(countColor(part('front'), 'fill', GLOW[1])).toBe(0);
  });

  it("closes every mark's loop: a loop later it is drawn the same", () => {
    for (const mark of ['flame', 'frost', 'spark', 'star', 'acid', 'wind'] as const) {
      const g = new Graphics();
      for (const t of [0.13, 0.37, 0.71].map((k) => k * LOOP)) {
        const [now, later] = [t, t + LOOP].map((at) => {
          drawMark(g, look(mark), at, 100);
          return { ...g.context.bounds };
        });
        for (const k of ['minX', 'minY', 'maxX', 'maxY'] as const) expect(later[k], mark).toBeCloseTo(now[k], 4);
      }
    }
  });
});
