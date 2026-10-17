// CrazyGames: cloud saves through the SDK's data module (local for guests), the portal's
// loading and gameplay hooks, and its ads. Adapted from D:\standing's CrazyGamesPlatform.

import { WebPlatform } from '../web';
import { SafeStore, type KeyValueStore, type Platform } from '../types';
import { CrazyGamesSdk } from './sdk';

/** The data module throws (dataModuleDisabled) when Progress Save is off in the submission;
 *  the save then stays in localStorage instead of only in memory. */
function readable(store: KeyValueStore): boolean {
  try {
    store.getItem('mb.save');
    return true;
  } catch {
    return false;
  }
}

export class CrazyGamesPlatform extends WebPlatform implements Platform {
  /** 'web' when the SDK says `local` (a developer's own machine), so tests there never count
   *  as CrazyGames players. */
  override readonly name: string;
  private playing = false;
  private adblock = false;
  /** loadingStop has gone out; until then a gameplayStart only waits for it. */
  private loadingDone = false;
  private startWaiting = false;

  private constructor(private readonly sdk: CrazyGamesSdk) {
    super();
    this.name = sdk.environment() === 'local' ? 'web' : 'crazygames';
    const store = sdk.dataStore();
    if (store && readable(store)) this.storage = new SafeStore(store);
  }

  /** Waits (bounded) for the SDK, because its data module only exists after init. */
  static async create(sdk = new CrazyGamesSdk()): Promise<CrazyGamesPlatform> {
    await sdk.init();
    sdk.loadingStart();
    const platform = new CrazyGamesPlatform(sdk);
    platform.adblock = await sdk.hasAdblock();
    return platform;
  }

  override languages(): string[] {
    const locale = this.sdk.locale();
    return locale ? [locale] : super.languages();
  }

  override loaded(): void {
    if (this.loadingDone) return;
    this.loadingDone = true;
    this.sdk.loadingStop();
    if (this.startWaiting) {
      this.startWaiting = false;
      this.gameplayStart();
    }
  }

  // the portal reads repeated starts or stops as noise, so only real changes reach it; and a
  // start never goes out before loadingStop (it is sent right after it instead)
  override gameplayStart(): void {
    if (!this.loadingDone) {
      this.startWaiting = true;
      return;
    }
    if (this.playing) return;
    this.playing = true;
    this.sdk.gameplayStart();
  }

  override gameplayStop(): void {
    this.startWaiting = false;
    if (!this.playing) return;
    this.playing = false;
    this.sdk.gameplayStop();
  }

  override celebrate(): void {
    this.sdk.happytime();
  }

  /** Hidden under an adblocker; in Basic Launch (no ads) the reward is simply granted. */
  override rewardedAvailable(): boolean {
    return this.sdk.isEnabled() && !this.adblock;
  }

  override async rewarded(onStart: () => void): Promise<boolean> {
    if (!this.sdk.adsAllowed()) return true;
    return this.sdk.requestAd('rewarded', { adStarted: onStart });
  }

  override async midgame(onStart: () => void): Promise<void> {
    if (!this.sdk.isEnabled() || !this.sdk.adsAllowed()) return;
    await this.sdk.requestAd('midgame', { adStarted: onStart });
  }

  override onHostMute(listener: (muted: boolean) => void): void {
    this.sdk.onMuteChange(listener);
  }
}
