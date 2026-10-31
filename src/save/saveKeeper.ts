// The host's store with our own copies of the save beside it (saveCopies.ts says which wins at
// boot). Built before boot() reads the save: it picks the copy to start from and puts it in the
// host's store, then every save the game writes also lands in the device's mirror (saveMirror.ts)
// and, a little later, on our server (saveVault.ts). A guest copy an account took is marked as that
// account's, so a second account signing in on the device starts on its own. A save with no battle in it is not copied:
// it holds nothing to lose, and it must never stand in for one that does.

import { SAVE_KEY } from '../game/keys';
import { browserStorage } from '../platform/web';
import type { KeyValueStore } from '../platform/types';
import { GUEST, isFresh, pickCopy, type CopyPick, type Owner, type SaveCopy } from './saveCopies';
import { SaveMirror } from './saveMirror';
import { fetchCopy, vaultUrl, VaultUpload, type Get } from './saveVault';

export interface KeeperParts {
  owner: Owner;
  mirror: SaveMirror;
  upload: VaultUpload | null;
  now?: () => number;
}

export class SaveKeeper implements KeyValueStore {
  private readonly now: () => number;
  /** What was restored at boot, if anything: where from and whose it was. */
  readonly restored: CopyPick | null;

  /** Starts from the best copy of `owner`'s save (`server`: our server's, if one came). */
  constructor(
    private readonly inner: KeyValueStore,
    private readonly parts: KeeperParts,
    server: SaveCopy | null = null,
  ) {
    this.now = parts.now ?? Date.now;
    const host = inner.getItem(SAVE_KEY);
    const restored = (this.restored = pickCopy(parts.owner, host, parts.mirror.all(), server));
    if (restored) {
      // the guest's progress went to this account: no other account takes it after
      if (restored.adopted === GUEST) parts.mirror.claim(GUEST, parts.owner);
      inner.setItem(SAVE_KEY, restored.save);
      this.keep(restored.save, restored.from);
    } else if (host !== null && !isFresh(host) && parts.mirror.of(parts.owner)?.save !== host) this.keep(host);
  }

  getItem(key: string): string | null {
    return this.inner.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.inner.setItem(key, value);
    if (key === SAVE_KEY && !isFresh(value)) this.keep(value);
  }

  /** Sends the copy that waits for the server (the page is being hidden). */
  flush(): void {
    this.parts.upload?.flush();
  }

  private keep(save: string, from?: Owner): void {
    const copy = this.parts.mirror.put(this.parts.owner, save, this.now(), { from });
    this.parts.upload?.queue(copy);
  }
}

/** The collector's save route, or null where nothing goes to it: no collector in this build, a
 *  host that blocks it, or a local preview (the iOS app's capacitor://localhost does send). */
export function vaultFor(blocked: boolean, loc: Pick<Location, 'hostname' | 'protocol'> = location): string | null {
  const url = import.meta.env.VITE_ANALYTICS_URL as string | undefined;
  if (!url || blocked) return null;
  const h = loc.hostname;
  if (loc.protocol !== 'capacitor:' && (h === 'localhost' || h === '[::1]' || h.startsWith('127.'))) return null;
  return vaultUrl(url);
}

/** `inner` with our copies kept beside it, for `owner`; asks our server first for an account's copy. */
export async function keepSaves(
  inner: KeyValueStore,
  owner: Owner,
  opts: { url: string | null; get?: Get; mirror?: SaveMirror; doc?: Document; win?: Window } = { url: null },
): Promise<SaveKeeper> {
  const mirror = opts.mirror ?? new SaveMirror(browserStorage());
  const server = opts.url ? await fetchCopy(opts.url, owner, opts.get) : null;
  const upload = opts.url ? new VaultUpload(opts.url) : null;
  if (upload && opts.doc && opts.win) upload.listen(opts.doc, opts.win);
  const keeper = new SaveKeeper(inner, { owner, mirror, upload }, server);
  if (keeper.restored) console.info(`[potion-siege] save restored from ${keeper.restored.source}${keeper.restored.adopted ? ` (${keeper.restored.adopted})` : ''}`);
  return keeper;
}
