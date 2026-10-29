import type { Props, Sink, TrackedEvent } from '../../analytics/analytics';
import type { BridgeData, PlaygamaBridge } from './bridge';

// What goes to Playgama's own telemetry (its game telemetry guide), adapted from D:\standing's
// client/src/platform/playgama/telemetry.ts: the first battle's tutorial funnel and a progression
// funnel made from the game's run events, each carrying the player's device so every funnel splits
// by it. Bridge itself already counts sessions, playtime and ads, so nothing of that is repeated.
// It is a sink like the collector's, but it also gets events while the player has not answered
// the privacy question (Bridge's own telemetry runs then too); none once they said no.

/** The tutorial's steps in order (sim/tutorial.ts), `done` once the last is over. */
const TUTORIAL_STEPS = ['summon', 'merge', 'upgrade', 'pick', 'done'] as const;

/** A stage, a challenge or an endless run as one bounded step. */
function stepOf(p: Props, cause: string): BridgeData {
  const stage = Number(p.stage) || 1;
  if (cause === 'endless') return { step_id: 'endless', step_index: stage, mode: 'endless' };
  if (cause === 'challenge') return { step_id: 'challenge', step_index: stage, mode: 'challenge' };
  return { step_id: `stage_${stage}`, step_index: stage, mode: 'story' };
}

function tutorialFields(step: unknown, seconds: unknown): BridgeData {
  const index = TUTORIAL_STEPS.indexOf(step as (typeof TUTORIAL_STEPS)[number]);
  const step_id = TUTORIAL_STEPS[index < 0 ? TUTORIAL_STEPS.length - 1 : index];
  return { step_id, step_index: TUTORIAL_STEPS.indexOf(step_id) + 1, seconds: Number(seconds) || 0 };
}

/** What a run's end says about it (analytics/runTracker.ts summary). */
function runResult(p: Props): BridgeData {
  return {
    run: Number(p.run) || 0,
    wave: Number(p.wave) || 0,
    duration_sec: Number(p.secs) || 0,
    kills: Number(p.kills) || 0,
    merges: Number(p.merges) || 0,
    max_star: Number(p.maxStar) || 0,
    wall_pct: Number(p.wall) || 0,
  };
}

/** Whole seconds from `from` to `to` (ms), never below 0. */
const secsBetween = (from: number, to: number) => Math.max(0, Math.round((to - from) / 1000));

/**
 * Turns the game's own events into Playgama's, remembering the run in progress (its run_end and
 * run_quit name no stage); null for an event Playgama does not get. `ts` is the event's wall clock
 * (ms): `wall_sec` counts real seconds from the run's start, which battle seconds do not while the
 * tutorial holds the battle. `hiddenLeaves` is for phones and tablets, whose browsers often never
 * send pagehide: there a hidden page already counts as left. A desktop browser sends pagehide on a
 * closed tab, so there a tab switch counts for nothing.
 */
export class BridgeEvents {
  private step: BridgeData = stepOf({}, 'first');
  /** When the run in progress started (ms); null when none is open or its leave went out. */
  private runAt: number | null = null;
  /** When the last run started (ms), for `first_input`. */
  private lastRunAt: number | null = null;
  /** The run in progress already went out as left on a hidden page: its end says the player came back. */
  private wentLeft = false;

  constructor(private readonly hiddenLeaves = true) {}

  map(name: string, p: Props, ts = 0): [string, BridgeData] | null {
    const wall: BridgeData = this.lastRunAt === null ? {} : { wall_sec: secsBetween(this.lastRunAt, ts) };
    switch (name) {
      // each tutorial step as it is done, with the battle second and the real one
      case 'tutorial_step':
        return ['tutorial_step', { ...tutorialFields(p.step, p.doneT), ...wall }];
      case 'tutorial_end': {
        const fields = tutorialFields('done', 0);
        return ['tutorial_completed', { ...fields, skipped: p.skipped === true, at_step: String(p.step ?? 'done') }];
      }
      // the first tap or key ever: seconds since the page loaded and since the run started
      case 'first_input':
        return ['first_input', { load_sec: Number(p.t) || 0, ...wall }];
      case 'run_start':
        this.step = stepOf(p, String(p.cause ?? ''));
        this.runAt = this.lastRunAt = ts;
        this.wentLeft = false;
        return ['progression_started', { ...this.step, run: Number(p.run) || 0, cause: String(p.cause ?? '') }];
      case 'run_end':
        this.runAt = null;
        if (p.result === 'won') return ['progression_completed', { ...this.step, ...runResult(p), ...this.back() }];
        return ['progression_failed', { ...this.step, ...runResult(p), reason: 'wall_fell', ...this.back() }];
      case 'run_quit':
        if (p.giveUp) {
          this.runAt = null;
          return ['progression_failed', { ...this.step, ...runResult(p), reason: 'gave_up', ...this.back() }];
        }
        return this.left(p, ts, 'pagehide');
      case 'run_hidden':
        return this.hiddenLeaves ? this.left(p, ts, 'hidden') : null;
      default:
        return null;
    }
  }

  /** `returned` on the end of a run that already went out as left: the player only looked away. */
  private back(): BridgeData {
    const was = this.wentLeft;
    this.wentLeft = false;
    return was ? { returned: true } : {};
  }

  /** The page hid or went away mid-run: one `left` per run, whichever of the two came first (a
   *  closed tab hides before pagehide; mobile browsers often never send pagehide). A player who
   *  only switched tabs and came back still ends the run later. */
  private left(p: Props, ts: number, via: string): [string, BridgeData] | null {
    if (this.runAt === null) return null;
    const wall_sec = secsBetween(this.runAt, ts);
    this.runAt = null;
    this.wentLeft = via === 'hidden';
    return ['progression_failed', { ...this.step, ...runResult(p), reason: 'left', via, wall_sec, battle_sec: Number(p.secs) || 0 }];
  }
}

/**
 * Where the player plays: `device` the system family (`ios`, `android`, `desktop` for Windows,
 * Mac, Linux and ChromeOS, else `other`), `form` Bridge's device type (`mobile`, `tablet`,
 * `desktop`; `unknown` when it does not say) and `touch` whether the screen takes touches. An iPad
 * passes for a Mac but has touch points.
 */
export function deviceFields(ua: string, touchPoints: number, bridgeType: string | null): BridgeData {
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  const device = ipad || /iPhone|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : /Windows|Macintosh|Linux|CrOS/.test(ua) ? 'desktop' : 'other';
  const form = bridgeType === 'mobile' || bridgeType === 'tablet' || bridgeType === 'desktop' ? bridgeType : 'unknown';
  return { device, form, touch: touchPoints > 0 };
}

export class BridgeSink implements Sink {
  readonly beforeConsent = true;
  private readonly events: BridgeEvents;

  constructor(
    private readonly bridge: Pick<PlaygamaBridge, 'track'>,
    private readonly device: BridgeData,
    private readonly build: string,
  ) {
    this.events = new BridgeEvents(device.device !== 'desktop');
  }

  send(events: TrackedEvent[]): void {
    for (const e of events) {
      const mapped = this.events.map(e.name, e.props, e.ts);
      if (mapped) this.bridge.track(mapped[0], { ...mapped[1], ...this.device, session: e.session, day: e.day, build_version: this.build });
    }
  }
}
