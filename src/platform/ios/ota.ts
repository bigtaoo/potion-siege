import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import type { AppUpdates, KeyValueStore } from '../types';

// Hot updates of the web layer (docs/ios.md "Hot updates"), from D:\standing (after D:\funny): the
// Capgo plugin in the shell, driven by hand from here against our own static manifest, never
// Capgo's cloud (capacitor.config.ts turns its update loop and its stats off).
//
// Once the game is up, `readyOta` tells the plugin this bundle booted (else, after
// appReadyTimeout, it rolls back to the one before). On the home screen, `findOta` reads the
// manifest and names a newer bundle this shell can run; the player is asked (view/updatePrompt.ts),
// and on a yes `installOta` downloads it with its progress and switches to it with set(), which
// reloads the page into it. It never arms one with next(): the plugin swaps an armed bundle in
// whenever the app goes to the background, which would throw away a run the player only switched
// away from. A bundle downloaded but not switched to (by the silent download before the prompt,
// or a set() that failed) is taken by `applyDownloaded`, first thing at the next launch.

export const MANIFEST_URL = 'https://ps-ota.gamestao.com/manifest.json';
/** Bundles come from our own host only, whatever a manifest says. */
export const BUNDLE_ORIGIN = 'https://ps-ota.gamestao.com/';
const FETCH_TIMEOUT_MS = 8000;

export interface OtaManifest {
  /** `<shell version>.<n>`, the bundle's own __PS_BUNDLE__. */
  version: string;
  /** The zipped dist-ios. */
  url: string;
  /** sha256 of the zip, hex; the plugin refuses a download without one. */
  checksum: string;
  /** The oldest shell (CFBundleShortVersionString) the bundle runs on. */
  minNativeVersion?: string;
}

/** A bundle the plugin keeps on the device. */
export interface Bundle {
  id: string;
  version: string;
  status: string;
}

/** True when dotted version `a` is strictly above `b`; missing or non-numeric parts count as 0. */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/**
 * Whether the bundle running at `running` on shell `native` should download the manifest's: newer,
 * runnable here, served from BUNDLE_ORIGIN, and not on the device already (waiting, or failed
 * once: a bundle that never booted is not fetched again until a newer one is published).
 */
export function wantsDownload(m: Partial<OtaManifest> | null, running: string, native: string, have: Bundle[]): m is OtaManifest {
  if (!m || typeof m.version !== 'string' || typeof m.url !== 'string' || typeof m.checksum !== 'string') return false;
  if (!m.checksum || !m.url.startsWith(BUNDLE_ORIGIN) || !isNewer(m.version, running)) return false;
  if (m.minNativeVersion && isNewer(m.minNativeVersion, native)) return false;
  return !have.some((b) => b.version === m.version);
}

/** The newest downloaded bundle above the running one, if any. */
export function pickDownloaded(have: Bundle[], running: string): Bundle | null {
  let best: Bundle | null = null;
  for (const b of have) {
    if ((b.status === 'pending' || b.status === 'success') && isNewer(b.version, best?.version ?? running)) best = b;
  }
  return best;
}

/** The plugin's calls this module makes, so a test can stand in for it. */
export interface Updater {
  notifyAppReady(): Promise<unknown>;
  current(): Promise<{ native: string }>;
  list(): Promise<{ bundles: Bundle[] }>;
  download(o: { url: string; version: string; checksum: string }): Promise<Bundle>;
  set(o: { id: string }): Promise<void>;
  /** Download progress, `percent` 0..100. */
  addListener(event: 'download', cb: (e: { percent: number }) => void): Promise<{ remove(): Promise<void> }>;
}

const plugin = CapacitorUpdater as unknown as Updater;

/** Bundles built by the iOS workflows, inside the shell; never in Safari or development. */
const active = (running: string, inShell: boolean) => running !== '0.0.0' && inShell;

/**
 * First thing at launch: switch to a bundle the last session downloaded. True when it did, and the
 * page is about to reload into it, so the caller boots nothing.
 */
