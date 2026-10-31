import { describe, expect, it } from 'vitest';
import workflow from '../../../.github/workflows/release-ios.yml?raw';
import capConfig from '../../../capacitor.config.ts?raw';
import indexHtml from '../../../index.html?raw';
import podfile from '../../../ios/App/Podfile?raw';
import pbx from '../../../ios/App/App.xcodeproj/project.pbxproj?raw';
import plist from '../../../ios/App/App/Info.plist?raw';
import bridge from '../../../ios/App/App/PSBridgeViewController.swift?raw';
import adMob from '../../../ios/App/App/AdMob.swift?raw';
import privacy from '../../../ios/App/App/PrivacyInfo.xcprivacy?raw';
import sceneDelegate from '../../../ios/App/App/SceneDelegate.swift?raw';
import storeSwift from '../../../ios/App/App/Store.swift?raw';
import notifications from '../../../ios/App/App/Notifications.swift?raw';
import gameCenterSwift from '../../../ios/App/App/GameCenter.swift?raw';
import entitlements from '../../../ios/App/App/App.entitlements?raw';
import storyboard from '../../../ios/App/App/Base.lproj/Main.storyboard?raw';
import { AD_FREE_ID } from './storeKit';

// Nothing on the Windows machine compiles the Swift side (only the macOS CI runner does), so these
// pin the native project to the web side as text: the names both sides must agree on, and the
// settings a review or a device test would otherwise be the first to catch (docs/ios.md). From
// D:\standing's.

const BUNDLE = 'com.gamestao.potionsiege';
/** Google's sample app id, which serves only test ads (developers.google.com/admob/ios/test-ads). */
const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

