import { boot } from './app';
import { IosPlatform } from './platform/ios/IosPlatform';
import { applyDownloaded, checkOta } from './platform/ios/ota';

// iOS entry (vite.ios.config.js swaps it in): the build the Capacitor shell packages (docs/ios.md).
async function start(): Promise<void> {
  // a hot update the last session downloaded: the page reloads into it, so nothing boots here
  if (await applyDownloaded()) return;
  const fake = new URLSearchParams(location.search).get('native');
  if (import.meta.env.DEV && fake) (await import('./platform/ios/fakeNative')).installFakeNative(fake);
  const platform = new IosPlatform();
  const game = await boot(platform);
  // StoreKit answers at launch, after a purchase or a restore, and when a refund or a parent's
  // approval comes in; AdMob once a rewarded ad has loaded (the shop's ad offer waits for one)
  platform.storeKit.onChange = () => game.refresh();
  platform.admob.onChange = () => game.refresh();
  // the notification permission, answered on the sheet or changed in the phone's settings
  if (platform.notify) platform.notify.onChange = () => game.refresh();
  void checkOta();
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Boot failed: ${String(err)}`;
});
