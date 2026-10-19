# iOS release

Potion Siege on the App Store: the web game in a Capacitor shell, built the way D:\standing
(Holy Kicker, `docs/ios.md` there) ships, minus Game Center. Owner checklist and ids:
`D:\cloud\ios\apps\potionsiege.md`.

| | |
|---|---|
| Bundle id | `com.gamestao.potionsiege` (permanent once live) |
| Store name | `Potion Siege` (fallback `Potion Siege: Merge TD`); zh-Hans `药水围城` |
| Devices | iPhone only, portrait, iOS 15+ |
| In-app purchase | the ad-free card `com.gamestao.potionsiege.adfree`, non-consumable, US$3.99 |
| Ads | AdMob rewarded + interstitial, Google's UMP consent, non-personalised, no ATT |
| Hot updates | `@capgo/capacitor-updater` 8.52.1 against our own manifest at `ps-ota.gamestao.com` |
| Telemetry | host `ios` (the beacon and the collector both count `capacitor://localhost`) |

## Architecture

- `ios/` is the Xcode project (CocoaPods, `ios/App/Podfile` pointing at `../../node_modules`).
  `capacitor.config.ts` sets `webDir: 'dist-ios'`, `contentInset: 'never'`, the status bar
  hidden (`SystemBars`) and the updater driven by hand (`autoUpdate: false`, `statsUrl: ''`).
- `npm run build:ios` (`vite.ios.config.js`) builds `dist-ios` from `src/main.ios.ts`, with the
  open beacon tagged `h=ios` and `__PS_BUNDLE__` from `PS_BUNDLE_VERSION` (`0.0.0` outside the
  iOS workflows, which never hot-updates). `npm run check` builds it too.
- `src/platform/ios/IosPlatform.ts` is the browser host plus the shell's bridge:
  - storage: `MirrorStore`, localStorage mirrored into `UserDefaults` (`ps.kv`), since iOS may
    clear a web view's storage;
  - `mount`: a `#game` box inset by `env(safe-area-inset-*)`; the canvas fills it, so nothing
    sits under the notch or the home indicator;
  - the phone's languages (WKWebView's own `navigator.languages` only lists the app's);
  - ads through `admob.ts`, the card through `storeKit.ts`, `adPrivacy` for the settings button;
  - `openUrl` through the bridge, so the settings link to the privacy policy opens in Safari;
  - audio session `ambient`: the silent switch mutes the game and the player's music keeps playing.
- Without the bridge (the page opened in Safari) it behaves like the web host, reporting as ios.
- Sharpness: WebKit says "Apple GPU", hides the memory and admits to only a few cores, so the
  quality levels (`src/view/quality.ts`) ignore the cores on an Apple GPU, and a 3x iPhone
  starts on `max` (render resolution 3, its own pixels). Before that it started on `low` (1.5)
  and the 1080-wide board was drawn on ~590 of its ~1180 pixels. The governor still steps it
  down when frames slow. JS only: a hot update carries it.

### The bridge (`window.PSNative`, injected at document start)

`PSBridgeViewController.swift` posts to the `ps` message handler and pushes state back by
calling `window.PSNative._<name>(json)`. Every member is feature-detected on the page side
(`bridge.ts`), so an older shell under a newer hot update just lacks the feature.

| Member | |
|---|---|
| `v`, `saved`, `save(k, v)` | bridge version 1; the mirrored key store |
| `openUrl(url)`, `languages`, `device` | links in Safari; the phone's languages; model + iOS version |
| `adState()`, `onAdState`, `onAdEvent`, `showAd(kind)`, `adPrivacy()` | AdMob (below) |
| `store()`, `onStore`, `onStoreResult`, `buy(id)`, `restore()` | StoreKit (below) |

`src/platform/ios/shell.test.ts` pins both sides of this contract as text, since nothing on
Windows compiles the Swift.

## Ads: AdMob

- The shell (`AdMob.swift`) asks for consent once the view is up (UMP shows its form only in the
  EEA/UK, as set under AdMob → Privacy & messaging), starts the SDK only when `canRequestAds`,
  and keeps one rewarded and one interstitial loaded, retrying a failed load with a backoff.
  Every request is non-personalised (`npa=1`); no tracking prompt.
