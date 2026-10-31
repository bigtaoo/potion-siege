// A player's save copy from the game to the collector and back (saveVault.ts → POST /s →
// scripts/saveVault.mjs → GET /s): only the device that made a copy replaces it, an account finds
// its copy with the most battles, and copies go KEEP_MONTHS after their last change.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanSave, KEEP_MONTHS } from '../../scripts/saveVault.mjs';
import { fetchCopy, VaultUpload } from '../save/saveVault';
import { saveWith } from '../save/testSaves';
import { load, NOON, request, resetState, state, type Handler } from './collectorHarness';

vi.mock('node:http', async () => (await import('./collectorHarness')).fakeHttp);
vi.mock('node:fs', async () => (await import('./collectorHarness')).fakeFs);

const SAVES = '/data/saves';
const ID = 'a'.repeat(24);
const TOKEN = 'b'.repeat(32);
const ACCT = 'c'.repeat(16);

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

const body = (over: Record<string, unknown> = {}) => JSON.stringify({ id: ID, token: TOKEN, acct: ACCT, at: 1, save: saveWith(3), ...over });
const post = (handler: Handler, text: string) => request(handler, 'POST', '/s', text).res;
const get = (handler: Handler, acct = ACCT) => request(handler, 'GET', `/s?acct=${acct}`).res;
const savedOf = (handler: Handler, acct = ACCT): unknown => JSON.parse(get(handler, acct).body ?? 'null');
const saveOf = (handler: Handler) => (savedOf(handler) as { save: string }).save;

describe('save copies on the collector', () => {
  it("keeps the game's copy and hands it back to the account", async () => {
    const handler = await load();
    const statuses: number[] = [];
    const up = new VaultUpload('/s', (_url, text) => statuses.push(post(handler, text).status));
    up.queue({ owner: `pg:${ACCT}`, at: 5, save: saveWith(4, 2), id: ID, token: TOKEN });
    up.flush();
    expect(statuses).toEqual([204]);
    const kept = JSON.parse(String(state.files.get(`${SAVES}/${ID}.json`)));
    expect(kept).toMatchObject({ id: ID, acct: ACCT, at: NOON, runs: 4 });
    expect(JSON.stringify(kept)).not.toContain(TOKEN);
    const copy = await fetchCopy('/s', `pg:${ACCT}`, async (url) => savedOf(handler, url.split('acct=')[1]));
    expect(copy).toEqual({ owner: `pg:${ACCT}`, at: NOON, save: saveWith(4, 2) });
  });

  it("refuses a copy under another device's id", async () => {
    const handler = await load();
    expect(post(handler, body()).status).toBe(204);
    expect(post(handler, body({ token: 'd'.repeat(32), save: saveWith(99) })).status).toBe(403);
    expect(post(handler, body({ save: saveWith(5) })).status).toBe(204);
    expect(saveOf(handler)).toBe(saveWith(5));
  });

  it('names the copy with the most battles for an account played on two devices', async () => {
    const handler = await load();
    const other = 'e'.repeat(24);
    post(handler, body({ save: saveWith(8) }));
    post(handler, body({ id: other, save: saveWith(3) }));
    expect(saveOf(handler)).toBe(saveWith(8));
    post(handler, body({ id: other, save: saveWith(8, 1) }));
    expect(saveOf(handler)).toBe(saveWith(8, 1));
    // the named copy itself may go back (a restored older save)
    post(handler, body({ id: other, save: saveWith(2) }));
    expect(saveOf(handler)).toBe(saveWith(2));
  });

  it('answers 404 for an account it has nothing of and 400 for a bad one', async () => {
    const handler = await load();
    post(handler, body({ acct: undefined }));
    expect(get(handler).status).toBe(404);
    expect(get(handler, 'NOPE').status).toBe(400);
    expect(request(handler, 'GET', '/s?x=1').res.status).toBe(400);
  });

  it('takes well-formed copies only', async () => {
    const handler = await load();
    for (const bad of ['{oops', '[]', body({ id: 'short' }), body({ token: 'Z'.repeat(32) }), body({ acct: 'x' }), body({ save: '{oops' }), body({ save: '[1]' }), body({ save: 5 })]) {
      expect(post(handler, bad).status, bad).toBe(400);
    }
    expect(cleanSave(JSON.parse(body({ extra: 1, acct: undefined })))).toEqual({ id: ID, token: TOKEN, save: saveWith(3) });
    expect(cleanSave(JSON.parse(body({ save: 'x'.repeat(70_000) })))).toBeNull();
  });

  it('answers 503 when the disk refuses the copy', async () => {
    const handler = await load();
    state.readOnly = true;
    expect(post(handler, body()).status).toBe(503);
  });

  it(`drops copies ${KEEP_MONTHS} months after their last change`, async () => {
    const handler = await load();
    post(handler, body());
    const old = NOON - 430 * 86_400_000;
    for (const f of [`${SAVES}/${ID}.json`, `${SAVES}/acct-${ACCT}.json`]) state.mtimes.set(f, old);
    post(handler, body({ id: 'f'.repeat(24), acct: undefined }));
    // pruned on the next hour's first request
    vi.setSystemTime(NOON + 3600_000);
    request(handler, 'GET', '/health');
    post(handler, body({ id: 'f'.repeat(24), acct: undefined }));
    expect([...state.files.keys()].filter((f) => f.startsWith(SAVES))).toEqual([`${SAVES}/${'f'.repeat(24)}.json`]);
    expect(get(handler).status).toBe(404);
  });
});
