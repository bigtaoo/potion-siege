import { describe, expect, it, vi } from 'vitest';
import { LEADERBOARDS, reportScore } from './leaderboard';
import type { Platform } from './types';

const host = (setScore?: Platform['setScore']) => ({ setScore }) as unknown as Platform;

describe('leaderboard scores', () => {
  it('go to the board by its console id, as whole waves', () => {
    const setScore = vi.fn();
    reportScore(host(setScore), 'challenge', 12);
    reportScore(host(setScore), 'endless', 30.7);
    expect(setScore.mock.calls).toEqual([[LEADERBOARDS.challenge, 12], [LEADERBOARDS.endless, 30]]);
  });

  it('skip nothing worth a place, hosts without boards, and a throwing host', () => {
    const setScore = vi.fn();
    reportScore(host(setScore), 'endless', 0);
    reportScore(host(setScore), 'endless', Number.NaN);
    expect(setScore).not.toHaveBeenCalled();
    expect(() => reportScore(host(), 'endless', 5)).not.toThrow();
    expect(() => reportScore(host(() => { throw new Error('no'); }), 'endless', 5)).not.toThrow();
  });
});
