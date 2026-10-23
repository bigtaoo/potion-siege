// One pacing rule for every host's interstitials (after standing's platform/adPacing.ts): at most
// one every INTERSTITIAL_MINUTES of play, where play is the time a battle is ticking on screen
// (Game.tick feeds it), so a player on the home screen or sitting on the results earns none. The
// clock starts at zero at launch, lives for the session (across battles) and starts over when an
// ad went on screen, an interstitial or a rewarded one the player chose. An interstitial asked
// for before it is due is skipped (resultScreen.breakAd). The host's own limits stay on top
// (CrazyGames' SDK refuses one inside its cooldown); iOS AdMob has none, so this is its only cap.
// Pure: no clock, no Pixi.

/** The least play between two interstitials, in minutes. */
export const INTERSTITIAL_MINUTES = 3;

export class AdPacing {
  private since = 0;

  constructor(readonly gapMs = INTERSTITIAL_MINUTES * 60_000) {}

  /** `ms` of play went by. */
  played(ms: number): void {
    if (ms > 0) this.since += ms;
  }

  /** Whether the next interstitial would be shown. */
  due(): boolean {
    return this.since >= this.gapMs;
  }

  /** An ad went on screen: the clock starts over. */
  shown(): void {
    this.since = 0;
  }

  /** Seconds of play since the last ad (or launch), for telemetry. */
  get seconds(): number {
    return Math.round(this.since / 1000);
  }
}
