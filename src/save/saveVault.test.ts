import { afterEach, describe, expect, it, vi } from 'vitest';
import { GUEST } from './saveCopies';
import type { MirrorCopy } from './saveMirror';
import { acctOf, fetchCopy, FETCH_MS, SEND_MS, vaultUrl, VaultUpload } from './saveVault';

afterEach(() => {
  vi.useRealTimers();
});

const copy = (owner: string, save = 's', at = 1): MirrorCopy => ({ owner, save, at, id: 'a'.repeat(24), token: 'b'.repeat(32) });

describe('saveVault', () => {
  it('sits beside the events route and knows an account by its hash', () => {
    expect(vaultUrl('https://ps.example.com/e')).toBe('https://ps.example.com/s');
    expect([acctOf('pg:12ab'), acctOf('cg:34cd'), acctOf('gc:56ef'), acctOf(GUEST)]).toEqual(['12ab', '34cd', '56ef', null]);
  });

  it("fetches an account's copy by its hash, never a guest's", async () => {
    const asked: string[] = [];
    const get = async (url: string) => (asked.push(url), { at: 5, save: 'x' });
    expect(await fetchCopy('/s', 'pg:12ab', get)).toEqual({ owner: 'pg:12ab', at: 5, save: 'x' });
    expect(await fetchCopy('/s', GUEST, get)).toBeNull();
    expect(asked).toEqual(['/s?acct=12ab']);
  });

  it('takes no copy from a bad answer, an error or a server too slow', async () => {
    expect(await fetchCopy('/s', 'pg:1', async () => null)).toBeNull();
    expect(await fetchCopy('/s', 'pg:1', async () => ({ at: '5', save: 'x' }))).toBeNull();
    expect(await fetchCopy('/s', 'pg:1', async () => Promise.reject(new Error('offline')))).toBeNull();
    vi.useFakeTimers();
    const slow = fetchCopy('/s', 'pg:1', (_url, signal) => new Promise((_r, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));
    vi.advanceTimersByTime(FETCH_MS);
    expect(await slow).toBeNull();
  });

  it('sends the latest change once SEND_MS after the first, or at once when the page hides', () => {
    vi.useFakeTimers();
    const posted: [string, unknown][] = [];
    const up = new VaultUpload('/s', (url, body) => void posted.push([url, JSON.parse(body)]));
    const on = new Map<string, () => void>();
    const doc = { visibilityState: 'visible', addEventListener: (e: string, fn: () => void) => void on.set(e, fn) };
    up.listen(doc as unknown as Document, { addEventListener: (e: string, fn: () => void) => void on.set(e, fn) } as unknown as Window);
    up.queue(copy('pg:12ab', 's1', 1));
    up.queue(copy('pg:12ab', 's2', 2));
    vi.advanceTimersByTime(SEND_MS - 1);
    expect(posted).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(posted).toEqual([['/s', { id: 'a'.repeat(24), token: 'b'.repeat(32), acct: '12ab', at: 2, save: 's2' }]]);
    up.queue(copy(GUEST, 's3', 3));
    on.get('visibilitychange')?.();
    expect(posted).toHaveLength(1);
    doc.visibilityState = 'hidden';
    on.get('visibilitychange')?.();
    expect(posted[1][1]).toEqual({ id: 'a'.repeat(24), token: 'b'.repeat(32), at: 3, save: 's3' });
    on.get('pagehide')?.();
    vi.advanceTimersByTime(SEND_MS);
    expect(posted).toHaveLength(2);
  });

  it('survives a post that throws', () => {
    const up = new VaultUpload('/s', () => {
      throw new Error('blocked');
    });
    up.queue(copy(GUEST));
    expect(() => up.flush()).not.toThrow();
  });
});
