// The leaderboards' own rules (scripts/leaderboard.mjs): which saves could have been played, what a
// post and a query take, and how the boards rank, keep and forget their entries.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { boardQuery, cleanPost, ENDLESS_MAX, ENDLESS_UNLOCK, Leaderboards, MAX_ENTRIES, scoresOf, STAGES, tagOf } from '../../scripts/leaderboard.mjs';
import { BALANCE } from '../sim/types';
import { newMeta } from '../sim/meta';
import { totalStars } from '../sim/stars';
import { resetState, state } from './collectorHarness';

vi.mock('node:fs', async () => (await import('./collectorHarness')).fakeFs);

const ID = 'a'.repeat(24);
const OTHER = 'b'.repeat(24);
const NOW = Date.UTC(2026, 9, 18, 12);

/** A save that has cleared `cleared` stages with `stars` each, and reached endless wave `best`. */
function save({ runs = 40, cleared = 12, stars = 2, best = 0, endlessRuns = -1 } = {}): string {
  const m = newMeta();
  m.runs = runs;
  m.cleared = cleared;
  for (let i = 0; i < cleared; i++) m.stars.normal[i] = stars;
  m.endless.best = best;
  m.endless.runs = endlessRuns >= 0 ? endlessRuns : best ? 3 : 0;
  return JSON.stringify(m);
}

const DIR = '/data/boards';
const freshDir = () => DIR;
beforeEach(() => resetState());

describe('leaderboard scores', () => {
  it('keeps its limits in step with the balance', () => {
    expect(STAGES).toBe(BALANCE.meta.stageCount);
    expect(ENDLESS_UNLOCK).toBe(BALANCE.endless.unlock);
  });

  it("reads a real save's endless best and its stars, normal and hard", () => {
    const m = JSON.parse(save({ best: 23 })) as ReturnType<typeof newMeta>;
    m.stars.hard[0] = 3;
    expect(scoresOf(JSON.stringify(m))).toEqual({ endless: 23, stars: totalStars(m) });
    expect(scoresOf(JSON.stringify(newMeta()))).toEqual({ endless: 0, stars: 0 });
    expect(scoresOf('{}')).toEqual({ endless: 0, stars: 0 });
  });

  it('turns down saves no one could have played', () => {
    const hardOnly = JSON.parse(save()) as ReturnType<typeof newMeta>;
    hardOnly.stars.normal[3] = 0;
    hardOnly.stars.hard[3] = 1;
    const bad = [
      '{oops',
      'null',
      '5',
      save({ runs: -1 }),
      save({ cleared: STAGES + 1 }),
      save({ stars: 4 }),
      save({ runs: 7 }), // 12 stages of 2 stars is 24, more than 3 a battle
      save({ cleared: ENDLESS_UNLOCK - 1, best: 5 }),
      save({ best: 5, endlessRuns: 0 }),
      save({ best: ENDLESS_MAX + 1 }),
      save({ best: 2.5 }),
      JSON.stringify(hardOnly),
      JSON.stringify({ cleared: 1, stars: { normal: [1, 1] } }), // a star past the cleared stages
      JSON.stringify({ stars: { normal: Array(STAGES + 1).fill(0) } }),
      JSON.stringify({ stars: { normal: 'x' } }),
    ];
    for (const s of bad) expect(scoresOf(s), s).toBeNull();
    expect(scoresOf(save({ best: ENDLESS_MAX }))).toEqual({ endless: ENDLESS_MAX, stars: 24 });
    // an endless run quit midway counts in endless.runs but not in runs
    expect(scoresOf(save({ runs: 10, stars: 1, best: 4, endlessRuns: 20 }))).toEqual({ endless: 4, stars: 12 });
  });

  it('takes an id and a secret from a post, and a known board from a query', () => {
    const token = 'c'.repeat(32);
    expect(cleanPost({ id: ID, token, extra: 1 })).toEqual({ id: ID, token });
    for (const b of [null, [], 'x', { id: ID }, { id: 'A'.repeat(24), token }, { id: ID, token: 5 }]) expect(cleanPost(b)).toBeNull();
    expect(boardQuery('/l?board=stars')).toEqual({ board: 'stars', n: 10, me: null });
    expect(boardQuery(`/l?board=endless&n=3&me=${ID}`)).toEqual({ board: 'endless', n: 3, me: ID });
    expect(boardQuery('/l?board=endless&n=500&me=zz')).toEqual({ board: 'endless', n: 50, me: null });
    expect(boardQuery('/l?board=endless&n=0')?.n).toBe(1);
    expect(boardQuery('/l?board=endless&n=x')?.n).toBe(10);
    expect(boardQuery('/l?board=gold')).toBeNull();
    expect(boardQuery('/l')).toBeNull();
  });

  it('names a player by a short tag that does not give their id away', () => {
    expect(tagOf(ID)).toMatch(/^[0-9A-F]{6}$/);
    expect(tagOf(ID)).not.toBe(tagOf(OTHER));
    expect(ID.toUpperCase()).not.toContain(tagOf(ID));
  });
});

