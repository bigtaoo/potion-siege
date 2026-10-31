// Our own copy of the save on the device (saveCopies.ts), one per owner, under MIRROR_KEY: in the
// browser's storage, or on Playgama in Bridge's store (PlaygamaPlatform.ts), which then moves it
// between the portal's cloud and its guest store with the account, so only our server's copy
// (saveVault.ts) crosses accounts there. Each owner's copy also carries the random id and secret our
// server keeps it under.

import type { KeyValueStore } from '../platform/types';
import type { Owner, SaveCopy } from './saveCopies';

export const MIRROR_KEY = 'ps.copies';
/** Owners kept on one device, the latest written first. */
export const MAX_OWNERS = 4;

export interface MirrorCopy extends SaveCopy {
  /** Our server's name for this copy, and the secret that lets this device replace it. */
  id: string;
  token: string;
}

export function hexId(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const HEX = /^[0-9a-f]{16,64}$/;

function readCopy(v: unknown): MirrorCopy | null {
  if (!v || typeof v !== 'object') return null;
  const c = v as Record<string, unknown>;
  if (!text(c.owner, 64) || !text(c.save, 200_000) || typeof c.at !== 'number' || !Number.isFinite(c.at)) return null;
  if (typeof c.id !== 'string' || !HEX.test(c.id) || typeof c.token !== 'string' || !HEX.test(c.token)) return null;
  const out: MirrorCopy = { owner: c.owner, at: c.at, save: c.save, id: c.id, token: c.token };
  if (text(c.from, 64)) out.from = c.from;
  return out;
}

export class SaveMirror {
  private copies: MirrorCopy[];

  constructor(
    private readonly store: KeyValueStore | null,
    private readonly ids: (bytes: number) => string = hexId,
  ) {
    this.copies = this.read();
  }

  all(): MirrorCopy[] {
    return [...this.copies];
  }

  of(owner: Owner): MirrorCopy | undefined {
    return this.copies.find((c) => c.owner === owner);
  }

  /** Writes `owner`'s copy, keeping its server id, and its `from` unless one is given. Returns
   *  the copy as kept. */
  put(owner: Owner, save: string, at: number, opts: { from?: Owner } = {}): MirrorCopy {
    const was = this.of(owner);
    const copy: MirrorCopy = { owner, at, save, id: was ? was.id : this.ids(12), token: was ? was.token : this.ids(16) };
    const from = opts.from ?? was?.from;
    if (from) copy.from = from;
    this.copies = [copy, ...this.copies.filter((c) => c.owner !== owner)].slice(0, MAX_OWNERS);
    this.write();
    return copy;
  }

  /** Marks `owner`'s copy as taken by the account `by`, which no other account may then take. */
  claim(owner: Owner, by: Owner): void {
    const c = this.of(owner);
    if (!c || c.from === by) return;
    c.from = by;
    this.write();
  }

  private read(): MirrorCopy[] {
    try {
      const doc = JSON.parse(this.store?.getItem(MIRROR_KEY) ?? 'null') as { copies?: unknown } | null;
      if (!doc || !Array.isArray(doc.copies)) return [];
      return doc.copies.map(readCopy).filter((c): c is MirrorCopy => c !== null).slice(0, MAX_OWNERS);
    } catch {
      return [];
    }
  }

  private write(): void {
    try {
      this.store?.setItem(MIRROR_KEY, JSON.stringify({ v: 1, copies: this.copies }));
    } catch {
      // full or blocked: the host's store still has the save
    }
  }
}
