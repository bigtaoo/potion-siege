import { urlSwitches } from '../../game/switches';
import { accountOwner, GUEST } from '../../save/saveCopies';
import { keepSaves, vaultFor } from '../../save/saveKeeper';
import { devNotifier } from '../fakeNotifier';
import { updatesSwitch } from '../fakeUpdates';
import { SafeStore, type AdPrivacy, type AppUpdates, type Notifier, type Platform } from '../types';
import { WebPlatform, browserStorage } from '../web';
import { AdMob } from './admob';
import { psNative, type PSNative } from './bridge';
import { GameCenterAccount } from './gameCenter';
import { MirrorStore } from './mirrorStore';
import { nativeNotifier } from './notify';
import { otaUpdates } from './ota';
import { StoreKit } from './storeKit';

// The iOS app (docs/ios.md): the browser host inside the Capacitor shell's WKWebView, with the
// shell's bridge (window.PSNative) for what a web view cannot do on its own. Without the bridge
// (the page opened in Safari) it behaves like the browser host, reporting as ios. Adapted from
// D:\standing's IosPlatform. Game Center only names whose save copies these are (keepCopies).
//
// Ads are AdMob's, through the shell (admob.ts), until the ad-free card is bought through StoreKit
// (storeKit.ts): then every rewarded offer is there and pays at once with no ad, and no
// interstitial plays. Only the waiting goes: the daily caps stay as they are, so balance never
// has to price in a paying player. Ownership is read on every call, so a purchase, a restore or a
// refund takes effect at the next offer.
export class IosPlatform extends WebPlatform implements Platform {
  override readonly name: string = 'ios';
  /** No buzz yet: WKWebView has no navigator.vibrate and the app ships no haptics plugin
   *  (@capacitor/haptics would be the way, a native change for a later build). */
  override readonly vibrate = undefined;
  override storage: SafeStore;
  readonly mount: HTMLElement;
  readonly store: StoreKit | null;
  readonly adPrivacy: AdPrivacy;
  /** main.ios.ts redraws the home screen on its and the store's `onChange`. */
  readonly admob: AdMob;
  readonly storeKit: StoreKit;
  /** Hot updates, offered on the home screen (ota.ts); ?ota=fake stands in during development. */
  override readonly updates: AppUpdates = updatesSwitch(urlSwitches(location.search)) ?? otaUpdates();
  /** The reminders' notifications, on a shell of bridge v2 or later (else ?notify=fake's, in dev). */
  override readonly notify: Notifier | null;
  readonly gameCenter: GameCenterAccount;
  private signedIn = false;
  /** Where the save was restored from at boot ('none': the phone's own was the best). */
  private restored = 'none';

  constructor(private readonly native: Partial<PSNative> | null = psNative(), doc: Document = document) {
    super();
    const save = native?.save;
    this.storage = new SafeStore(
      native?.saved && save ? new MirrorStore(native.saved, (k, v) => save.call(native, k, v), browserStorage()) : browserStorage(),
    );
    this.admob = new AdMob(native);
    this.storeKit = new StoreKit(native, this.storage);
    this.store = this.storeKit.available() ? this.storeKit : null;
    const admob = this.admob;
    this.adPrivacy = { offered: () => admob.privacyOffered(), open: () => admob.openPrivacy() };
    this.mount = safeAreaMount(doc);
    this.notify = nativeNotifier(native) ?? devNotifier();
    this.gameCenter = new GameCenterAccount(native);
  }

  /** Puts our own copies of the save beside the phone's (saveKeeper.ts), per Game Center player or
   *  guest, before boot() reads it: a reinstall or a new phone finds the player's copy on our server. */
  async keepCopies(doc: Document = document, win: Window = window): Promise<void> {
    const player = await this.gameCenter.player();
    this.signedIn = player !== null;
    const keeper = await keepSaves(this.storage, player ? accountOwner(player, 'gc') : GUEST, { url: vaultFor(false), doc, win });
    this.storage = new SafeStore(keeper);
    if (keeper.restored) this.restored = keeper.restored.adopted ? `${keeper.restored.source}-adopted` : keeper.restored.source;
  }

  /** Whether Game Center had a player at boot and where the save came from, for `session_start`. */
  sessionProps(): Record<string, string | boolean> {
    return { signedIn: this.signedIn, restored: this.restored };
  }

  /** The phone's languages: WKWebView's navigator.language only knows the app's own localisations. */
  override languages(): string[] {
    const langs = this.native?.languages;
    return Array.isArray(langs) && langs.length ? [...langs] : super.languages();
  }

  override rewardedAvailable(): boolean {
    return this.storeKit.owned() || this.admob.rewardedAvailable();
  }

  rewardedHosted(): boolean {
    return this.storeKit.owned() || this.admob.hosted();
  }

  override rewarded(onStart: () => void): Promise<boolean> {
    return this.storeKit.owned() ? Promise.resolve(true) : this.admob.rewarded(onStart);
  }

  override async midgame(onStart: () => void): Promise<void> {
    if (!this.storeKit.owned()) await this.admob.midgame(onStart);
  }

  /** An ad that came on screen after the game gave up on it mutes the game while it plays. */
  override onHostMute(listener: (muted: boolean) => void): void {
    this.admob.onLate = listener;
  }

  /** Safari, through the shell (it opens only http(s) pages); a new tab without the bridge. */
  override readonly openUrl = (url: string): void => {
    const open = this.native?.openUrl;
    if (open) open.call(this.native, url);
    else window.open(url, '_blank', 'noopener');
  };

  /** Why ads last failed to load, if they did: no fill and a wrong unit look alike otherwise. */
  adError(): string | null {
    return this.admob.error();
  }
}

/**
 * The box the canvas fills: the screen less the notch or Dynamic Island and the home indicator.
 * The shell gives the page the whole screen (contentInset 'never', viewport-fit=cover), so the
 * bands around it show the page's background, which is the game's.
 */
export function safeAreaMount(doc: Document): HTMLElement {
  const el = doc.createElement('div');
  el.id = 'game';
  el.style.cssText =
    'position:fixed;overflow:hidden;top:env(safe-area-inset-top,0px);right:env(safe-area-inset-right,0px);' +
    'bottom:env(safe-area-inset-bottom,0px);left:env(safe-area-inset-left,0px)';
  doc.body.appendChild(el);
  return el;
}
