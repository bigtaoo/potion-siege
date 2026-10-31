// The leaderboard scores a run sends when it ends (platform/leaderboard.ts): the daily
// challenge's wave and the endless best, on a host that has boards.
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { playChallenge, playEndless } from './modes';
import { englishPage, playToEnd, veteran, world } from './testWorld';

beforeAll(englishPage);

function scored() {
  const scores: [string, number][] = [];
  const w = world(veteran(), (h) => Object.assign(h, { setScore: (id: string, n: number) => void scores.push([id, n]) }));
  return { w, scores };
}

describe('leaderboard scores at the end of a run', () => {
  it('sends the wave a daily challenge reached', () => {
    const { w, scores } = scored();
    playChallenge(w.game, false);
    playToEnd(w);
    expect(scores).toEqual([['daily_challenge', w.game['battle']!.wave]]);
  });

  it('sends the endless best', () => {
    const { w, scores } = scored();
    playEndless(w.game);
    playToEnd(w);
    expect(scores).toEqual([['endless', w.save().endless.best]]);
    expect(scores[0][1]).toBeGreaterThan(0);
  });
});
