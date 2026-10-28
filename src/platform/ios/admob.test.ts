import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdEvent, AdKind, AdState, PSNative } from './bridge';
import { AdMob, START_WAIT_MS } from './admob';

// AdMob as the page sees it through the shell's bridge: which ads to offer, and one ad at a time.

const ON: AdState = { status: 'on', rewarded: true, interstitial: true, privacyOptions: false, error: null };

function shell(initial: AdState | null) {
  let state: ((s: AdState) => void) | null = null;
  let event: ((e: AdEvent) => void) | null = null;
  const shown: AdKind[] = [];
  let privacy = 0;
  const native: Partial<PSNative> = {
    adState: () => initial,
    onAdState: (cb) => (state = cb),
    onAdEvent: (cb) => (event = cb),
    showAd: (kind) => shown.push(kind),
    adPrivacy: () => privacy++,
  };
  return {
    native,
    shown,
    privacy: () => privacy,
    push: (s: unknown) => state?.(s as AdState),
    event: (e: unknown) => event?.(e as AdEvent),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('AdMob', () => {
  it('offers nothing without the bridge', async () => {
    for (const native of [null, {}]) {
      const ads = new AdMob(native);
      expect(ads.rewardedAvailable()).toBe(false);
      expect(await ads.rewarded()).toBe(false);
      expect(ads.privacyOffered()).toBe(false);
    }
  });

  it('offers a rewarded ad once one has loaded, and says so only when that changes', () => {
    const s = shell({ ...ON, status: 'pending', rewarded: false });
    const ads = new AdMob(s.native);
    let changes = 0;
    ads.onChange = () => changes++;
    expect(ads.rewardedAvailable()).toBe(false);
    s.push({ ...ON, rewarded: false });
    expect([ads.rewardedAvailable(), changes]).toEqual([false, 0]);
    s.push(ON);
    s.push({ ...ON, interstitial: false });
    expect([ads.rewardedAvailable(), changes]).toEqual([true, 1]);
    // ads switched off (no consent, no fill for good)
    s.push({ ...ON, status: 'off' });
    expect([ads.rewardedAvailable(), changes]).toEqual([false, 2]);
  });

  it('pays a rewarded ad only when the shell says it was earned, after it is gone', async () => {
    const s = shell(ON);
    const ads = new AdMob(s.native);
    let started = 0;
    const paid = ads.rewarded(() => started++);
    expect(s.shown).toEqual(['rewarded']);
    s.event({ kind: 'rewarded', event: 'started', ok: false });
    expect(started).toBe(1);
    // the ad runs as long as the player watches it
    await vi.advanceTimersByTimeAsync(START_WAIT_MS * 3);
    s.event({ kind: 'rewarded', event: 'done', ok: true });
    expect(await paid).toBe(true);

    const skipped = ads.rewarded();
    s.event({ kind: 'rewarded', event: 'done', ok: false });
    expect(await skipped).toBe(false);
  });

  it('shows one ad at a time, only a loaded one, and never hangs on a silent shell', async () => {
    const s = shell({ ...ON, interstitial: false });
    const ads = new AdMob(s.native);
    await ads.midgame();
    expect(s.shown).toEqual([]);

    const first = ads.rewarded();
    expect(await ads.rewarded()).toBe(false);
    expect(s.shown).toEqual(['rewarded']);
    // an event for another kind is not this ad's
    s.event({ kind: 'interstitial', event: 'done', ok: true });
    await vi.advanceTimersByTimeAsync(START_WAIT_MS);
    expect(await first).toBe(false);
  });

  it('gives up an ad whose bridge throws', async () => {
    const s = shell(ON);
    s.native.showAd = () => {
      throw new Error('bridge gone');
    };
    const ads = new AdMob(s.native);
    expect(await ads.rewarded()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('mutes again for an ad that starts after it was given up, until it is gone', async () => {
    const s = shell(ON);
    const ads = new AdMob(s.native);
    const late: boolean[] = [];
    ads.onLate = (on) => late.push(on);
    const paid = ads.rewarded();
    await vi.advanceTimersByTimeAsync(START_WAIT_MS);
    expect(await paid).toBe(false);
    s.event({ kind: 'rewarded', event: 'started' });
    // no second ad over the one on screen
    expect(await ads.midgame().then(() => s.shown)).toEqual(['rewarded']);
    s.event({ kind: 'rewarded', event: 'done', ok: true });
    expect(late).toEqual([true, false]);
    // and the next ad plays as usual
    void ads.midgame();
    expect(s.shown).toEqual(['rewarded', 'interstitial']);
  });

  it('offers the privacy options only where the shell says they are due', () => {
    const s = shell(ON);
    const ads = new AdMob(s.native);
    ads.openPrivacy();
    expect([ads.privacyOffered(), s.privacy()]).toEqual([false, 0]);
    s.push({ ...ON, privacyOptions: true });
    ads.openPrivacy();
    expect([ads.privacyOffered(), s.privacy()]).toEqual([true, 1]);
  });

  it('reads a malformed state as no ads, and keeps the load error short', () => {
    const s = shell(null);
    const ads = new AdMob(s.native);
    s.push({ status: 'yes', rewarded: 1, privacyOptions: 'true', error: 'x'.repeat(500) });
    expect([ads.rewardedAvailable(), ads.privacyOffered(), ads.error()?.length]).toEqual([false, false, 120]);
  });

  it('reads no state from a shell without adState, and ignores malformed events', async () => {
    const s = shell(ON);
    delete s.native.adState;
    const ads = new AdMob(s.native);
    expect([ads.rewardedAvailable(), ads.hosted(), ads.error()]).toEqual([false, true, null]);
    s.push(ON);
    const paid = ads.rewarded();
    for (const bad of [null, 'done', 7]) s.event(bad);
    s.event({ kind: 'rewarded', event: 'loaded' });
    s.event({ kind: 'rewarded', event: 'done', ok: true });
    expect(await paid).toBe(true);
  });

  it('ignores events with no ad playing or given up, and of another kind than the one given up', async () => {
    const s = shell(ON);
    const ads = new AdMob(s.native);
    const late: boolean[] = [];
    ads.onLate = (on) => late.push(on);
    s.event({ kind: 'rewarded', event: 'started' });
    const paid = ads.rewarded();
    await vi.advanceTimersByTimeAsync(START_WAIT_MS);
    expect(await paid).toBe(false);
    s.event({ kind: 'interstitial', event: 'started' });
    s.event({ kind: 'rewarded', event: 'loaded' });
    s.event({ kind: 'rewarded', event: 'started' });
    s.event({ kind: 'rewarded', event: 'started' });
    s.event({ kind: 'rewarded', event: 'done', ok: true });
    expect(late).toEqual([true, false]);
  });

  it('closes a given-up ad that ends without coming on screen, and the game is never muted', async () => {
    const s = shell(ON);
    const ads = new AdMob(s.native);
    const late: boolean[] = [];
    ads.onLate = (on) => late.push(on);
    const paid = ads.midgame();
    await vi.advanceTimersByTimeAsync(START_WAIT_MS);
    await paid;
    s.event({ kind: 'interstitial', event: 'done', ok: false });
    expect(late).toEqual([]);
    void ads.rewarded();
    expect(s.shown).toEqual(['interstitial', 'rewarded']);
  });

  it('settles an ad once when the shell answers and then throws', async () => {
    const s = shell(ON);
    const ads = new AdMob(s.native);
    s.native.showAd = (kind) => {
      s.event({ kind, event: 'done', ok: true });
      throw new Error('bridge gone');
    };
    expect(await ads.rewarded()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
