// scripts/collector.mjs, run in-process (collectorHarness.ts): the day files, the events and
// load checkpoints it keeps, and the per-address budgets. Bodies and /health: collectorLimits.test.ts;
// replays: collectorReplays.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayFile, DIR, lines, load, NOON, request, resetState, state, TODAY } from './collectorHarness';

vi.mock('node:http', async () => (await import('./collectorHarness')).fakeHttp);
vi.mock('node:fs', async () => (await import('./collectorHarness')).fakeFs);

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

describe('collector setup', () => {
  it('writes one file per UTC day under COLLECTOR_DIR, on PORT', async () => {
    const handler = await load({ COLLECTOR_DIR: DIR, PORT: '9001' });
    expect(state.port).toBe(9001);
    expect(state.dirs).toEqual([DIR, `${DIR}/replays`]);
    request(handler, 'POST', '/e', JSON.stringify([{ name: 'run_start', uid: 'u' }]));
    vi.setSystemTime(NOON + 86_400_000);
    request(handler, 'POST', '/e', JSON.stringify([{ name: 'run_end', uid: 'u' }]));
    expect(lines(TODAY).map((e) => e.name)).toEqual(['run_start']);
    expect(lines(dayFile('2026-10-19')).map((e) => e.name)).toEqual(['run_end']);
  });

  it('defaults to port 8787 and a single file, or takes both from the command line', async () => {
    const handler = await load({});
    expect(state.port).toBe(8787);
    expect(state.dirs).toEqual(['telemetry', 'telemetry/replays']);
    request(handler, 'POST', '/e', JSON.stringify([{ name: 'run_start', uid: 'u' }]));
    expect(lines('telemetry/events.ndjson')).toHaveLength(1);

    state.dirs.length = 0;
    const custom = await load({}, ['9100', 'out/x.ndjson']);
    expect(state.port).toBe(9100);
    expect(state.dirs).toEqual(['out', 'out/replays']);
    request(custom, 'POST', '/e', JSON.stringify([{ name: 'run_start', uid: 'u' }]));
    expect(lines('out/x.ndjson')).toHaveLength(1);
  });
});

describe('collector retention', () => {
  const day = (iso: string) => state.files.set(dayFile(iso), '{}\n');

  it('deletes day files older than 14 months at start and on the first request of each day', async () => {
    for (const d of ['2025-08-17', '2025-08-18', '2025-08-19', '2026-10-17']) day(d);
    state.files.set(`${DIR}/notes.txt`, 'keep');
    state.files.set(`${DIR}/events-2020-01-01.ndjson.bak`, 'keep');
    const handler = await load();
    expect([...state.files.keys()].sort()).toEqual([
      `${DIR}/events-2020-01-01.ndjson.bak`,
      dayFile('2025-08-18'),
      dayFile('2025-08-19'),
      dayFile('2026-10-17'),
      `${DIR}/notes.txt`,
    ]);

    // the next day's first request, even the healthcheck, takes the next file
    vi.setSystemTime(NOON + 86_400_000);
    request(handler, 'GET', '/health');
    expect(state.files.has(dayFile('2025-08-18'))).toBe(false);
    expect(state.files.has(dayFile('2025-08-19'))).toBe(true);
  });

  it('keeps everything in single-file mode', async () => {
    state.files.set('telemetry/events-2000-01-01.ndjson', '{}\n');
    await load({});
    expect(state.files.has('telemetry/events-2000-01-01.ndjson')).toBe(true);
  });
});

