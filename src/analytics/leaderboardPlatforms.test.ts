// The server's record of every platform's scores (scripts/leaderboard.mjs): each entry keeps the
// platform it came from, a board reads per platform or across all, and the daily challenge's board
// ranks one day's furthest wave.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { boardQuery, cleanPost, ENDLESS_MAX, Leaderboards, scoresOf, tagOf } from '../../scripts/leaderboard.mjs';
import { newMeta } from '../sim/meta';
import { resetState } from './collectorHarness';

vi.mock('node:fs', async () => (await import('./collectorHarness')).fakeFs);

const ID = 'a'.repeat(24);
const OTHER = 'b'.repeat(24);
const NOW = Date.UTC(2026, 9, 31, 12);

/** A save that cleared 12 stages, reached endless wave `best` and challenge wave `wave` on `day`. */
function save({ best = 20, wave = 0, day = '' } = {}): string {
  const m = newMeta();
  m.runs = 40;
  m.cleared = 12;
  m.endless.best = best;
  m.endless.runs = 3;
  m.challenge.best = wave;
  m.challenge.date = day;
  return JSON.stringify(m);
}

beforeEach(() => resetState());

describe('scores by platform', () => {
  it('takes the platform a post names, when it is a plain name', () => {
    const token = 'c'.repeat(32);
    expect(cleanPost({ id: ID, token, platform: 'playgama' })?.platform).toBe('playgama');
    for (const platform of ['', 'X', 'a b', '../x', 5, 'p'.repeat(30)]) expect(cleanPost({ id: ID, token, platform })?.platform).toBe('');
    expect(boardQuery('/l?board=endless&platform=crazygames')?.platform).toBe('crazygames');
    expect(boardQuery('/l?board=endless&platform=../x')?.platform).toBeNull();
    expect(boardQuery('/l?board=daily_challenge&day=2026-10-31')).toMatchObject({ board: 'daily_challenge', day: '2026-10-31' });
    expect(boardQuery('/l?board=daily_challenge&day=today')?.day).toBeNull();
  });

  it('keeps where each entry came from and reads a board for one platform or all', () => {
    const b = new Leaderboards('/data/boards', () => {});
    b.post(ID, save({ best: 30 }), NOW, 'playgama');
    b.post(OTHER, save({ best: 20 }), NOW, 'web');
    expect(b.boards.endless.map((e) => e.platform)).toEqual(['playgama', 'web']);
    expect(b.top('endless', 10).rows.map((r) => r.tag)).toEqual([tagOf(ID), tagOf(OTHER)]);
    const web = b.top('endless', 10, OTHER, { platform: 'web' });
    expect([web.total, web.rows, web.me]).toEqual([1, [{ rank: 1, tag: tagOf(OTHER), score: 20, me: true }], { rank: 1, tag: tagOf(OTHER), score: 20 }]);
    // a post without a platform keeps none
    b.post(ID, save({ best: 31 }), NOW + 1);
    expect(b.boards.endless[0]).not.toHaveProperty('platform');
  });
});

describe('the daily challenge board', () => {
  it("reads a save's challenge wave and its day, and none without a day", () => {
    expect(scoresOf(save({ wave: 14, day: '2026-10-31' }))).toMatchObject({ daily_challenge: 14, day: '2026-10-31' });
    expect(scoresOf(save({ wave: 14, day: 'soon' }))).toMatchObject({ daily_challenge: 0, day: '' });
    expect(scoresOf(save({ wave: ENDLESS_MAX + 1, day: '2026-10-31' }))).toBeNull();
  });

  it('ranks the latest day by default, any day asked for, and starts a new day over', () => {
    const b = new Leaderboards('/data/boards', () => {});
    b.post(ID, save({ wave: 12, day: '2026-10-30' }), NOW);
    b.post(OTHER, save({ wave: 9, day: '2026-10-31' }), NOW + 1, 'ios');
    expect(b.top('daily_challenge', 10)).toMatchObject({ day: '2026-10-31', total: 1, rows: [{ tag: tagOf(OTHER), score: 9 }] });
    expect(b.top('daily_challenge', 10, null, { day: '2026-10-30' }).rows.map((r) => r.score)).toEqual([12]);
    // the next day's lower wave replaces the entry and counts from when it came
    b.post(ID, save({ wave: 5, day: '2026-10-31' }), NOW + 2);
    expect(b.top('daily_challenge', 10).rows.map((r) => r.score)).toEqual([9, 5]);
    expect(b.boards.daily_challenge.find((e) => e.id === ID)).toMatchObject({ day: '2026-10-31', reached: NOW + 2 });
    expect(b.top('endless', 10)).not.toHaveProperty('day');
  });
});
