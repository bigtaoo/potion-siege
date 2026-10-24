import { urlSwitches } from '../game/switches';
import { devNotifier } from './fakeNotifier';
import { updatesSwitch } from './fakeUpdates';
import { SafeStore, type AppUpdates, type KeyValueStore, type Notifier, type Platform } from './types';

export function browserStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Plain web: local storage, no portal, and with `?ads=fake` (dev builds) a pretend ad that lasts a
 *  second; `?ota=fake` (or `fail`) stands in for the iOS app's hot updates and `?notify=fake`
 *  sends its reminders to the console. */
export class WebPlatform implements Platform {
  readonly name: string = 'web';
  storage = new SafeStore(browserStorage());
  private readonly fakeAds = urlSwitches(location.search).get('ads') === 'fake';
  readonly updates?: AppUpdates = updatesSwitch(urlSwitches(location.search));
  readonly notify: Notifier | null = devNotifier();
  /** A new tab; inside a portal's iframe too, since it comes from a tap. */
  readonly openUrl: ((url: string) => void) | undefined = (url) => void window.open(url, '_blank', 'noopener');
  /** A phone's browser; desktop Chrome has the call too but nothing to buzz. */
  readonly vibrate: ((strong: boolean) => void) | undefined =
    typeof navigator.vibrate === 'function' && navigator.maxTouchPoints > 0 ? (strong) => void navigator.vibrate(strong ? 40 : 15) : undefined;

  async copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // a portal's iframe may withhold clipboard-write: the old way still works from a tap
      return copyByCommand(text);
    }
  }

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

/** The pre-Clipboard-API copy: a hidden text box selected and copied. */
function copyByCommand(text: string): boolean {
  const box = document.createElement('textarea');
  box.value = text;
  box.readOnly = true;
  box.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(box);
  try {
    box.select();
    box.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    box.remove();
  }
}