describe('collector POST /e', () => {
  it('stores each valid event of a batch as one line, stamped with the time received', async () => {
    const handler = await load();
    const batch = [
      { name: 'run_start', uid: 'u1', sid: 's1', ts: 5, props: { run: 1 } },
      { name: 'run_end', uid: 'u1', sid: 's1', ts: 6, props: { run: 1, result: 'won' } },
    ];
    const json = JSON.stringify(batch);
    const { res } = request(handler, 'POST', '/e', [json.slice(0, 10), json.slice(10)]);
    expect(res.status).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(lines(TODAY)).toEqual(batch.map((e) => ({ ...e, received: NOON })));

    // a second batch appends
    request(handler, 'POST', '/e', JSON.stringify([{ name: 'wave_start', uid: 'u2' }]));
    expect(lines(TODAY)).toHaveLength(3);
  });

  it('drops events without a string name and uid, and writes nothing when none are left', async () => {
    const handler = await load();
    const batch = [null, 3, { name: 'home_view' }, { uid: 'u' }, { name: 7, uid: 'u' }, { name: 'home_view', uid: 'u' }];
    expect(request(handler, 'POST', '/e', JSON.stringify(batch)).res.status).toBe(204);
    expect(lines(TODAY).map((e) => e.name)).toEqual(['home_view']);

    state.files.clear();
    expect(request(handler, 'POST', '/e', JSON.stringify([{ name: 'home_view' }])).res.status).toBe(204);
    expect(request(handler, 'POST', '/e', '[]').res.status).toBe(204);
    expect(state.files.size).toBe(0);
  });

  it('rejects bad JSON and anything but an array', async () => {
    const handler = await load();
    for (const body of ['{not json', '', JSON.stringify({ name: 'a', uid: 'u' }), 'null']) {
      const { res } = request(handler, 'POST', '/e', body);
      expect(res.status, body).toBe(400);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    }
    expect(state.files.size).toBe(0);
  });

  it('cuts off a body over 64 KB with a 413', async () => {
    const handler = await load();
    const { req, res } = request(handler, 'POST', '/e');
    req.emit('data', 'x'.repeat(60 * 1024));
    expect(req.destroy).not.toHaveBeenCalled();
    req.emit('data', 'x'.repeat(5 * 1024));
    expect(req.destroy).toHaveBeenCalled();
    expect(res.status).toBe(413);
    expect(res.headers.Connection).toBe('close');
  });

  it('stops writing to a day file that is already full, and says so once', async () => {
    const handler = await load();
    state.sizeOverride = 512 * 1024 * 1024;
    const log = vi.mocked(console.log);
    log.mockClear();
    for (let i = 0; i < 3; i++) {
      expect(request(handler, 'POST', '/e', JSON.stringify([{ name: 'run_start', uid: 'u' }])).res.status).toBe(204);
    }
    expect(state.files.size).toBe(0);
    expect(log.mock.calls.filter(([m]) => String(m).includes('reached'))).toHaveLength(1);
  });
});

