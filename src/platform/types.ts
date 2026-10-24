/** A key/value store that behaves like localStorage. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What the game needs from the page it runs in (plain web or a portal). */
export interface Platform {
  /** Short id for telemetry, e.g. 'web' or 'crazygames'. */
  readonly name: string;
  storage: KeyValueStore;
  /** Preferred languages, most preferred first. */
  languages(): string[];
  /** The game finished loading and can be played. */
  loaded(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** A moment of joy, e.g. a victory. */
  celebrate(): void;
  /** Whether a rewarded ad can be offered right now. */
  rewardedAvailable(): boolean;
  /** Whether the host has rewarded ads at all, loaded or not; absent: as `rewardedAvailable`. */
  rewardedHosted?(): boolean;
  /** An adblocker keeps the host's rewarded ads off (CrazyGames); absent: never. */
  adBlocked?(): boolean;
  /** Plays a rewarded ad; true only if the player earned the reward. */
  rewarded(onStart: () => void): Promise<boolean>;
  /** Plays an interstitial at a natural break; resolves when it is over (or skipped). */
  midgame(onStart: () => void): Promise<void>;
  /** Called with the host's mute state now and whenever it changes. */
  onHostMute(listener: (muted: boolean) => void): void;
  /** The element the canvas fills (iOS: the screen inside its safe area); the window when absent. */
  readonly mount?: HTMLElement;
  /** The ad-free card for sale in the shop (iOS); absent where nothing is sold. */
  readonly store?: Store | null;
  /** Google's ad privacy options in the settings panel (iOS in the EEA/UK). */
  readonly adPrivacy?: AdPrivacy;
  /** Opens a web page outside the game, from a tap (the privacy policy in settings); absent
   *  where the host allows no outside links (CrazyGames, whose own policy covers its players). */
  readonly openUrl?: (url: string) => void;
  /** The player's country as the host knows it ('DE'), which decides whether the game asks
   *  before sending play statistics (analytics/privacy.ts); absent or null: the time zone decides. */
  country?(): string | null;
  /** What `session_start` adds about the host (CrazyGames: its app or a browser, Basic Launch). */
  sessionProps?(): Record<string, string | boolean>;
  /** Puts `text` on the clipboard, from a tap; false when the host refused. Absent where there is none. */
  copyText?(text: string): Promise<boolean>;
  /** A short buzz, `strong` for a big moment; absent where the device has none (desktops, iOS,
   *  whose web view has no navigator.vibrate and whose app has no haptics plugin yet). */
  readonly vibrate?: (strong: boolean) => void;
  /** A newer game the player can be asked to take (the iOS app's hot updates); absent elsewhere. */
  readonly updates?: AppUpdates;
}

/** Hot updates of the game itself (docs/ios.md "Hot updates"), offered on the home screen (view/updatePrompt.ts). */
export interface AppUpdates {
  /** The update this device wants, or null: none, offline, or the manifest unreadable. */
  check(): Promise<UpdateOffer | null>;
}

export interface UpdateOffer {
  readonly version: string;
  /** Downloads it, reporting 0..1, then restarts the game into it. Rejects when that fails. */
  install(progress: (f: number) => void): Promise<void>;
}

/**
 * The one purchase, the ad-free card (docs/ios.md "The ad-free card"): with it, rewarded offers
 * pay at once with no ad and no interstitial plays. Ownership is the store's; the last answer is
 * kept, so an offline launch already knows.
 */
export interface Store {
  /** The card's price as the storefront writes it ('US$3.99', '3,99 €'); null while the store
   *  has not answered, or cannot sell it (offline, purchases blocked). */
  price(): string | null;
  owned(): boolean;
  /** Apple's purchase sheet, from a tap; 'pending' while Ask to Buy waits for a parent. */
  buy(): Promise<'owned' | 'cancelled' | 'pending' | 'failed'>;
  /** Restore purchases, from a tap: whether the card was found. */
  restore(): Promise<'owned' | 'none' | 'cancelled' | 'failed'>;
}

/** A privacy options form the ad host requires a way back to (Google's UMP in the EEA/UK). */
export interface AdPrivacy {
  /** Whether settings should show the button. */
  offered(): boolean;
  open(): void;
}

/** Storage that never throws: falls back to memory when the real one does. */
export class SafeStore implements KeyValueStore {
  private readonly memory = new Map<string, string>();

  constructor(private readonly inner: KeyValueStore | null) {}

  getItem(key: string): string | null {
    try {
      const v = this.inner?.getItem(key);
      if (typeof v === 'string') return v;
    } catch {
      /* fall through to memory */
    }
    return this.memory.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.memory.set(key, value);
    try {
      this.inner?.setItem(key, value);
    } catch {
      /* memory keeps it for this session */
    }
  }
}
