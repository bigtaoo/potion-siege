// Playgama: the browser host plus the Bridge SDK for saves, ads, the platform's pause and sound
// switches, the lifecycle messages and its own telemetry (bridgeSink.ts). Built with `create()`,
// which waits (bounded) for Bridge and reads the save through it first. Adapted from D:\standing's
// client/src/platform/playgama/PlaygamaPlatform.ts.

import { PLAYER_KEY, type Sink } from '../../analytics/analytics';
import { PRIVACY_KEY } from '../../analytics/privacy';
import { BUILD, LANG_KEY, REMINDERS_KEY, SAVE_KEY } from '../../game/keys';
import { accountOwner, GUEST } from '../../save/saveCopies';
import { keepSaves, vaultFor } from '../../save/saveKeeper';
import { SafeStore, type Platform } from '../types';
import { WebPlatform } from '../web';
import { PlaygamaBridge } from './bridge';
import { BridgeSink, deviceFields } from './bridgeSink';
import { BridgeStore } from './bridgeStore';

/** Every key the game keeps in its store, read in one call at boot. */
export const KEYS = [SAVE_KEY, LANG_KEY, PLAYER_KEY, PRIVACY_KEY, REMINDERS_KEY];

/** Bridge's stand-ins for a page that is no portal: a developer's own preview and the QA tool. */
const TEST_PLATFORMS = new Set(['mock', 'qa_tool']);
/** Bridge's id for the sandbox, where an uploaded build plays before the catalog. */
const SANDBOX = 'playgama_sandbox';

export class PlaygamaPlatform extends WebPlatform implements Platform {
  /** 'web' on a test platform, so a preview never counts as a Playgama player. */
  override readonly name: string;
  /** The sandbox's CSP admits Playgama's own hosts only; the catalog may differ, so it stays on. */
  readonly collectorBlocked: boolean;
  readonly hostSink?: Sink;
  private playing = false;
  /** game_ready has gone out; until then a gameplayStart only waits for it. */
  private ready = false;
  private startWaiting = false;
  private paused = false;
  private soundOff = false;
  private muteListener: ((muted: boolean) => void) | null = null;
  private pauseListener: (() => void) | null = null;
  /** Where the save was restored from at boot ('none': the host's own was the best). */
  private restored = 'none';

  private constructor(
    private readonly bridge: PlaygamaBridge,
    saves: BridgeStore | null,
    doc: Document,
    win: Window,
  ) {
    super();
    const id = bridge.platformId();
    this.name = id && !TEST_PLATFORMS.has(id) ? 'playgama' : 'web';
    this.collectorBlocked = id === SANDBOX;
    if (saves) this.storage = new SafeStore(saves);
    // only from the portal itself: a local preview and the QA tool stay out of its numbers
    if (this.name === 'playgama') this.hostSink = new BridgeSink(bridge, deviceFields(navigator.userAgent, navigator.maxTouchPoints || 0, bridge.deviceType()), BUILD);
    // the platform's pause (an overlay, the tab hidden) silences the game, stops a battle under
    // its pause panel, and the save goes to Bridge at once: a page on its way out may get no next tick
    bridge.onPause((paused) => {
      this.paused = paused;
      this.mute();
      if (!paused) return;
      saves?.flush();
      try {
        this.pauseListener?.();
      } catch {
        /* the game's problem, never Bridge's */
      }
    });
    bridge.onMute((off) => {
      this.soundOff = off;
      this.mute();
    });
    const flush = () => saves?.flush();
    doc.addEventListener('visibilitychange', () => doc.visibilityState === 'hidden' && flush());
    win.addEventListener('pagehide', flush);
  }

  static async create(bridge = new PlaygamaBridge(), doc: Document = document, win: Window = window): Promise<PlaygamaPlatform> {
    const ok = await bridge.init();
    const saves = ok ? await BridgeStore.create(bridge, KEYS) : null;
    const account = bridge.accountId();
    console.info(`[potion-siege] Playgama Bridge: ${ok ? bridge.platformId() : 'unavailable'}, save: ${saves ? 'bridge' : 'localStorage'}, ${account ? 'signed in' : 'guest'}`);
    // without Bridge the save stays where the browser keeps it (WebPlatform's storage)
    const platform = new PlaygamaPlatform(bridge, saves, doc, win);
    // our own copies beside the host's store, per owner: a portal account or this browser's guest
    const keeper = await keepSaves(platform.storage, account ? accountOwner(account) : GUEST, { url: vaultFor(platform.collectorBlocked), doc, win });
    platform.storage = new SafeStore(keeper);
    if (keeper.restored) platform.restored = keeper.restored.adopted ? `${keeper.restored.source}-adopted` : keeper.restored.source;
    return platform;
  }

  /** The platform's language first, then the browser's. */
  override languages(): string[] {
    const lang = this.bridge.language();
    return lang ? [lang, ...super.languages()] : super.languages();
  }

  /** Which platform Bridge found and its version, whether the player is signed in to the portal
   *  and where the save came from (saveCopies.ts), for `session_start`. */
  sessionProps(): Record<string, string | boolean> {
    return { sdk: `${this.bridge.platformId() ?? 'none'}/${this.bridge.version() ?? '?'}`, signedIn: this.bridge.accountId() !== null, restored: this.restored };
  }

  override loaded(): void {
    if (this.ready) return;
    this.ready = true;
    this.bridge.send('game_ready');
    if (this.startWaiting) {
      this.startWaiting = false;
      this.gameplayStart();
    }
  }

  // only real changes reach the platform, and a start never goes out before game_ready
  override gameplayStart(): void {
    if (!this.ready) return void (this.startWaiting = true);
    if (this.playing) return;
    this.playing = true;
    this.bridge.send('gameplay_started');
  }

  override gameplayStop(): void {
    this.startWaiting = false;
    if (!this.playing) return;
    this.playing = false;
    this.bridge.send('gameplay_stopped');
  }

  override celebrate(): void {
    this.bridge.send('player_got_achievement');
  }

  /** Hidden under an adblocker and where the platform has no rewarded ads. */
  override rewardedAvailable(): boolean {
    return this.bridge.rewardedSupported() && !this.bridge.hasAdblock();
  }

  /** An adblocker stops the ads the platform would play: the result screen says so. */
  adBlocked(): boolean {
    return this.bridge.isReady() && this.bridge.hasAdblock();
  }

  override rewarded(onStart: () => void): Promise<boolean> {
    return this.bridge.rewarded(onStart);
  }

  override midgame(onStart: () => void): Promise<void> {
    return this.bridge.interstitial(onStart);
  }

  /** The platform's sound switch and its pause both silence the game. */
  override onHostMute(listener: (muted: boolean) => void): void {
    this.muteListener = listener;
    this.mute();
  }

  /** The platform's pause opens the game's own: the player comes back to it and taps Resume. */
  onHostPause(listener: () => void): void {
    this.pauseListener = listener;
  }

  private mute(): void {
    try {
      this.muteListener?.(this.soundOff || this.paused);
    } catch {
      /* the game's problem, never Bridge's */
    }
  }
}
