import { describe, expect, it } from 'vitest';
import { CARD_NUDGE, nudgeOn, tapPose } from './cardNudge';

describe('skill card nudge', () => {
  it('shows the hand only after the cards were left alone, never once touched', () => {
    expect(nudgeOn(CARD_NUDGE.after - 0.1, false)).toBe(false);
    expect(nudgeOn(CARD_NUDGE.after, false)).toBe(true);
    expect(nudgeOn(CARD_NUDGE.after + 30, true)).toBe(false);
  });

  it('taps down onto the card, rests, lifts, and repeats every beat', () => {
    expect(tapPose(0).lift).toBe(1);
    expect(tapPose(CARD_NUDGE.beat * 0.4)).toEqual({ lift: 0, ripple: expect.any(Number) });
    expect(tapPose(CARD_NUDGE.beat * 0.4).ripple).toBeGreaterThan(0);
    expect(tapPose(0).ripple).toBe(0);
    expect(tapPose(CARD_NUDGE.beat * 2.4)).toEqual(tapPose(CARD_NUDGE.beat * 0.4));
  });
});