describe('collector routes', () => {
  it('answers the healthcheck and CORS preflight', async () => {
    const handler = await load();
    const health = request(handler, 'GET', '/health').res;
    expect(health.status).toBe(200);
    expect(health.body).toBe('ok');
    const preflight = request(handler, 'OPTIONS', '/e').res;
    expect(preflight.status).toBe(204);
    expect(preflight.headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
  });

  it('answers 404 to the wrong method or path', async () => {
    const handler = await load();
    for (const [method, url] of [['GET', '/e'], ['PUT', '/e'], ['POST', '/'], ['POST', '/e/x'], ['GET', '/b']]) {
      expect(request(handler, method, url).res.status, `${method} ${url}`).toBe(404);
    }
    expect(state.files.size).toBe(0);
  });
});

describe('collector GET /b load checkpoints', () => {
  it('stores a checkpoint with its optional fields', async () => {
    const handler = await load();
    const { res } = request(handler, 'GET', '/b?h=crazygames&s=open_desktop&b=71457b8&ms=1234&n=1&r=reddit');
    expect(res.status).toBe(204);
    expect(lines(TODAY)).toEqual([
      { name: 'beacon', step: 'open_desktop', host: 'crazygames', build: '71457b8', ts: NOON, received: NOON, ms: 1234, new: true, src: 'reddit' },
    ]);
  });

  it('leaves out optional fields that are missing or out of range', async () => {
    const handler = await load();
    request(handler, 'GET', '/b?h=web&s=loaded_touch&b=x.1&ms=-1&n=2&r=Not%20A%20Tag');
    request(handler, 'GET', '/b?h=web&s=open_touch&b=2&ms=3600000&n=0');
    expect(lines(TODAY)).toEqual([
      { name: 'beacon', step: 'loaded_touch', host: 'web', build: 'x.1', ts: NOON, received: NOON },
      { name: 'beacon', step: 'open_touch', host: 'web', build: '2', ts: NOON, received: NOON, new: false },
    ]);
  });

  it('rejects an unknown step, host or a missing or malformed build', async () => {
    const handler = await load();
    for (const q of ['h=web&s=closed_desktop&b=1', 'h=itch&s=open_desktop&b=1', 'h=web&s=open_desktop', 'h=web&s=open_desktop&b=a%20b', `h=web&s=open_desktop&b=${'1'.repeat(41)}`]) {
      expect(request(handler, 'GET', `/b?${q}`).res.status, q).toBe(400);
    }
    expect(state.files.size).toBe(0);
  });

  it('skips a checkpoint when the day file is full', async () => {
    const handler = await load();
    state.sizeOverride = 512 * 1024 * 1024;
    expect(request(handler, 'GET', '/b?h=web&s=open_desktop&b=1').res.status).toBe(204);
    expect(state.files.size).toBe(0);
  });
});

describe('collector rate limit', () => {
  it('allows 240 requests per address per minute, counted over events and checkpoints', async () => {
    const handler = await load();
    const ip = { 'cf-connecting-ip': '1.2.3.4' };
    for (let i = 0; i < 120; i++) request(handler, 'POST', '/e', '[]', ip);
    for (let i = 0; i < 120; i++) request(handler, 'GET', '/b?h=web&s=open_desktop&b=1', undefined, ip);
    expect(request(handler, 'POST', '/e', '[]', ip).res.status).toBe(429);
    expect(request(handler, 'GET', '/b?h=web&s=open_desktop&b=1', undefined, ip).res.status).toBe(429);

    // another address, the healthcheck and the next minute are not limited
    expect(request(handler, 'POST', '/e', '[]', { 'cf-connecting-ip': '5.6.7.8' }).res.status).toBe(204);
    expect(request(handler, 'POST', '/e', '[]').res.status).toBe(204);
    expect(request(handler, 'GET', '/health', undefined, ip).res.status).toBe(200);
    vi.setSystemTime(NOON + 60_000);
    expect(request(handler, 'POST', '/e', '[]', ip).res.status).toBe(204);
  });

  it('allows 1 MB of bodies per address per minute, and logs the count of addresses over it', async () => {
    const handler = await load();
    const ip = { 'cf-connecting-ip': '1.2.3.4' };
    const chunk = 'x'.repeat(60 * 1024);
    // 17 bodies of 60 KB fit; the 18th goes over and is cut off with a 429
    for (let i = 0; i < 17; i++) expect(request(handler, 'POST', '/e', '[]', ip).res.status).toBe(204);
    for (let i = 0; i < 17; i++) request(handler, 'POST', '/e', chunk, ip);
    const over = request(handler, 'POST', '/e', chunk, ip);
    expect(over.res.status).toBe(429);
    expect(over.req.destroy).toHaveBeenCalled();
    // and the address is refused before it sends anything more this minute
    expect(request(handler, 'POST', '/e', '[]', ip).res.status).toBe(429);
    expect(request(handler, 'POST', '/e', '[]', { 'cf-connecting-ip': '5.6.7.8' }).res.status).toBe(204);

    const log = vi.mocked(console.log);
    log.mockClear();
    vi.setSystemTime(NOON + 60_000);
    expect(request(handler, 'POST', '/e', '[]', ip).res.status).toBe(204);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('1 address(es) sent over 1048576 bytes'));
    expect(String(log.mock.calls)).not.toContain('1.2.3.4');
  });
});