- The game asks `rewardedAvailable()` synchronously while it draws an offer, so on iOS an offer
  shows once a rewarded ad is loaded. `main.ios.ts` redraws the home screen when that changes
  (`AdMob.onChange`). `rewarded` resolves true only when the reward was earned, after the ad has
  closed; `midgame` plays the interstitial if one is loaded, never waits for one. The `started`
  callback mutes the game as on CrazyGames. An ad not on screen 10 s after the ask is given up.
- **Ids.** `live = false` in `AdMob.swift` and Google's sample app id in `Info.plist` until our
  own exist: Google's demo units serve test ads under any id, ours have no fill before the app is
  on the store. Going live means our app id in `Info.plist` and both units in `AdMob.swift`, in
  one change (`shell.test.ts` refuses one without the other). Never tap a live ad yourself.
- Settings gains an "Ad privacy choices" button where Google says the options are required.

## The ad-free card (StoreKit 2)

- `Store.swift` reads `Transaction.currentEntitlements` (verified, not revoked) at every launch
  and listens to `Transaction.updates` from launch (Ask to Buy approved later, refunds, purchases
  on another device). `storeKit.ts` keeps the last answer in `ps.adFree`, so an offline launch
  is right from the first frame.
- With the card, every rewarded offer is there and pays at once with no ad, and no interstitial
  plays. The daily caps stay as they are, so balance never has to price in a paying player.
- UI: a strip at the top of the Shop tab, iOS only (`Platform.store` is absent elsewhere:
  CrazyGames forbids IAP, and App Review 3.1.1 forbids pointing anywhere else to pay). The price
  is StoreKit's `displayPrice` ("…" until it loads), **Restore purchase** sits under the name,
  and "Owned" replaces both once bought. The Shop tab is open from the first home screen.
- Analytics: `iap` `{op: buy|restore, outcome, run}`. An owner's rewarded offers still log
  `ad_result ok: true` without an ad; leave out players with an owned `iap` when reading ad
  numbers.

## Hot updates

The web layer (`dist-ios`) can change without App Review:

- Once the game is up, `checkOta` calls `notifyAppReady` (a bundle that does not get there
  within 30 s is rolled back), reads `https://ps-ota.gamestao.com/manifest.json` and downloads a
  newer bundle. At the next launch, before anything boots, `applyDownloaded` switches to it. It
  never arms one with `next()`, which would swap it in whenever the app goes to the background
  and throw away a battle in progress.
- Versions: a shell's own bundle is `<MARKETING_VERSION>.<release run number>` (`1.0.12`); its
  hot updates are `1.0.12.1`, `1.0.12.2`, … so an update outranks its shell and the next shell
  outranks every update for the one before (`resetWhenUpdate` drops them after an App Store
  update).
