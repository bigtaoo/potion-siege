import { describe, expect, it, vi } from 'vitest';
import releaseWorkflow from '../../../.github/workflows/release-ios.yml?raw';
import otaWorkflow from '../../../.github/workflows/ota-ios.yml?raw';
import wrangler from '../../../wrangler/ota.jsonc?raw';
import capConfig from '../../../capacitor.config.ts?raw';
import podfile from '../../../ios/App/Podfile?raw';
import privacy from '../../../ios/App/App/PrivacyInfo.xcprivacy?raw';
import { applyDownloaded, BUNDLE_ORIGIN, FAILED_KEY, failedOta, findOta, installOta, isNewer, MANIFEST_URL, otaUpdates, pickDownloaded, readyOta, wantsDownload, type Bundle, type Updater } from './ota';

const manifest = { version: '1.0.18.2', url: 'https://ps-ota.gamestao.com/1.0.18.2.zip', checksum: 'ab12', minNativeVersion: '1.0' };

function fakeUpdater(bundles: Bundle[] = [], native = '1.0', fail = false): Updater & { calls: string[] } {
  const calls: string[] = [];
  let onDownload: ((e: { percent: number }) => void) | undefined;
  return {
    calls,
    notifyAppReady: async () => { calls.push('ready'); },
    current: async () => ({ native }),
    list: async () => ({ bundles }),
    download: async (o) => {
      calls.push(`download ${o.version} ${o.checksum}`);
      if (fail) throw new Error('offline');
      onDownload?.({ percent: 50 });
      return { id: 'x', version: o.version, status: 'pending' };
    },
    addListener: async (_e, cb) => {
      onDownload = cb;
      return { remove: async () => { calls.push('unlisten'); } };
    },
    set: async (o) => { calls.push(`set ${o.id}`); },
  };
}

describe('version order', () => {
  it('compares dotted numbers, not strings', () => {
    expect(isNewer('1.0.18.10', '1.0.18.9')).toBe(true);
    expect(isNewer('1.0.19', '1.0.18.7')).toBe(true);
    expect(isNewer('1.0.18.1', '1.0.18')).toBe(true);
    expect(isNewer('1.0.18', '1.0.18')).toBe(false);
    expect(isNewer('1.0.18', '1.0.18.1')).toBe(false);
  });
});

describe('wantsDownload', () => {
  it('takes a newer bundle this shell can run', () => {
    expect(wantsDownload(manifest, '1.0.18.1', '1.0', [])).toBe(true);
  });

  it('refuses what is not newer, needs a newer shell, has no checksum or is on the device', () => {
    expect(wantsDownload(manifest, '1.0.18.2', '1.0', [])).toBe(false);
    expect(wantsDownload(manifest, '1.0.19', '1.0', [])).toBe(false);
    expect(wantsDownload({ ...manifest, minNativeVersion: '1.1' }, '1.0.18', '1.0', [])).toBe(false);
    expect(wantsDownload({ ...manifest, checksum: '' }, '1.0.18', '1.0', [])).toBe(false);
    expect(wantsDownload({ version: '9' }, '1.0.18', '1.0', [])).toBe(false);
    expect(wantsDownload(null, '1.0.18', '1.0', [])).toBe(false);
    expect(wantsDownload(manifest, '1.0.18', '1.0', [{ id: 'a', version: '1.0.18.2', status: 'error' }])).toBe(false);
  });

  it('refuses a bundle from anywhere but our own host', () => {
    for (const url of ['https://evil.example/1.0.18.2.zip', 'http://ps-ota.gamestao.com/1.0.18.2.zip', 'https://ps-ota.gamestao.com.evil.example/x.zip', 'https://ps-ota.gamestao.com@evil.example/x.zip']) {
      expect(wantsDownload({ ...manifest, url }, '1.0.18', '1.0', []), url).toBe(false);
    }
  });
});

describe('pickDownloaded', () => {
  it('picks the newest usable bundle above the running one', () => {
    const have: Bundle[] = [
      { id: 'a', version: '1.0.18.1', status: 'success' },
      { id: 'b', version: '1.0.18.3', status: 'error' },
      { id: 'c', version: '1.0.18.2', status: 'pending' },
      { id: 'd', version: '1.0.17.9', status: 'pending' },
    ];
    expect(pickDownloaded(have, '1.0.18')?.id).toBe('c');
    expect(pickDownloaded(have, '1.0.18.2')).toBeNull();
  });
});