export async function applyDownloaded(running = __PS_BUNDLE__, inShell = Capacitor.isNativePlatform(), updater = plugin): Promise<boolean> {
  if (!active(running, inShell)) return false;
  try {
    const next = pickDownloaded((await updater.list()).bundles, running);
    if (!next) return false;
    await updater.set({ id: next.id });
    return true;
  } catch (e) {
    console.warn('[ota] kept the running bundle:', e);
    return false;
  }
}

async function fetchManifest(running: string): Promise<Partial<OtaManifest> | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${MANIFEST_URL}?v=${encodeURIComponent(running)}`, { cache: 'no-store', signal: ctrl.signal });
    return res.ok ? ((await res.json()) as Partial<OtaManifest>) : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Once the game is up: this bundle booted, so the plugin keeps it. Never throws. */
export async function readyOta(running = __PS_BUNDLE__, inShell = Capacitor.isNativePlatform(), updater = plugin): Promise<void> {
  if (!active(running, inShell)) return;
  try {
    await updater.notifyAppReady();
  } catch (e) {
    console.warn('[ota] not confirmed:', e);
  }
}

/**
 * On the home screen: the manifest's bundle when this device wants it, else null. Never throws:
 * offline or a bad manifest come back null, and nothing is asked.
 */
export async function findOta(
  running = __PS_BUNDLE__,
  inShell = Capacitor.isNativePlatform(),
  updater = plugin,
  manifest: (running: string) => Promise<Partial<OtaManifest> | null> = fetchManifest,
): Promise<OtaManifest | null> {
  if (!active(running, inShell)) return null;
  try {
    const m = await manifest(running);
    const { native } = await updater.current();
    return wantsDownload(m, running, native, (await updater.list()).bundles) ? m : null;
  } catch (e) {
    console.warn('[ota] no update:', e);
    return null;
  }
}

/**
 * The player said yes: download `m`, reporting 0..1, then switch to it; the page reloads into the
 * new bundle. Rejects when the download or the switch fails, leaving the running bundle in play.
 */
export async function installOta(m: OtaManifest, progress: (f: number) => void, updater = plugin): Promise<void> {
  const listener = await updater.addListener('download', (e) => progress(Math.min(1, Math.max(0, e.percent / 100))));
  try {
    const bundle = await updater.download({ url: m.url, version: m.version, checksum: m.checksum });
    progress(1);
    await updater.set({ id: bundle.id });
  } finally {
    void listener.remove().catch(() => undefined);
  }
}

/** The rolled-back bundles already told about, so each is reported once. */
export const FAILED_KEY = 'ps.ota.failed';

/**
 * Bundles the plugin rolled back (status 'error': switched to, never confirmed by readyOta in
 * time) that this device has not reported yet; they are marked reported on the way out. Never
 * throws: the report is a diagnosis (main.ios.ts sends each as an `ota_fail` anomaly).
 */
export async function failedOta(running = __PS_BUNDLE__, inShell = Capacitor.isNativePlatform(), updater = plugin, kv: KeyValueStore = localStorage): Promise<string[]> {
  if (!active(running, inShell)) return [];
  try {
    let told: string[] = [];
    try {
      const list: unknown = JSON.parse(kv.getItem(FAILED_KEY) ?? '[]');
      if (Array.isArray(list)) told = list.filter((v): v is string => typeof v === 'string');
    } catch {
      /* a bad record: report again */
    }
    const fresh = (await updater.list()).bundles.filter((b) => b.status === 'error' && !told.includes(b.version)).map((b) => b.version);
    if (fresh.length) kv.setItem(FAILED_KEY, JSON.stringify([...told, ...fresh].slice(-20)));
    return fresh;
  } catch (e) {
    console.warn('[ota] no rollback list:', e);
    return [];
  }
}

/** The shell's hot updates, as the home screen's prompt asks for them. */
export function otaUpdates(): AppUpdates {
  return {
    check: async () => {
      const m = await findOta();
      return m && { version: m.version, install: (progress) => installOta(m, progress) };
    },
  };
}
