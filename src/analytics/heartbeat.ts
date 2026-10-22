// Time on screen and a beat each minute of it. CrazyGames measures playtime by itself, with no
// SDK call, as the time its page has the game open; a hidden tab does not count. So the game
// counts the seconds its page is visible, whatever screen is up (home, battle, results), and every
// ALIVE_EVERY of them sends `alive` with the total and where the player is. A page that dies with
// no pagehide (a killed tab, a crash, a phone that throws the browser away) then still says how
// long it was played and where it stopped. `session_end` carries the same total as `vis`.
// A tab hidden stops the count, a page restored from the back/forward cache picks it up again in
// the same session; a step between two ticks counts at most STEP_CAP, so a computer asleep with
// the tab in front does not count as play.

import type { Props } from './analytics';

/** Seconds on screen between two `alive` beats. */
export const ALIVE_EVERY = 60;
/** Most seconds one tick counts: ticks come every second, a longer gap is the device asleep. */
export const STEP_CAP = 5;

export class Heartbeat {
  /** Milliseconds on screen so far this session. */
  private ms = 0;
  /** The clock at the last tick or show while visible; null while hidden. */
  private last: number | null;
  private beats = 0;

  constructor(
    private readonly a: { track(name: string, props?: Props): void },
    /** Where the player is: `place` and, in a battle, its run, stage and wave. */
    private readonly where: () => Props,
    private readonly now: () => number = () => Date.now(),
    visible = true,
  ) {
    this.last = visible ? now() : null;
  }

  /** Whole seconds on screen so far this session. */
  get seconds(): number {
    return Math.floor(this.ms / 1000);
  }

  /** Counts the time since the last tick and beats once for each minute passed. */
  tick(): void {
    if (this.last === null) return;
    const t = this.now();
    this.ms += Math.min(Math.max(0, t - this.last), STEP_CAP * 1000);
    this.last = t;
    while (this.seconds >= (this.beats + 1) * ALIVE_EVERY) {
      this.beats++;
      this.a.track('alive', { vis: this.beats * ALIVE_EVERY, ...this.where() });
    }
  }

  /** The page is visible again (tab shown, page restored): the count goes on from now. */
  show(): void {
    if (this.last === null) this.last = this.now();
  }

  /** The page is hidden or going away: the time so far counts, nothing while away. */
  hide(): void {
    this.tick();
    this.last = null;
  }
}

/**
 * Drives `beat` from the page: a tick every second, hidden and shown with the tab and the
 * back/forward cache. `away` runs once per time away (a closed tab fires visibilitychange and
 * pagehide, a portal swapping its iframe out only pagehide), `back` when a page left that way is
 * shown again.
 */
export function watchPage(beat: Heartbeat, away: () => void, back: () => void, win: Window = window, doc: Document = document): void {
  let gone = false;
  win.setInterval(() => beat.tick(), 1000);
  doc.addEventListener('visibilitychange', () => (doc.visibilityState === 'hidden' ? beat.hide() : beat.show()));
  win.addEventListener('pagehide', () => {
    beat.hide();
    if (gone) return;
    gone = true;
    away();
  });
  win.addEventListener('pageshow', (e) => {
    if (!(e as PageTransitionEvent).persisted) return;
    gone = false;
    if (doc.visibilityState !== 'hidden') beat.show();
    back();
  });
}
