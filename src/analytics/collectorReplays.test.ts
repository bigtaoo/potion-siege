// A battle's replay from the game to the collector's shelf and back (replayUpload.ts → POST /r →
// scripts/replayShelf.mjs): what `npm run replays` reads plays to the same end as the battle did.
// And what the shelf keeps: valid bodies only, KEEP_DAYS, its total size.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unzipReplay, KEEP_DAYS } from '../../scripts/replayShelf.mjs';
import { Battle } from '../sim/battle';
import { botAct } from '../sim/bot';
import { hashBattle } from '../sim/hash';
import { checkReplay, playReplay } from '../sim/replay';
import { load, NOON, request, resetState, state, type Handler } from './collectorHarness';
import { ReplayUpload, type ReplayPost } from './replayUpload';

vi.mock('node:http', async () => (await import('./collectorHarness')).fakeHttp);
vi.mock('node:fs', async () => (await import('./collectorHarness')).fakeFs);

const SHELF = '/data/replays';
const shelved = (name: string) => unzipReplay(state.files.get(`${SHELF}/${name}.json.gz`) as Uint8Array);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOON);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  resetState();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** The game's uploader, posting straight into the collector; the statuses it got. */
function uploader(handler: Handler, uid = 'p1') {
  const statuses: number[] = [];
  const up = new ReplayUpload('/r', { sending: true, playerId: uid }, '1.0+abc', 'web', (url, body) => statuses.push(request(handler, 'POST', url, body).res.status));
  return { up, statuses };
}

function play(b: Battle, ticks: number): Battle {
  for (let i = 0; i < ticks && b.result === null; i++) {
    botAct(b);
    b.step();
    b.drain();
  }
  return b;
}

const post = (over: Partial<ReplayPost> = {}): string => {
  const b = play(new Battle(3), 30);
  let body = '';
  const up = new ReplayUpload('/r', { sending: true, playerId: 'p1' }, 'b', 'web', (_, text) => (body = text));
  up.start(1, b);
  up.end(1, b);
  return JSON.stringify({ ...(JSON.parse(body) as ReplayPost), ...over });
};

describe('replays from the game to the shelf', () => {
  it('keeps an ended battle that plays back to the same result', async () => {
    const handler = await load();
    const { up, statuses } = uploader(handler);
    const b = new Battle(11);
    up.start(4, b);
    play(b, 20 * 60 * 30);
    expect(b.result).not.toBeNull();
    up.end(4, b);
    expect(statuses).toEqual([204]);

    const doc = shelved('p1-4');
    expect({ ...doc, replay: undefined }).toEqual({ uid: 'p1', run: 4, end: b.result, at: NOON, build: '1.0+abc', platform: 'web', replay: undefined });
    expect(checkReplay(doc.replay)).toBe(true);
    const again = playReplay(doc.replay);
    expect([again.result, again.time, hashBattle(again)]).toEqual([b.result, b.time, hashBattle(b)]);
  });

  it('replaces the battle sent when the page was hidden with its end', async () => {
    const handler = await load();
    const { up, statuses } = uploader(handler);
    const b = new Battle(12);
    up.start(1, b);
    play(b, 600);
    up.hidden();
    expect(shelved('p1-1').end).toBe('hidden');
    play(b, 300);
    up.end(1, b);
    expect(statuses).toEqual([204, 204]);
    const doc = shelved('p1-1');
    expect([doc.end, doc.replay.ticks]).toEqual(['quit', 900]);
    expect(checkReplay(doc.replay)).toBe(true);
    expect([...state.files.keys()].filter((f) => f.startsWith(SHELF))).toEqual([`${SHELF}/p1-1.json.gz`]);
  });

  it('answers 400 to what is not a replay, and keeps nothing of it', async () => {
    const handler = await load();
    const bad = [
      'not json',
      post({ uid: '../etc' }),
      post({ run: 0 }),
      post({ end: 'won!' as ReplayPost['end'] }),
      JSON.stringify({ ...JSON.parse(post()), replay: { ...JSON.parse(post()).replay, commands: 'x' } }),
      JSON.stringify({ ...JSON.parse(post()), replay: { ...JSON.parse(post()).replay, ticks: -1 } }),
    ];
    for (const body of bad) expect(request(handler, 'POST', '/r', body).res.status).toBe(400);
    expect([...state.files.keys()].some((f) => f.startsWith(SHELF))).toBe(false);
    expect(request(handler, 'POST', '/r', post()).res.status).toBe(204);
  });

  it(`drops replays ${KEEP_DAYS} days old`, async () => {
    const handler = await load();
    expect(request(handler, 'POST', '/r', post({ uid: 'old' })).res.status).toBe(204);
    vi.setSystemTime(NOON + 3 * 24 * 3600_000);
    expect(request(handler, 'POST', '/r', post({ uid: 'new' })).res.status).toBe(204);
    // the hourly prune, once the first is over KEEP_DAYS old
    vi.setSystemTime(NOON + (KEEP_DAYS * 24 + 1) * 3600_000);
    request(handler, 'GET', '/health');
    expect(state.files.has(`${SHELF}/old-1.json.gz`)).toBe(false);
    expect(state.files.has(`${SHELF}/new-1.json.gz`)).toBe(true);
  });

  it('drops the oldest once the shelf is full, and reads its files again after a restart', async () => {
    const size = (await load(), request(state.handler!, 'POST', '/r', post({ uid: 'probe' })), (state.files.get(`${SHELF}/probe-1.json.gz`) as Uint8Array).length);
    resetState();
    const handler = await load({ COLLECTOR_DIR: '/data', COLLECTOR_REPLAY_BYTES: String(size * 3) });
    for (const [i, uid] of ['a', 'b', 'c', 'd'].entries()) {
      vi.setSystemTime(NOON + i * 60_000);
      expect(request(handler, 'POST', '/r', post({ uid })).res.status).toBe(204);
    }
    const kept = () => [...state.files.keys()].filter((f) => f.startsWith(SHELF)).map((f) => f.slice(SHELF.length + 1)).sort();
    expect(kept()).toEqual(['b-1.json.gz', 'c-1.json.gz', 'd-1.json.gz']);
    expect(vi.mocked(console.log)).toHaveBeenCalledWith(expect.stringContaining('replay shelf full'));

    // a restarted collector knows what is on its shelf and its age
    const restarted = await load({ COLLECTOR_DIR: '/data', COLLECTOR_REPLAY_BYTES: String(size * 3) });
    vi.setSystemTime(NOON + 10 * 60_000);
    expect(request(restarted, 'POST', '/r', post({ uid: 'e' })).res.status).toBe(204);
    expect(kept()).toEqual(['c-1.json.gz', 'd-1.json.gz', 'e-1.json.gz']);
  });
});