describe('leaderboards', () => {
  it('ranks higher scores first, ties by who reached them first, sharing the rank', () => {
    const b = new Leaderboards(freshDir(), () => {});
    const c = 'c'.repeat(24);
    expect(b.post(ID, save({ best: 20 }), NOW)).toBe('posted');
    b.post(OTHER, save({ best: 30 }), NOW + 1);
    b.post(c, save({ best: 20 }), NOW + 2);
    const page = b.top('endless', 10, c);
    expect(page.rows.map((r) => [r.rank, r.score, r.tag])).toEqual([
      [1, 30, tagOf(OTHER)],
      [2, 20, tagOf(ID)],
      [2, 20, tagOf(c)],
    ]);
    expect(page.rows[2].me).toBe(true);
    expect(page.me).toEqual({ rank: 2, tag: tagOf(c), score: 20 });
    expect(page.total).toBe(3);
    expect(b.top('endless', 1, c)).toMatchObject({ rows: [{ rank: 1 }], me: { rank: 2 } });
    expect(b.top('endless', 10).me).toBeNull();
  });

  it('keeps one entry a player, moving when it was reached only when the score rises', () => {
    const b = new Leaderboards(freshDir(), () => {});
    b.post(ID, save({ best: 20 }), NOW);
    b.post(OTHER, save({ best: 20 }), NOW + 5);
    b.post(ID, save({ best: 20 }), NOW + 10);
    expect(b.top('endless', 10).rows[0].tag).toBe(tagOf(ID));
    // a save restored from an older copy goes back down
    b.post(ID, save({ best: 12 }), NOW + 20);
    expect(b.top('endless', 10).rows.map((r) => r.score)).toEqual([20, 12]);
    expect(b.boards.endless[1]).toMatchObject({ id: ID, reached: NOW, at: NOW + 20 });
  });

  it('leaves out a score of 0 and takes a player off when theirs falls to 0', () => {
    const b = new Leaderboards(freshDir(), () => {});
    b.post(ID, save({ cleared: 3, best: 0 }), NOW);
    expect(b.top('endless', 10).total).toBe(0);
    expect(b.top('stars', 10).total).toBe(1);
    b.post(ID, JSON.stringify(newMeta()), NOW + 1);
    expect(b.top('stars', 10).total).toBe(0);
  });

  it('posts nothing for a save that could not have been played', () => {
    const b = new Leaderboards(freshDir(), () => {});
    expect(b.post(ID, save({ stars: 4 }), NOW)).toBe('implausible');
    expect(b.top('stars', 10).total).toBe(0);
  });

  it(`keeps the best ${MAX_ENTRIES} entries`, () => {
    const b = new Leaderboards(freshDir(), () => {});
    const list = b.boards.stars;
    for (let i = 0; i < MAX_ENTRIES; i++) list.push({ id: i.toString(16).padStart(24, '0'), score: 100, reached: NOW, at: NOW });
    b.post(ID, save({ cleared: 1, stars: 1 }), NOW);
    expect(list.length).toBe(MAX_ENTRIES);
    expect(list.some((e) => e.id === ID)).toBe(false);
    b.post(OTHER, save({ cleared: 50, runs: 200, stars: 3 }), NOW);
    expect(b.boards.stars.length).toBe(MAX_ENTRIES);
    expect(b.boards.stars[0].id).toBe(OTHER);
  });

  it('reads its boards back from disk, skipping entries that are not well formed', () => {
    const dir = freshDir();
    new Leaderboards(dir, () => {}).post(ID, save({ best: 20 }), NOW);
    const doc = JSON.parse(String(state.files.get(`${DIR}/endless.json`))) as { entries: unknown[] };
    doc.entries.push({ id: 'nope', score: 9, reached: NOW, at: NOW }, { id: OTHER, score: 0, reached: NOW, at: NOW }, null);
    state.files.set(`${DIR}/endless.json`, JSON.stringify(doc));
    state.files.set(`${DIR}/stars.json`, '{oops');
    const again = new Leaderboards(dir, () => {});
    expect(again.top('endless', 10).rows).toEqual([{ rank: 1, tag: tagOf(ID), score: 20 }]);
    expect(again.top('stars', 10).total).toBe(0);
  });

  it('forgets the entries not posted for 14 months', () => {
    const logs: string[] = [];
    const b = new Leaderboards(freshDir(), (l: string) => logs.push(l));
    const old = Date.UTC(2025, 7, 17);
    b.post(ID, save({ best: 20 }), old);
    b.post(OTHER, save({ best: 10 }), NOW);
    expect(b.prune(NOW)).toBe(2); // ID's endless and stars entries
    expect(b.top('endless', 10).rows.map((r) => r.tag)).toEqual([tagOf(OTHER)]);
    expect(logs).toEqual(['collector: dropped 2 leaderboard entr(ies) older than 14 months']);
    expect(b.prune(NOW)).toBe(0);
    expect(logs.length).toBe(1);
  });
});
