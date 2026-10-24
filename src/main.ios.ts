import { boot } from './app';
import { IosPlatform } from './platform/ios/IosPlatform';
import { BootTrail, errorText } from './platform/ios/bootTrail';
import { applyDownloaded, failedOta, readyOta } from './platform/ios/ota';

// iOS entry (vite.ios.config.js swaps it in): the build the Capacitor shell packages (docs/ios.md).
// Each launch writes how far it got (platform/ios/bootTrail.ts); one that never finished, and a
// hot update the updater rolled back, go out as anomalies once a later launch is up.
const trail = new BootTrail(localStorage, __PS_BUNDLE__, __PS_BUILD__, () => performance.now());
const caught = (e: unknown) => trail.error(errorText(e));
const onError = (e: ErrorEvent) => caught(e.error ?? e.message);
const onRejection = (e: PromiseRejectionEvent) => caught(e.reason);
addEventListener('error', onError);
addEventListener('unhandledrejection', onRejection);

/** The launch is through: the game's own anomaly listeners take over from here. */
function finished(): void {
  removeEventListener('error', onError);
  removeEventListener('unhandledrejection', onRejection);
  trail.done();
}

async function start(): Promise<void> {
  // a hot update the last session downloaded: the page reloads into it, so nothing boots here
  if (await applyDownloaded()) return finished();
  const fake = new URLSearchParams(location.search).get('native');
  if (import.meta.env.DEV && fake) (await import('./platform/ios/fakeNative')).installFakeNative(fake);
  trail.step('platform');
  const platform = new IosPlatform();
  trail.step('boot');
  const game = await boot(platform);
  trail.step('up');
  // StoreKit answers at launch, after a purchase or a restore, and when a refund or a parent's
  // approval comes in; AdMob once a rewarded ad has loaded (the shop's ad offer waits for one)
  platform.storeKit.onChange = () => game.refresh();
  platform.admob.onChange = () => game.refresh();
  for (const version of await failedOta()) {
    trail.push({ kind: 'ota_fail', props: { place: 'boot', bundle: version, msg: `running ${__PS_BUNDLE__}` } });
  }
  for (const p of trail.take()) game.report(p.kind, p.props);
  void readyOta().then(finished);
}

start().catch((err) => {
  console.error(err);
  trail.error(errorText(err));
  document.body.textContent = `Boot failed: ${String(err)}`;
});
