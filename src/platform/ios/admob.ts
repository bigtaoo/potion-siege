import type { AdKind, AdState, PSNative } from './bridge';

// AdMob through the shell's bridge (docs/ios.md "Ads: AdMob"). The shell keeps one ad of each kind
// loaded. The game asks `rewardedAvailable` synchronously as it draws an offer, so an offer shows
// only once a rewarded ad is loaded; `onChange` lets main.ios.ts redraw the home screen when that
// changes. An interstitial that is not loaded is skipped, never waited for. Adapted from
// D:\standing, whose game could wait for the first load.

/** An ad that has not come on screen by then is given up (the shell always answers, but a page
 *  must never hang on it). */
export const START_WAIT_MS = 10_000;

interface Playing {
  kind: AdKind;
  started?: () => void;
  resolve: (ok: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class AdMob {
  /** Called when whether a rewarded ad can be offered, or may still come, changes. */
  onChange: (() => void) | null = null;
  /** An ad given up before it started that comes on screen after all: true as it starts (the
   *  game mutes again), false once it is gone. Its reward was already settled as not earned. */
  onLate: ((onScreen: boolean) => void) | null = null;
  private state: AdState | null;
  private playing: Playing | null = null;
  /** The kind of the ad given up last, until the shell says it is done; true once on screen. */
  private late: { kind: AdKind; onScreen: boolean } | null = null;

  constructor(private readonly native: Partial<PSNative> | null) {
    this.state = typeof native?.adState === 'function' ? clean(native.adState.call(native)) : null;
    native?.onAdState?.call(native, (s) => {
      const before = [this.rewardedAvailable(), this.hosted()];
      this.state = clean(s);
      if (this.rewardedAvailable() !== before[0] || this.hosted() !== before[1]) this.onChange?.();
    });
    native?.onAdEvent?.call(native, (e) => this.event(e));
  }

  rewardedAvailable(): boolean {
    return this.canShow() && this.state?.status === 'on' && this.state.rewarded;
  }

  /** Ads may still come: the shell can show them and has not turned them off (still loading, or
   *  waiting on the consent form). */
  hosted(): boolean {
    return this.canShow() && this.state?.status !== 'off';
  }

  rewarded(started?: () => void): Promise<boolean> {
    return this.show('rewarded', started);
  }

  async midgame(started?: () => void): Promise<void> {
    await this.show('interstitial', started);
  }

  /** Google's privacy options, due where its consent form applies (EEA/UK). */
  privacyOffered(): boolean {
    return !!this.state?.privacyOptions && typeof this.native?.adPrivacy === 'function';
  }

  openPrivacy(): void {
    if (this.privacyOffered()) this.native?.adPrivacy?.call(this.native);
  }

  /** Why the last load failed, for problem reports; null when the last one worked. */
  error(): string | null {
    return this.state?.error ?? null;
  }

  private canShow(): boolean {
    return typeof this.native?.showAd === 'function';
  }

  private show(kind: AdKind, started?: () => void): Promise<boolean> {
    if (!this.canShow() || !this.state?.[kind] || this.playing || this.late?.onScreen) return Promise.resolve(false);
    this.late = null;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.late = { kind, onScreen: false };
        this.finish(false);
      }, START_WAIT_MS);
      this.playing = { kind, started, resolve, timer };
      try {
        this.native?.showAd?.call(this.native, kind);
      } catch {
        // the bridge broke: no event will come for this ad
        this.late = null;
        this.finish(false);
      }
    });
  }

  private event(e: unknown): void {
    if (!e || typeof e !== 'object') return;
    const { kind, event, ok } = e as Record<string, unknown>;
    const p = this.playing;
    if (!p) return this.lateEvent(kind, event);
    if (kind !== p.kind) return;
    if (event === 'started') {
      // on screen: it runs as long as the player watches
      clearTimeout(p.timer);
      p.started?.();
    } else if (event === 'done') this.finish(ok === true);
  }

  /** An ad given up on that came on screen after all: muted while it plays. */
  private lateEvent(kind: unknown, event: unknown): void {
    const l = this.late;
    if (!l || kind !== l.kind) return;
    if (event === 'started' && !l.onScreen) {
      l.onScreen = true;
      this.onLate?.(true);
    } else if (event === 'done') {
      this.late = null;
      if (l.onScreen) this.onLate?.(false);
    }
  }

  private finish(ok: boolean): void {
    const p = this.playing;
    if (!p) return;
    clearTimeout(p.timer);
    this.playing = null;
    p.resolve(ok);
  }
}

/** The shell's state as the page trusts it: anything malformed reads as no ads. */
function clean(s: unknown): AdState | null {
  if (!s || typeof s !== 'object') return null;
  const r = s as Record<string, unknown>;
  const status = r.status === 'on' || r.status === 'off' ? r.status : 'pending';
  return {
    status,
    rewarded: r.rewarded === true,
    interstitial: r.interstitial === true,
    privacyOptions: r.privacyOptions === true,
    error: typeof r.error === 'string' && r.error ? r.error.slice(0, 120) : null,
  };
}
