// The leaderboard scores a run sends when it ends (board/types.ts): the daily challenge's wave
// on a host with a board for it, the save's scores after an endless run.
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { playChallenge, playEndless } from './modes';
import { englishPage, playToEnd, veteran, world } from './testWorld';

beforeAll(englishPage);

function scored() {
  const scores: [string, number][] = [];
  const leaderboard = {
    submit: (s: { endless: number }) => void scores.push(['endless', s.endless]),
    top: async () => null,
    daily: (wave: number) => void scores.push(['daily_challenge', wave]),
  };
  const w = world(veteran(), (h) => Object.assign(h, { leaderboard }));
  return { w, scores };
}

describe('leaderboard scores at the end of a run', () => {
  it('sends the wave a daily challenge reached', () => {
    const { w, scores } = scored();
    playChallenge(w.game, false);
    scores.length = 0; // the home screen's own submit at boot
    playToEnd(w);
    expect(scores).toEqual([['daily_challenge', w.game['battle']!.wave]]);
  });

  it('sends the endless best', () => {
    const { w, scores } = scored();
    playEndless(w.game);
    scores.length = 0;
    playToEnd(w);
    expect(scores).toEqual([['endless', w.save().endless.best]]);
    expect(scores[0][1]).toBeGreaterThan(0);
  });
});
