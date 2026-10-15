import { SafeStore, type KeyValueStore, type Platform } from './types';

function browserStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Plain web: local storage, no portal, and with `?ads=fake` a pretend ad that lasts a second. */
export class WebPlatform implements Platform {
  readonly name: string = 'web';
  storage = new SafeStore(browserStorage());
  private readonly fakeAds = new URLSearchParams(location.search).get('ads') === 'fake';

  languages(): string[] {
    return [...(navigator.languages ?? []), navigator.language];
  }

  loaded(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  celebrate(): void {}

  rewardedAvailable(): boolean {
    return this.fakeAds;
  }

  async rewarded(onStart: () => void): Promise<boolean> {
    if (!this.fakeAds) return false;
    onStart();
    await new Promise((r) => setTimeout(r, 1000));
    return true;
  }

  async midgame(onStart: () => void): Promise<void> {
    if (!this.fakeAds) return;
    onStart();
    await new Promise((r) => setTimeout(r, 1000));
  }

  onHostMute(_listener: (muted: boolean) => void): void {}
}
