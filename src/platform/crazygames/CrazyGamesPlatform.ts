// CrazyGames: cloud saves through the SDK's data module (local for guests), the portal's
// loading and gameplay hooks, and its ads. Adapted from D:\standing's CrazyGamesPlatform.

import { WebPlatform } from '../web';
import { SafeStore, type Platform } from '../types';
import { CrazyGamesSdk } from './sdk';

export class CrazyGamesPlatform extends WebPlatform implements Platform {
  override readonly name: string = 'crazygames';
  private playing = false;
  private adblock = false;

  private constructor(private readonly sdk: CrazyGamesSdk) {
    super();
    const store = sdk.dataStore();
    if (store) this.storage = new SafeStore(store);
  }

  /** Waits (bounded) for the SDK, because its data module only exists after init. */
  static async create(): Promise<CrazyGamesPlatform> {
    const sdk = new CrazyGamesSdk();
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
    this.sdk.loadingStop();
  }

  // the portal reads repeated starts or stops as noise, so only real changes reach it
  override gameplayStart(): void {
    if (this.playing) return;
    this.playing = true;
    this.sdk.gameplayStart();
  }

  override gameplayStop(): void {
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
