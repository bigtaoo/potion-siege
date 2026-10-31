// The leaderboards on the collector (POST /l, GET /l): a save copy's secret puts the scores of the
// copy the server holds on the boards, and anyone reads the top rows and their own.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rateOf } from '../../scripts/collectorLimits.mjs';
import { MAX_POST, tagOf } from '../../scripts/leaderboard.mjs';
import { newMeta } from '../sim/meta';
import { load, NOON, request, resetState, state, type Handler } from './collectorHarness';

vi.mock('node:http', async () => (await import('./collectorHarness')).fakeHttp);
vi.mock('node:fs', async () => (await import('./collectorHarness')).fakeFs);

const ID = 'a'.repeat(24);
const TOKEN = 'b'.repeat(32);
const IP = { 'cf-connecting-ip': '1.2.3.4' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOON);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  resetState();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function save(best: number, stars = 2): string {
  const m = newMeta();
  m.runs = 40;
  m.cleared = 12;
  for (let i = 0; i < 12; i++) m.stars.normal[i] = stars;
  m.endless.best = best;
  m.endless.runs = best ? 2 : 0;
  return JSON.stringify(m);
}

const copy = (handler: Handler, text: string, id = ID, token = TOKEN) =>
  request(handler, 'POST', '/s', JSON.stringify({ id, token, at: 1, save: text })).res.status;
const post = (handler: Handler, id = ID, token = TOKEN, headers?: Record<string, string>) =>
  request(handler, 'POST', '/l', JSON.stringify({ id, token }), headers).res;
const rows = (handler: Handler, query: string) => {
  const res = request(handler, 'GET', `/l?${query}`).res;
  return { status: res.status, page: JSON.parse(res.body ?? 'null') as { total: number; rows: { rank: number; tag: string; score: number }[]; me: unknown } };
};

describe('leaderboards on the collector', () => {
  it('ranks the scores of the copy the server holds and hands back the rows', async () => {
    const handler = await load();
    const other = 'c'.repeat(24);
    expect(copy(handler, save(23))).toBe(204);
    expect(copy(handler, save(30, 1), other, 'd'.repeat(32))).toBe(204);
    expect(post(handler).status).toBe(204);
    expect(post(handler, other, 'd'.repeat(32)).status).toBe(204);
    const endless = rows(handler, `board=endless&me=${ID}`);
    expect(endless.status).toBe(200);
    expect(endless.page).toEqual({
      board: 'endless',
      total: 2,
      rows: [
        { rank: 1, tag: tagOf(other), score: 30 },
        { rank: 2, tag: tagOf(ID), score: 23, me: true },
      ],
      me: { rank: 2, tag: tagOf(ID), score: 23 },
    });
    expect(rows(handler, 'board=stars&n=1').page.rows).toEqual([{ rank: 1, tag: tagOf(ID), score: 24 }]);
    const res = request(handler, 'GET', '/l?board=stars').res;
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(String(state.files.get('/data/boards/endless.json'))).not.toContain(TOKEN);
  });

  it("takes the copy's newest save, never a number from the request", async () => {
    const handler = await load();
    copy(handler, save(10));
    post(handler);
    copy(handler, save(14));
    expect(request(handler, 'POST', '/l', JSON.stringify({ id: ID, token: TOKEN, score: 999 })).res.status).toBe(204);
    expect(rows(handler, 'board=endless').page.rows.map((r) => r.score)).toEqual([14]);
  });

  it('answers 404 without the copy or its secret, and 422 for a copy no one could have played', async () => {
    const handler = await load();
    expect(post(handler).status).toBe(404);
    copy(handler, save(10));
    expect(post(handler, ID, 'e'.repeat(32)).status).toBe(404);
    copy(handler, save(10, 3).replace('"runs":40', '"runs":4'));
    expect(post(handler).status).toBe(422);
    expect(rows(handler, 'board=stars').page.total).toBe(0);
  });

  it('takes well-formed posts and queries only', async () => {
    const handler = await load();
    for (const bad of ['{oops', '[]', JSON.stringify({ id: ID }), JSON.stringify({ id: 'x', token: TOKEN })]) {
      expect(request(handler, 'POST', '/l', bad).res.status, bad).toBe(400);
    }
    expect(request(handler, 'GET', '/l?board=gold').res.status).toBe(400);
    expect(request(handler, 'GET', '/l?n=3').res.status).toBe(400);
  });

  it(`refuses a post over ${MAX_POST} bytes`, async () => {
    const handler = await load();
    const res = request(handler, 'POST', '/l', 'x'.repeat(10), { 'content-length': String(MAX_POST + 1) }).res;
    expect(res.status).toBe(413);
  });

  it('answers 503 when the disk refuses the board', async () => {
    const handler = await load();
    copy(handler, save(10));
    state.readOnly = true;
    expect(post(handler).status).toBe(503);
  });

  it('allows 30 board requests per address per minute, apart from the events', async () => {
    const handler = await load();
    expect(rateOf('POST', '/l')).toBe('boards');
    expect(rateOf('GET', '/l?board=stars')).toBe('boards');
    expect(rateOf('PUT', '/l')).toBeNull();
    for (let i = 0; i < 15; i++) post(handler, ID, TOKEN, IP);
    for (let i = 0; i < 15; i++) request(handler, 'GET', '/l?board=stars', undefined, IP);
    expect(request(handler, 'GET', '/l?board=stars', undefined, IP).res.status).toBe(429);
    expect(post(handler, ID, TOKEN, IP).status).toBe(429);
    expect(request(handler, 'POST', '/e', '[]', IP).res.status).toBe(204);
    expect(request(handler, 'GET', '/l?board=stars', undefined, { 'cf-connecting-ip': '5.6.7.8' }).res.status).toBe(200);
  });

  it('forgets an entry 14 months after its last post, on the hourly prune', async () => {
    const handler = await load();
    copy(handler, save(10));
    vi.setSystemTime(NOON - 430 * 86_400_000);
    post(handler);
    vi.setSystemTime(NOON + 3600_000);
    request(handler, 'GET', '/health');
    expect(rows(handler, 'board=endless').page.total).toBe(0);
  });
});