- Publish: Actions → `ota-ios` → Run workflow, on a commit whose ci run is green. It works out the
  version, builds, zips, writes the manifest with the zip's sha256 and deploys `dist-ota` to the
  `potion-siege-ota` worker (`wrangler/ota.jsonc`, the web deploy's Cloudflare secrets). Only the
  newest update is served. `minNativeVersion` (the input) holds it back from older shells.
- Only JS, art and sound travel this way. A new bridge call or native setting needs a new shell.
  Never use it to add a way to pay outside StoreKit (guideline 3.3.1).

## Release

`.github/workflows/release-ios.yml`, on GitHub's macOS runner (the only place Swift compiles):

- **compile**: every push to main or pull request that touches the shell; an unsigned simulator build.
- **release**: a tag `ios-v*` or a manual run: archive, sign (manual, `Apple Distribution`),
  export and upload to TestFlight. The build number is the run number; destination `none` stops
  at the IPA. A manual run can build any branch
  (`gh workflow run release-ios.yml --ref <branch> -f destination=testflight`), so a change can be
  tried on a phone before its PR is merged (the icon went out that way as 1.0 (4)).

Secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `BUILD_CERTIFICATE_BASE64` | `D:\cloud\ios\material\apple-dist.p12`, base64 |
| `P12_PASSWORD` | its export password, typed by the owner (`gh secret set P12_PASSWORD -R bigtaoo/potion-siege`) |
| `KEYCHAIN_PASSWORD` | random |
| `BUILD_PROVISION_PROFILE_BASE64` | `material/potionsiege.mobileprovision`, base64 |
| `PROVISIONING_PROFILE_NAME` | `Potion Siege App Store` |
| `APPLE_TEAM_ID` | `C677KJH544` |
| `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`, `ASC_API_KEY_CONTENT_BASE64` | key `deutsch-ci` (`K4Q4TH8MV2`), shared for now |

## Trying it without a Mac

`npm run dev:ios` (preview config `ios`, port 5182), then open `/?native=1`: a fake bridge
(`fakeNative.ts`, development builds only) whose ads load after a second, whose store sells the
card at once and which offers the privacy button. `?native=owned` starts with the card owned.

## Privacy and the listing

- `PrivacyInfo.xcprivacy`: `UserDefaults` (`CA92.1`), and the updater's file timestamps and disk
  space (`C617.1`, `E174.1`); no tracking.
- Privacy policy: **https://p.gamestao.com/privacy** (`public/privacy.html`, part of the web build;
  English, then Simplified Chinese at `#zh`). It covers our play telemetry (install id, events to
  ps.gamestao.com, the id-less load counts), AdMob (non-personalised, UMP in the EEA/UK/CH, the
  "Ad privacy choices" button, Google's vendor-scoped device id), the ad-free card through Apple
  (ownership only) and CrazyGames. It goes in the listing's Privacy Policy URL. Keep it in step
  with any new event, storage key or SDK.
- Settings links to it ("Privacy policy", the `#zh` half in Chinese) on every host that has
  `Platform.openUrl`: the web and iOS. CrazyGames has none, since the portal allows no links out
  and its own policy covers its players.
- Play statistics ask first in the EEA/UK/CH (src/analytics/privacy.ts, the rules Holy Kicker
  uses): the home screen after run 1 opens the question once a session, and until "Allow" events
  wait in memory and no install id is stored. Everyone has the "Share stats" switch and the Player
  ID with Copy in Settings, which §9 points to. UMP covers only Google's ads, so the app runs both.
- Open in the policy, the owner's call: the collector deletes nothing yet, and §8 says so with a
  TODO comment to pick a period and add the cron. It does not block App Review, which checks that
  the policy exists and is reachable.
- Privacy label: identifiers (install id; AdMob's device id), usage data, diagnostics; nothing
  linked to a person, nothing used for tracking.
- `app-ads.txt` is already at `https://gamestao.com/app-ads.txt` (one line for the AdMob account).
- Age rating: cartoon violence, ads. Screenshots at 1179×2556, English and Simplified Chinese.
- Icon: `art/store/ios/app_icon_1024.png`, the same file as the asset catalog's
  `AppIcon-512@2x.png` (1024², RGB, no alpha). It is the fire potion bottle on purple, draft A of
  three in `art/icon/` (prompts `art/prompts/icon_*_gen.txt`), cropped 640 px around the bottle so it
  fills the rounded square: one big character on a flat, saturated ground is what still reads at
  60 pt. The first icon, the crowned cauldron over the blurred battlefield, was small and muddy
  there.

## Review risks

| Guideline | Risk | Answer |
|---|---|---|
| 3.1.1 | A way to pay outside IAP | None; `Platform.store` absent on other hosts |
| 3.1.1 | Non-consumable without Restore | Restore on the strip, beside the price |
| 2.1 | Reviewer cannot find the purchase | Shop tab open from the first home screen; the review notes name it |
| 4.2 | "Just a website" | A full offline game, no web navigation |
| 5.1.1 | Privacy policy missing | The page above, linked in the listing |
| 5.1.1 | Policy not reachable inside the app | "Privacy policy" in settings, opened in Safari |

## Order of work

| Step | What | Done when |
|---|---|---|
| 0 | Owner setup (`D:\cloud\ios\apps\potionsiege.md`) | App ID, ASC record, profile, secrets |
| 1 | Shell, ads, card, hot updates, workflows | Done: merged 4bbf338, simulator build green |
| 2 | First TestFlight build | 1.0 (3), then 1.0 (4) with the new icon, plays on a phone; test ads and sandbox purchase + restore still to check |
| 3 | Listing: our AdMob ids (`live`), privacy policy, label, screenshots, rating; submit | In review |
