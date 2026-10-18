// window.PSNative: what the iOS shell injects into the page at document start
// (ios/App/App/PSBridgeViewController.swift, contract in docs/ios.md). Everything is read through
// psNative() and feature-detected, so a web bundle newer than the shell it runs in degrades to the
// browser's behaviour instead of throwing. Ported from D:\standing's HKNative, without Game Center.

export interface PSNative {
  /** The contract's version, raised when the shell gains calls. */
  v: number;
  /** The key store's copy in UserDefaults, as it was at launch. */
  saved: Record<string, string>;
  /** Mirrors one key into UserDefaults (fire and forget). */
  save(key: string, value: string): void;
  /** Opens a page in Safari; window.open from a tap is dropped silently in WKWebView. */
  openUrl(url: string): void;
  /** Locale.preferredLanguages: the phone's languages, most preferred first. */
  languages: string[];
  /** The phone's model identifier and system, e.g. 'iPhone15,2 iOS 18.1'. */
  device: string;
  /** AdMob's last state, null before the shell has sent one. */
  adState(): AdState | null;
  /** Called with every new AdMob state. */
  onAdState(cb: (state: AdState) => void): void;
  /** Called as an ad asked for with showAd goes on screen and goes away. */
  onAdEvent(cb: (event: AdEvent) => void): void;
  /** Shows the loaded ad of that kind; its progress comes back through onAdEvent. */
  showAd(kind: AdKind): void;
  /** Shows Google's privacy options form, from a tap. */
  adPrivacy(): void;
  /** The store's last state, null until StoreKit has answered. */
  store(): StoreState | null;
  /** Called with every new store state. */
  onStore(cb: (state: StoreState) => void): void;
  /** Called with how a buy or a restore the page asked for went. */
  onStoreResult(cb: (result: StoreResult) => void): void;
  /** Shows Apple's purchase sheet for a product; only from a tap. */
  buy(id: string): void;
  /** Restore purchases: AppStore.sync(), then the entitlements again; only from a tap. */
  restore(): void;
}

/** StoreKit as the shell sees it (Store.swift). */
export interface StoreState {
  /** The products StoreKit could load, with the price as the storefront writes it. */
  products: { id: string; price: string }[];
  /** The verified, unrevoked entitlements. */
  owned: string[];
  /** False where Screen Time blocks purchases. */
  canPay: boolean;
}

/** How a buy or a restore went. A buy is 'pending' while Ask to Buy waits: the answer comes later,
 *  through the state. A restore finds the card ('owned') or nothing ('none'). */
export interface StoreResult {
  op: 'buy' | 'restore';
  outcome: 'owned' | 'cancelled' | 'pending' | 'failed' | 'none';
}

export type AdKind = 'rewarded' | 'interstitial';

/** AdMob as the shell sees it (AdMob.swift). */
export interface AdState {
  /** 'pending' until the consent answer is in, then whether ads may be requested at all. */
  status: 'pending' | 'on' | 'off';
  /** Whether an ad of that kind is loaded and can be shown now. */
  rewarded: boolean;
  interstitial: boolean;
  /** Whether Google's consent form applies here (EEA/UK), so the shop offers it again. */
  privacyOptions: boolean;
  /** Why the last load failed ('GADErrorDomain 3: ...', 3 is no fill), null once one worked. */
  error: string | null;
}

/** An ad's progress: 'started' when it is on screen, then 'done' (ok: the reward was earned);
 *  'done' alone when it could not be shown. */
export interface AdEvent {
  kind: AdKind;
  event: 'started' | 'done';
  ok: boolean;
}

/** The shell's bridge, or null in a browser. Members may be missing on an older shell. */
export function psNative(scope: object = globalThis): Partial<PSNative> | null {
  const n = (scope as { PSNative?: unknown }).PSNative;
  return n && typeof n === 'object' ? (n as Partial<PSNative>) : null;
}
