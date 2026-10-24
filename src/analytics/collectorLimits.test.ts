// What scripts/collector.mjs refuses before it reads a body (scripts/collectorLimits.mjs): the
// per-address budgets charged from the headers, the cap on replay bodies read at once, the 20 s
// body deadline; and /health, which answers 503 when the collector could not keep anything.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BIG_READS, BODY_MS, rateOf } from '../../scripts/collectorLimits.mjs';
import { load, NOON, request, resetState, state } from './collectorHarness';

vi.mock('node:http', async () => (await import('./collectorHarness')).fakeHttp);
vi.mock('node:fs', async () => (await import('./collectorHarness')).fakeFs);

const IP = { 'cf-connecting-ip': '1.2.3.4' };
const OTHER = { 'cf-connecting-ip': '5.6.7.8' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOON);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  resetState();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('collector budgets, charged from the headers', () => {
  it('knows each route by its method and path alone', () => {
    expect(rateOf('POST', '/e')).toBe('events');
    expect(rateOf('GET', '/b?h=web')).toBe('events');
    expect(rateOf('POST', '/r')).toBe('replays');
    for (const [m, u] of [['GET', '/health'], ['GET', '/e'], ['POST', '/r/x'], ['PUT', '/r'], ['OPTIONS', '/e']]) expect(rateOf(m, u)).toBeNull();
  });

  it('refuses a body its Content-Length puts over the minute\'s budget without reading a byte', async () => {
    const handler = await load();
    const big = { ...IP, 'content-length': String(60 * 1024) };
    // 17 declared 60 KB bodies fit in 1 MB; the 18th is refused from its headers alone
    for (let i = 0; i < 17; i++) request(handler, 'POST', '/e', '[]', big);
    const { req, res } = request(handler, 'POST', '/e', undefined, big);
    expect(res.status).toBe(429);
    expect(res.headers.Connection).toBe('close');
    expect(req.destroy).not.toHaveBeenCalled();
    // nothing listens for the body it would have sent
    req.emit('data', 'x'.repeat(60 * 1024));
    expect(res.status).toBe(429);
    expect(request(handler, 'POST', '/e', '[]', OTHER).res.status).toBe(204);
  });

  it('charges the bytes past what was declared as they come', async () => {
    const handler = await load();
    // bodies that say 2 bytes and send 60 KB: the 18th goes over 1 MB and is cut off
    const small = { ...IP, 'content-length': '2' };
    const chunk = 'x'.repeat(60 * 1024);
    for (let i = 0; i < 17; i++) expect(request(handler, 'POST', '/e', chunk, small).res.status).toBe(400);
    const { req, res } = request(handler, 'POST', '/e', chunk, small);
    expect(res.status).toBe(429);
    expect(req.destroy).toHaveBeenCalled();
  });

  it('answers 413 to a declared body over the route\'s limit, before reading it', async () => {
    const handler = await load();
    expect(request(handler, 'POST', '/e', undefined, { 'content-length': String(64 * 1024 + 1) }).res.status).toBe(413);
    expect(request(handler, 'POST', '/r', undefined, { 'content-length': String(256 * 1024 + 1) }).res.status).toBe(413);
    expect(request(handler, 'POST', '/r', '{}', { 'content-length': String(256 * 1024) }).res.status).toBe(400);
  });

  it('allows 20 replays per address per minute, apart from the events', async () => {
    const handler = await load();
    for (let i = 0; i < 20; i++) expect(request(handler, 'POST', '/r', '{}', IP).res.status).toBe(400);
    expect(request(handler, 'POST', '/r', '{}', IP).res.status).toBe(429);
    expect(request(handler, 'POST', '/e', '[]', IP).res.status).toBe(204);
    expect(request(handler, 'POST', '/r', '{}', OTHER).res.status).toBe(400);
    vi.setSystemTime(NOON + 60_000);
    expect(request(handler, 'POST', '/r', '{}', IP).res.status).toBe(400);
  });

  it('logs per route how many addresses went over a byte budget', async () => {
    const handler = await load();
    const big = { ...IP, 'content-length': String(250 * 1024) };
    for (let i = 0; i < 17; i++) request(handler, 'POST', '/r', '{}', big);
    const log = vi.mocked(console.log);
    log.mockClear();
    vi.setSystemTime(NOON + 60_000);
    request(handler, 'POST', '/e', '[]', IP);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(`1 address(es) sent over ${4 * 1024 * 1024} bytes in a minute (replays)`));
  });
});