describe('the updater calls', () => {
  it('confirm the bundle that booted, and find a newer one without touching the device', async () => {
    const u = fakeUpdater();
    await readyOta('1.0.18', true, u);
    expect(await findOta('1.0.18', true, u, async () => manifest)).toEqual(manifest);
    expect(u.calls).toEqual(['ready']);
  });

  it('download with its progress, then switch to the new bundle', async () => {
    const u = fakeUpdater();
    const seen: number[] = [];
    await installOta(manifest, (f) => seen.push(f), u);
    expect(seen).toEqual([0.5, 1]);
    expect(u.calls).toEqual(['download 1.0.18.2 ab12', 'set x', 'unlisten']);
  });

  it('leave the running bundle when the download fails', async () => {
    const u = fakeUpdater([], '1.0', true);
    await expect(installOta(manifest, () => {}, u)).rejects.toThrow('offline');
    expect(u.calls).toEqual(['download 1.0.18.2 ab12', 'unlisten']);
  });

  it('do nothing in development, in a browser, or when the manifest fails', async () => {
    const u = fakeUpdater();
    await readyOta('0.0.0', true, u);
    expect(await findOta('0.0.0', true, u, async () => manifest)).toBeNull();
    expect(await findOta('1.0.18', false, u, async () => manifest)).toBeNull();
    expect(u.calls).toEqual([]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await findOta('1.0.18', true, u, async () => { throw new Error('offline'); })).toBeNull();
    warn.mockRestore();
  });

  it('switch to a downloaded bundle at launch', async () => {
    const u = fakeUpdater([{ id: 'c', version: '1.0.18.2', status: 'pending' }]);
    expect(await applyDownloaded('1.0.18', true, u)).toBe(true);
    expect(u.calls).toEqual(['set c']);
    expect(await applyDownloaded('1.0.18.2', true, fakeUpdater())).toBe(false);
    expect(await applyDownloaded('0.0.0', true, u)).toBe(false);
  });

  it('tell each rolled-back bundle once', async () => {
    const store = new Map<string, string>();
    const kv = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const u = fakeUpdater([
      { id: 'a', version: '1.0.18.1', status: 'error' },
      { id: 'b', version: '1.0.18.2', status: 'success' },
    ]);
    expect(await failedOta('1.0.18', true, u, kv)).toEqual(['1.0.18.1']);
    expect(await failedOta('1.0.18', true, u, kv)).toEqual([]);
    expect(store.get(FAILED_KEY)).toBe('["1.0.18.1"]');
    expect(await failedOta('0.0.0', true, u, kv)).toEqual([]);
  });
});

describe('when the plugin or the network fails', () => {
  const broken = (): Updater => {
    const no = async (): Promise<never> => {
      throw new Error('plugin gone');
    };
    return { notifyAppReady: no, current: no, list: no, download: no, set: no, addListener: no };
  };

  it('keeps the running bundle, leaves it unconfirmed and reports nothing, without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(await applyDownloaded('1.0.18', true, broken())).toBe(false);
      await expect(readyOta('1.0.18', true, broken())).resolves.toBeUndefined();
      expect(await failedOta('1.0.18', true, broken(), { getItem: () => null, setItem: () => {} })).toEqual([]);
      expect(warn.mock.calls.map((c) => c[0])).toEqual(['[ota] kept the running bundle:', '[ota] not confirmed:', '[ota] no rollback list:']);
    } finally {
      warn.mockRestore();
    }
  });

  it('fetches the manifest fresh for the running bundle, and finds nothing when the host says no', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => manifest }));
    vi.stubGlobal('fetch', fetch);
    try {
      expect(await findOta('1.0.18', true, fakeUpdater())).toEqual(manifest);
      expect(fetch).toHaveBeenCalledWith(`${MANIFEST_URL}?v=1.0.18`, expect.objectContaining({ cache: 'no-store' }));
      fetch.mockImplementation(async () => ({ ok: false, json: async () => manifest }));
      expect(await findOta('1.0.18', true, fakeUpdater())).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('offers nothing outside the shell', async () => {
    expect(await otaUpdates().check()).toBeNull();
  });
});

describe('the shell and the pipeline agree', () => {
  it('keeps the plugin out of Capgo\'s cloud and in manual mode', () => {
    expect(capConfig).toContain('autoUpdate: false');
    expect(capConfig).toContain("statsUrl: ''");
    expect(podfile).toContain("pod 'CapgoCapacitorUpdater'");
    for (const reason of ['CA92.1', 'C617.1', 'E174.1']) expect(privacy).toContain(`<string>${reason}</string>`);
  });

  it('stamps the bundle version in both workflows and hosts the manifest where the app reads it', () => {
    expect(releaseWorkflow).toContain('PS_BUNDLE_VERSION: ${{ steps.ver.outputs.version }}');
    expect(otaWorkflow).toContain('PS_BUNDLE_VERSION: ${{ steps.ver.outputs.version }}');
    expect(otaWorkflow).toContain(`MANIFEST_URL: ${MANIFEST_URL}`);
    expect(wrangler).toContain(`"pattern": "${new URL(MANIFEST_URL).host}"`);
    expect(new URL(MANIFEST_URL).origin + '/').toBe(BUNDLE_ORIGIN);
    expect(otaWorkflow).toContain(`--arg url "${BUNDLE_ORIGIN}$V.zip"`);
    expect(otaWorkflow).toContain('wrangler deploy -c wrangler/ota.jsonc'.replace('wrangler deploy', 'wrangler@4.118.0 deploy'));
  });
});
