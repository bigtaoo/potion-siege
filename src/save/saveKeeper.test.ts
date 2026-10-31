import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAVE_KEY } from '../game/keys';
import type { KeyValueStore } from '../platform/types';
import { GUEST } from './saveCopies';
import { keepSaves, SaveKeeper, vaultFor } from './saveKeeper';
import { SaveMirror } from './saveMirror';
import { VaultUpload } from './saveVault';
import { saveWith } from './testSaves';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function memory(init: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(init));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

/** A device: its browser storage (the mirror's) and what went to the server. */
function device() {
  const local = memory();
  const posted: Record<string, unknown>[] = [];
  const upload = () => new VaultUpload('/s', (_url, body) => void posted.push(JSON.parse(body)));
  return { local, posted, upload, mirror: () => new SaveMirror(local) };
}

const A = 'pg:aaaa';
const B = 'pg:bbbb';

describe('SaveKeeper', () => {
  it('copies every save with a battle in it to the mirror and the server', () => {
    const d = device();
    const host = memory();
    const upload = d.upload();
    const k = new SaveKeeper(host, { owner: GUEST, mirror: d.mirror(), upload, now: () => 7 });
    k.setItem(SAVE_KEY, saveWith(0));
    k.setItem('mb.lang', 'de');
    expect(d.mirror().all()).toEqual([]);
    k.setItem(SAVE_KEY, saveWith(1));
    expect(host.getItem(SAVE_KEY)).toBe(saveWith(1));
    expect(k.getItem('mb.lang')).toBe('de');
    expect(d.mirror().of(GUEST)?.save).toBe(saveWith(1));
    k.flush();
    expect(d.posted).toMatchObject([{ at: 7, save: saveWith(1) }]);
  });

  it("copies the host's save at boot when the mirror lacks it", () => {
    const d = device();
    new SaveKeeper(memory({ [SAVE_KEY]: saveWith(3) }), { owner: GUEST, mirror: d.mirror(), upload: null });
    expect(d.mirror().of(GUEST)?.save).toBe(saveWith(3));
    const upload = d.upload();
    new SaveKeeper(memory({ [SAVE_KEY]: saveWith(3) }), { owner: GUEST, mirror: d.mirror(), upload });
    upload.flush();
    expect(d.posted).toEqual([]);
  });

  it("puts back the save the host lost before the game reads it", () => {
    const d = device();
    new SaveKeeper(memory(), { owner: A, mirror: d.mirror(), upload: null }).setItem(SAVE_KEY, saveWith(5));
    const host = memory();
    const k = new SaveKeeper(host, { owner: A, mirror: d.mirror(), upload: null });
    expect([k.restored?.source, host.getItem(SAVE_KEY)]).toEqual(['mirror', saveWith(5)]);
  });

  it("takes the server's copy when it is ahead", () => {
    const d = device();
    const host = memory({ [SAVE_KEY]: saveWith(2) });
    const k = new SaveKeeper(host, { owner: A, mirror: d.mirror(), upload: null }, { owner: A, at: 1, save: saveWith(9) });
    expect([k.restored?.source, host.getItem(SAVE_KEY), d.mirror().of(A)?.save]).toEqual(['server', saveWith(9), saveWith(9)]);
  });

  it('switching accounts on one device: each keeps its own, a guest is handed to one account only', () => {
    const d = device();
    const play = (owner: string, host: KeyValueStore, runs: number) => {
      const k = new SaveKeeper(host, { owner, mirror: d.mirror(), upload: null });
      if (runs) k.setItem(SAVE_KEY, saveWith(runs));
      return k;
    };
    // a guest plays 4 battles, then signs in as A, whose cloud is empty: A takes them
    const guestHost = memory();
    play(GUEST, guestHost, 4);
    const aCloud = memory();
    expect(play(A, aCloud, 0).restored).toMatchObject({ adopted: GUEST, save: saveWith(4) });
    play(A, aCloud, 6);
    expect(d.mirror().of(GUEST)?.from).toBe(A);
    // B signs in on the same device: the guest's progress went to A, so B starts fresh
    expect(play(B, memory(), 0).restored).toBeNull();
    // the guest keeps playing their own; A, its cloud lost, takes it back
    expect(play(GUEST, guestHost, 0).restored).toBeNull();
    expect(play(A, memory(), 0).restored).toMatchObject({ save: saveWith(6), source: 'mirror' });
    // a guest copy taken from an account is never handed to another one either
    const d2 = device();
    new SaveKeeper(memory(), { owner: A, mirror: d2.mirror(), upload: null }).setItem(SAVE_KEY, saveWith(6));
    const signedOut = memory();
    const g = new SaveKeeper(signedOut, { owner: GUEST, mirror: d2.mirror(), upload: null });
    expect(g.restored).toMatchObject({ adopted: A, from: A });
    expect(d2.mirror().of(GUEST)?.from).toBe(A);
    g.setItem(SAVE_KEY, saveWith(7));
    expect(d2.mirror().of(GUEST)?.from).toBe(A);
    expect(new SaveKeeper(memory(), { owner: B, mirror: d2.mirror(), upload: null }).restored).toBeNull();
    // A back on a fresh cloud gets the guest's further progress
    expect(new SaveKeeper(memory(), { owner: A, mirror: d2.mirror(), upload: null }).restored).toMatchObject({ save: saveWith(7), adopted: GUEST });
  });
});

describe('vaultFor', () => {
  it('is off without a collector, on a host that blocks it and on a local preview', () => {
    const web = { hostname: 'ps.example.com', protocol: 'https:' };
    vi.stubEnv('VITE_ANALYTICS_URL', '');
    expect(vaultFor(false, web)).toBeNull();
    vi.stubEnv('VITE_ANALYTICS_URL', 'https://c.example.com/e');
    expect(vaultFor(false, web)).toBe('https://c.example.com/s');
    expect(vaultFor(true, web)).toBeNull();
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) expect(vaultFor(false, { hostname, protocol: 'http:' })).toBeNull();
    expect(vaultFor(false, { hostname: 'localhost', protocol: 'capacitor:' })).toBe('https://c.example.com/s');
  });
});

describe('keepSaves', () => {
  it("asks the server for an account's copy and uploads from then on", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const d = device();
    const host = memory();
    const get = vi.fn(async (_url: string) => ({ at: 3, save: saveWith(4) }));
    const k = await keepSaves(host, A, { url: '/s', get, mirror: d.mirror() });
    expect([get.mock.calls[0][0], k.restored?.source, host.getItem(SAVE_KEY)]).toEqual(['/s?acct=aaaa', 'server', saveWith(4)]);
    expect(console.info).toHaveBeenCalledWith('[potion-siege] save restored from server');
    const none = await keepSaves(memory(), GUEST, { url: null, mirror: device().mirror() });
    expect(none.restored).toBeNull();
  });
});
