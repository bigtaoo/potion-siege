import { describe, expect, it } from 'vitest';
import { AdPacing, INTERSTITIAL_MINUTES } from './adPacing';

// The shared interstitial pacing: one at most every few minutes of play, whatever the host.

const MIN = 60_000;

describe('AdPacing', () => {
  it('keeps the gap at 3 minutes', () => {
    expect(INTERSTITIAL_MINUTES).toBe(3);
    expect(new AdPacing().gapMs).toBe(3 * MIN);
  });

  it('is not due before the first gap of play', () => {
    const p = new AdPacing();
    expect(p.due()).toBe(false);
    p.played(3 * MIN - 1);
    expect(p.due()).toBe(false);
    p.played(1);
    expect(p.due()).toBe(true);
  });

  it('adds up play across battles until an ad is shown', () => {
    const p = new AdPacing();
    for (let battle = 0; battle < 3; battle++) p.played(MIN);
    expect(p.due()).toBe(true);
    expect(p.seconds).toBe(180);
  });

  it('starts the clock over once an ad was on screen', () => {
    const p = new AdPacing();
    p.played(10 * MIN);
    p.shown();
    expect(p.due()).toBe(false);
    expect(p.seconds).toBe(0);
    p.played(3 * MIN);
    expect(p.due()).toBe(true);
  });

  it('ignores a negative or empty frame', () => {
    const p = new AdPacing();
    p.played(-5 * MIN);
    p.played(Number.NaN);
    p.played(3 * MIN);
    expect(p.due()).toBe(true);
    expect(p.seconds).toBe(180);
  });
});
