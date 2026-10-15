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
  /** Plays a rewarded ad; true only if the player earned the reward. */
  rewarded(onStart: () => void): Promise<boolean>;
  /** Plays an interstitial at a natural break; resolves when it is over (or skipped). */
  midgame(onStart: () => void): Promise<void>;
  /** Called with the host's mute state now and whenever it changes. */
  onHostMute(listener: (muted: boolean) => void): void;
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