describe('collector body reads', () => {
  it(`reads ${BIG_READS} replay bodies at once and turns the next away with 503`, async () => {
    const handler = await load();
    const open = Array.from({ length: BIG_READS }, (_, i) => request(handler, 'POST', '/r', undefined, { 'cf-connecting-ip': `10.0.${i}.1` }));
    expect(open.every(({ res }) => res.status === 0)).toBe(true);
    const turned = request(handler, 'POST', '/r', undefined, OTHER).res;
    expect(turned.status).toBe(503);
    expect(turned.headers['Retry-After']).toBe('5');
    // event batches are small and never wait on the gate
    expect(request(handler, 'POST', '/e', '[]', OTHER).res.status).toBe(204);
    // one read done frees its place
    open[0].req.emit('data', '{}');
    open[0].req.emit('end');
    expect(open[0].res.status).toBe(400);
    expect(request(handler, 'POST', '/r', '{}', OTHER).res.status).toBe(400);
  });

  it('frees a place when the client goes away mid-body', async () => {
    const handler = await load();
    const open = Array.from({ length: BIG_READS }, (_, i) => request(handler, 'POST', '/r', undefined, { 'cf-connecting-ip': `10.0.${i}.1` }));
    open[5].req.emit('close');
    expect(open[5].res.ended).toBe(false);
    expect(request(handler, 'POST', '/r', '{}', OTHER).res.status).toBe(400);
  });

  it(`cuts off a body not done in ${BODY_MS / 1000} s with a 408`, async () => {
    const handler = await load();
    const { req, res } = request(handler, 'POST', '/e');
    req.emit('data', '[');
    vi.advanceTimersByTime(BODY_MS - 1);
    expect(res.status).toBe(0);
    vi.advanceTimersByTime(1);
    expect(res.status).toBe(408);
    expect(req.destroy).toHaveBeenCalled();
    // what comes after changes nothing
    req.emit('data', ']');
    req.emit('end');
    expect(res.status).toBe(408);
  });

  it('frees the replay gate after a 408', async () => {
    const handler = await load();
    const open = Array.from({ length: BIG_READS }, (_, i) => request(handler, 'POST', '/r', undefined, { 'cf-connecting-ip': `10.0.${i}.1` }));
    vi.advanceTimersByTime(BODY_MS);
    expect(open.every(({ res }) => res.status === 408)).toBe(true);
    expect(request(handler, 'POST', '/r', '{}', OTHER).res.status).toBe(400);
  });
});

describe('collector /health', () => {
  it('answers 200 while the data directory takes writes and the disk has room', async () => {
    const handler = await load();
    const ok = request(handler, 'GET', '/health').res;
    expect([ok.status, ok.body]).toEqual([200, 'ok']);

    state.free = 100 * 1024 * 1024;
    const full = request(handler, 'GET', '/health').res;
    expect([full.status, full.body]).toEqual([503, 'unhealthy']);

    state.free = 10 * 1024 ** 3;
    state.readOnly = true;
    expect(request(handler, 'GET', '/health').res.status).toBe(503);
  });

  it('is never rate limited', async () => {
    const handler = await load();
    for (let i = 0; i < 300; i++) request(handler, 'POST', '/e', '[]', IP);
    expect(request(handler, 'POST', '/e', '[]', IP).res.status).toBe(429);
    expect(request(handler, 'GET', '/health', undefined, IP).res.status).toBe(200);
  });
});
