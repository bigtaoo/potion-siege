import { describe, expect, it } from 'vitest';
import { pointer } from './pointer';

describe('pointer', () => {
  it('puts the hand\'s fingertip on the spot, turned and sized, and lets taps through', () => {
    const p = pointer(300, 400, Math.PI / 2, 0.8);
    expect(p.label).toBe('hintHand');
    expect(p.eventMode).toBe('none');
    expect([p.x, p.y, p.rotation, p.scale.x, p.scale.y]).toEqual([300, 400, Math.PI / 2, 0.8, 0.8]);
    expect(p.children).toHaveLength(1);
    const hand = p.children[0].getLocalBounds();
    // the drawn glove's fingertip is at its origin: the hand hangs below it, on both sides
    expect(hand.minY).toBeCloseTo(0, -1);
    expect(hand.minX).toBeLessThan(0);
    expect(hand.maxX).toBeGreaterThan(0);
  });

  it('is full size unless told', () => {
    expect(pointer(0, 0, 0).scale.x).toBe(1);
  });
});