describe('iOS shell', () => {
  it('names one bundle id everywhere', () => {
    expect(capConfig).toContain(`appId: '${BUNDLE}'`);
    expect(pbx.match(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)).toEqual([
      `PRODUCT_BUNDLE_IDENTIFIER = ${BUNDLE};`,
      `PRODUCT_BUNDLE_IDENTIFIER = ${BUNDLE};`,
    ]);
    expect(workflow).toContain(`BUNDLE_ID: ${BUNDLE}`);
    expect(workflow).toContain('CODE_SIGN_IDENTITY="Apple Distribution"');
    expect(AD_FREE_ID.startsWith(`${BUNDLE}.`)).toBe(true);
  });

  it('compiles every Swift file and ships the privacy manifest', () => {
    for (const file of ['AppDelegate.swift', 'SceneDelegate.swift', 'PSBridgeViewController.swift', 'KeyStore.swift', 'AdMob.swift', 'Store.swift', 'Notifications.swift', 'GameCenter.swift']) {
      expect(pbx).toContain(`/* ${file} in Sources */,`);
    }
    expect(pbx).toContain('/* PrivacyInfo.xcprivacy in Resources */,');
    expect(privacy).toContain('<string>CA92.1</string>');
  });

  it('signs in to Game Center at launch, its sheet only from a tap', () => {
    expect(entitlements).toMatch(/<key>com\.apple\.developer\.game-center<\/key>\s*<true\/>/);
    expect(pbx.match(/CODE_SIGN_ENTITLEMENTS = ([^;]+);/g)).toEqual(['CODE_SIGN_ENTITLEMENTS = App/App.entitlements;', 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;']);
    expect(bridge.split('override func capacitorDidLoad')[1].split('override func')[0]).toContain('gameCenter.start()');
    expect(gameCenterSwift).toContain('GKLocalPlayer.local.authenticateHandler');
    // the sheet is presented in one place only: signIn(), which the page calls from a tap
    expect(gameCenterSwift.match(/present\(/g)?.length).toBe(1);
    expect(gameCenterSwift.split('func start()')[1].split('func signIn()')[0]).not.toContain('present(');
  });

  it('roots the window in the bridge view controller', () => {
    expect(sceneDelegate).toContain('rootViewController = PSBridgeViewController()');
    expect(storyboard).toContain('customClass="PSBridgeViewController" customModule="App"');
  });

  it('injects the members bridge.ts reads, through the handler it posts to', () => {
    expect(bridge).toContain('static let handlerName = "ps"');
    expect(bridge).toContain('window.PSNative = {');
    for (const member of ['saved:', 'languages:', 'device:', 'save: function', 'openUrl: function']) expect(bridge).toContain(member);
    for (const member of [
      'adState: ad.get', 'onAdState: ad.on', 'onAdEvent: adEvent.on', 'showAd: function', 'adPrivacy: function',
      '_adState: ad.push', '_adEvent: adEvent.push',
      'store: store.get', 'onStore: store.on', 'onStoreResult: storeResult.on', 'buy: function', 'restore: function',
      '_store: store.push', '_storeResult: storeResult.push',
      'notify: notify.get', 'onNotify: notify.on', 'notifyAsk: function', 'notifySchedule: function', 'notifyCancel: function',
      '_notify: notify.push',
      'gameCenter: gameCenter.get', 'onGameCenter: gameCenter.on', 'gameCenterSignIn: function', '_gameCenter: gameCenter.push',
    ]) {
      expect(bridge).toContain(member);
    }
    // the page asks for the states as it loads, and the shell pushes them back by name
    expect(bridge).toContain("post({ op: 'adState' });");
    expect(bridge).toContain("post({ op: 'store' });");
    expect(bridge).toContain("post({ op: 'notifyState' });");
    expect(bridge).toContain("post({ op: 'gameCenter' });");
    for (const op of ['"adState"', '"showAd"', '"adPrivacy"', '"store"', '"buy"', '"restore"', '"notifyState"', '"notifyAsk"', '"notifySchedule"', '"notifyCancel"', '"gameCenter"', '"gameCenterSignIn"']) {
      expect(bridge).toContain(`case ${op}:`);
    }
    for (const receiver of ['_adState', '_adEvent', '_store', '_storeResult', '_notify', '_gameCenter']) expect(bridge).toContain(`push("${receiver}"`);
    expect(bridge).toContain('window.PSNative.\\(receiver)(');
    // admob.ts reads these keys and these values
    for (const key of ['"status": status', '"rewarded": rewarded', '"interstitial": interstitial', '"privacyOptions": privacyOptions', '"error": error']) {
      expect(adMob).toContain(key);
    }
    expect(adMob).toContain('enum Kind: String { case rewarded, interstitial }');
    for (const event of ['"started"', '"done"']) expect(adMob).toContain(event);
    expect(bridge).toContain('"kind": kind.rawValue, "event": event, "ok": ok');
    // storeKit.ts reads these keys and these outcomes
    expect(storeSwift).toContain('["id": $0, "price": prices[$0] ?? ""]');
    expect(storeSwift).toContain('"owned": owned.sorted(), "canPay": canPay');
    expect(bridge).toContain('["op": op, "outcome": outcome]');
    // notify.ts (v2) and gameCenter.ts (v3) read this version and these states
    expect(bridge).toContain('static let bridgeVersion = 3');
    expect(gameCenterSwift).toContain('["alias": alias ?? NSNull(), "player": player ?? NSNull(), "canSignIn": canSignIn]');
    expect(bridge).toContain('["status": status.rawValue]');
    const states = notifications.split('enum Status: String {')[1].split('}')[0];
    expect(states.match(/case [a-z]+/g)).toEqual(['case unknown', 'case on', 'case off']);
    for (const outcome of ['"owned"', '"cancelled"', '"pending"', '"failed"', '"none"']) expect(storeSwift).toContain(outcome);
  });

  it('sells the ad-free card with StoreKit 2, trusting only verified, unrevoked entitlements', () => {
    expect(storeSwift).toContain(`static let productIds = ["${AD_FREE_ID}"]`);
    expect(storeSwift).toContain('StoreKit.Transaction.currentEntitlements');
    expect(storeSwift).toContain('tx.revocationDate == nil');
    // refunds, Ask to Buy and purchases elsewhere arrive here, listened to from launch
    expect(storeSwift).toContain('for await result in StoreKit.Transaction.updates');
    expect(bridge.split('override func capacitorDidLoad')[1].split('override func')[0]).toContain('store.start()');
    expect(storeSwift).toContain('try await AppStore.sync()');
    // an unverified transaction never grants and is never finished
    expect(storeSwift).not.toContain('.unverified');
    expect(storeSwift.match(/await tx\.finish\(\)/g)?.length).toBe(3);
  });

  it("serves AdMob non-personalised, without asking to track, after Google's consent", () => {
    expect(podfile).toMatch(/pod 'Google-Mobile-Ads-SDK', '~> \d+\.\d+'/);
    expect(podfile).toMatch(/pod 'GoogleUserMessagingPlatform', '~> \d+\.\d+'/);
    expect(plist).toMatch(/<key>GADApplicationIdentifier<\/key>\s*<string>ca-app-pub-\d+~\d+<\/string>/);
    expect(plist.match(/<key>SKAdNetworkIdentifier<\/key>/g)?.length).toBeGreaterThan(40);
    expect(plist).not.toContain('<key>NSUserTrackingUsageDescription</key>');
    expect(adMob).not.toContain('ATTrackingManager');
    expect(adMob).toContain('extras.additionalParameters = ["npa": "1"]');
    // no ad is requested before Google's consent allows it
    expect(adMob.split('private func load(')[1].split('Task')[0]).toContain('ConsentInformation.shared.canRequestAds');
    expect(bridge.split('override func viewDidAppear')[1]).toContain('adMob.start()');
  });

  it("runs under our own app id, with our units behind the one live switch", () => {
    // Google's advice: the real app id always, its demo units while testing (docs/ios.md "Ids")
    expect(adMob).toMatch(/private static let live = (true|false)\r?\n/);
    const appId = plist.match(/<key>GADApplicationIdentifier<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
    expect(appId).toMatch(/^ca-app-pub-\d+~\d+$/);
    expect(appId).not.toBe(SAMPLE_APP_ID);
    // our own units belong to the app id's publisher
    const publisher = appId?.match(/ca-app-pub-(\d+)~\d+/)?.[1];
    const units = [...adMob.matchAll(/live \? "ca-app-pub-(\d+)\/\d+"/g)].map((m) => m[1]);
    expect(units).toEqual([publisher, publisher]);
  });

  it('is an iPhone game in portrait, full screen, without the status bar', () => {
    expect(pbx.match(/TARGETED_DEVICE_FAMILY = ([^;]+);/g)).toEqual(['TARGETED_DEVICE_FAMILY = 1;', 'TARGETED_DEVICE_FAMILY = 1;']);
    const orientations = plist.split('<key>UISupportedInterfaceOrientations</key>')[1].split('</array>')[0];
    expect(orientations.match(/UIInterfaceOrientation\w+/g)).toEqual(['UIInterfaceOrientationPortrait']);
    expect(plist).not.toContain('UISupportedInterfaceOrientations~ipad');
    expect(plist).toMatch(/<key>UIRequiresFullScreen<\/key>\s*<true\/>/);
    expect(plist).toMatch(/<key>UIStatusBarHidden<\/key>\s*<true\/>/);
    // SystemBars would show the status bar again at load, and it owns the home indicator
    expect(capConfig).toContain('SystemBars: { hidden: true }');
    expect(bridge).not.toContain('prefersHomeIndicatorAutoHidden');
    expect(plist).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  });

  it('keeps the deployment target at iOS 15 in the Podfile and the project', () => {
    expect(podfile).toContain("platform :ios, '15.0'");
    expect([...pbx.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g)].map((m) => m[1])).toEqual(['15.0', '15.0', '15.0', '15.0']);
  });

  it('lets the page own the safe area', () => {
    expect(capConfig).toContain("contentInset: 'never'");
    expect(indexHtml).toContain('viewport-fit=cover');
  });
});
