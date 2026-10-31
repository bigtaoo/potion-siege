// Our server's leaderboards from the game's side (serverBoard.ts): the copy goes first and the post
// follows, only when the scores changed; the page read back, its rows checked, offline as null.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardUrl, FETCH_MS, POST_MS, ROWS, ServerBoard, serverBoard, type CopyKey, type Get } from './serverBoard';

const KEY: CopyKey = { id: 'a'.repeat(24), token: 'b'.repeat(32) };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A board over a stand-in copy source, with its timers run by hand. */
function board(get?: Get, key: CopyKey | null = KEY) {
  const posted: [string, string][] = [];
  const waiting: [() => void, number][] = [];
  const copies = { key, flushes: 0, copyKey: () => copies.key, flush: () => void copies.flushes++ };
  const b = new ServerBoard('/l', copies, {
    get,
    post: (url, body) => void posted.push([url, body]),
    later: (fn, ms) => waiting.push([fn, ms]),
  });
  const run = () => waiting.splice(0).forEach(([fn]) => fn());
  return { b, copies, posted, waiting, run };
}

describe('ServerBoard', () => {
  it('sends the copy first and posts its id and secret a moment later', () => {
    const { b, copies, posted, waiting, run } = board();
    b.submit({ endless: 12, stars: 30 });
    expect([copies.flushes, posted.length, waiting.map(([, ms]) => ms)]).toEqual([1, 0, [POST_MS]]);
    b.submit({ endless: 13, stars: 30 }); // one post at a time
    expect(waiting).toHaveLength(1);
    run();
    expect(posted).toEqual([['/l', JSON.stringify(KEY)]]);
  });

  it('posts again only when a score changed, and never for an empty save', () => {
    const { b, posted, waiting, run } = board();
    b.submit({ endless: 0, stars: 0 });
    expect(waiting).toHaveLength(0);
    b.submit({ endless: 5, stars: 9 });
    run();
    b.submit({ endless: 5, stars: 9 });
    expect(waiting).toHaveLength(0);
    b.submit({ endless: 5, stars: 10 });
    run();
    expect(posted).toHaveLength(2);
  });

  it('posts nothing before the device has a copy, and tries again next time', () => {
    const { b, copies, posted, run } = board(undefined, null);
    b.submit({ endless: 0, stars: 3 });
    run();
    expect(posted).toEqual([]);
    copies.key = KEY;
    b.submit({ endless: 0, stars: 3 });
    run();
    expect(posted).toHaveLength(1);
  });

  it('lives through a copy that will not send and a post that throws', () => {
    const waiting: (() => void)[] = [];
    let throws = true;
    const posted: string[] = [];
    const flush = () => {
      throw new Error('full');
    };
    const b = new ServerBoard('/l', { copyKey: () => KEY, flush }, {
      post: (_u, body) => {
        if (throws) throw new Error('offline');
        posted.push(body);
      },
      later: (fn) => waiting.push(fn),
    });
    b.submit({ endless: 1, stars: 1 });
    waiting.shift()!();
    throws = false;
    b.submit({ endless: 1, stars: 1 });
    waiting.shift()!();
    expect(posted).toHaveLength(1);
  });

  it("reads a board's top rows and the player's own row", async () => {
    const urls: string[] = [];
    const get: Get = async (url) => {
      urls.push(url);
      return { rows: [{ rank: 1, tag: 'C0FFEE', score: 30 }, { rank: 2, tag: 'ABC123', score: 23, me: true }, { rank: 'x' }], me: { rank: 2, tag: 'ABC123', score: 23 } };
    };
    expect(await board(get).b.top('endless')).toEqual({
      board: 'endless',
      rows: [{ rank: 1, name: 'C0FFEE', score: 30 }, { rank: 2, name: 'ABC123', score: 23, me: true }],
      me: { rank: 2, name: 'ABC123', score: 23, me: true },
    });
    await board(get, null).b.top('stars');
    expect(urls).toEqual([`/l?board=endless&n=${ROWS}&me=${KEY.id}`, `/l?board=stars&n=${ROWS}`]);
  });

  it('answers null when the server is away, slow or makes no sense', async () => {
    expect(await board(async () => null).b.top('stars')).toBeNull();
    expect(await board(async () => ({ rows: 'x' })).b.top('stars')).toBeNull();
    const offline: Get = async () => {
      throw new Error('offline');
    };
    expect(await board(offline).b.top('stars')).toBeNull();
    vi.useFakeTimers();
    const slow = board((_url, signal) => new Promise((_ok, fail) => signal.addEventListener('abort', () => fail(new Error('aborted')))));
    const page = slow.b.top('stars');
    vi.advanceTimersByTime(FETCH_MS);
    expect(await page).toBeNull();
  });

  it('uses fetch by default: a JSON read and a no-cors post', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async (..._a: unknown[]) => ({ ok: true, json: async () => ({ rows: [], me: null }) }));
    vi.stubGlobal('fetch', fetch);
    const b = new ServerBoard('/l', { copyKey: () => KEY, flush() {} });
    expect(await b.top('stars')).toEqual({ board: 'stars', rows: [], me: null });
    b.submit({ endless: 2, stars: 2 });
    vi.advanceTimersByTime(POST_MS);
    expect(fetch.mock.calls[1]).toEqual(['/l', { method: 'POST', body: JSON.stringify(KEY), mode: 'no-cors', keepalive: true }]);
    fetch.mockImplementationOnce(async () => ({ ok: false, json: async () => ({ rows: [], me: null }) }));
    expect(await b.top('stars')).toBeNull();
  });

  it('sits beside the save route, and is none where no copy goes to our server', () => {
    expect(boardUrl('https://c.example.com/s')).toBe('https://c.example.com/l');
    const copies = { copyKey: () => null, flush() {} };
    expect(serverBoard(null, copies)).toBeNull();
    expect(serverBoard('/s', copies)).toBeInstanceOf(ServerBoard);
  });
});
