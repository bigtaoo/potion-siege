// Each real battle's replay (src/sim/replay.ts: the setup, the seed and the player's commands)
// to the collector's POST /r (scripts/collector.mjs), where `npm run replays` plays it again: what
// the run events cannot say, such as where the wall's damage came from. Only while the player
// shares statistics (privacy.ts), under the same player ID as the events, so a deletion request
// covers both (public/privacy.html §2, §8). Ported from Holy Kicker (D:\standing 36dcc52).
//
// A battle goes when it ends (won or lost; a revived one again when it ends for good), when the
// player leaves it for another, and when the page is hidden mid-battle, since a player who closes
// the tab never reaches the end: then what was played so far, at most once per HIDDEN_TICKS of
// play. A later upload of the same battle replaces the earlier on the collector.

import type { Battle } from '../sim/battle';
import { takeReplay, type Replay } from '../sim/replay';

export type ReplayEnd = 'won' | 'lost' | 'quit' | 'hidden';

/** What POST /r takes (scripts/replayShelf.mjs cleanReplay). */
export interface ReplayPost {
  uid: string;
  /** The battle's number on this install (RunTracker's run). */
  run: number;
  end: ReplayEnd;
  build: string;
  platform: string;
  replay: Replay;
}

/** The player's sharing state, as Analytics has it. */
export interface Consent {
  readonly sending: boolean;
  readonly playerId: string | null;
}

/** keepalive requests share about 64 KB in flight per page; a bigger body goes as a plain fetch. */
const KEEPALIVE_MAX = 60_000;
/** A hidden page sends the battle again only after this much more play (30 s at 30 Hz). */
export const HIDDEN_TICKS = 900;

export type Post = (url: string, body: string) => void;

const fetchPost: Post = (url, body) => {
  // text/plain (a string body's type) avoids a CORS preflight
  void fetch(url, { method: 'POST', body, mode: 'no-cors', keepalive: body.length <= KEEPALIVE_MAX }).catch(() => {});
};

export class ReplayUpload {
  private live: { run: number; battle: Battle } | null = null;
  /** The tick and end of the last upload of the live battle. */
  private sent: { ticks: number; end: ReplayEnd } | null = null;

  constructor(
    private readonly url: string,
    private readonly consent: Consent,
    private readonly build: string,
    private readonly platform: string,
    private readonly post: Post = fetchPost,
  ) {}

  /** Hidden and leaving pages send the battle so far (boot() calls this once with `document`). */
  listen(doc: Pick<Document, 'addEventListener' | 'visibilityState'>, win: Pick<Window, 'addEventListener'>): this {
    doc.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'hidden') this.hidden();
    });
    win.addEventListener('pagehide', () => this.hidden());
    return this;
  }

  /** A battle began; the one before it is left behind (RunTracker.close sent it). */
  start(run: number, battle: Battle): void {
    this.live = { run, battle };
    this.sent = null;
  }

  /** The battle ended (its result) or was left for another (`quit`). */
  end(run: number, battle: Battle): void {
    if (this.live?.battle !== battle) return;
    this.send(run, battle, battle.result ?? 'quit');
  }

  /** The page was hidden: the live battle so far, unless it has ended or little was played since. */
  hidden(): void {
    const live = this.live;
    if (!live || live.battle.result) return;
    if (this.sent && live.battle.time - this.sent.ticks < HIDDEN_TICKS) return;
    this.send(live.run, live.battle, 'hidden');
  }

  private send(run: number, battle: Battle, end: ReplayEnd): void {
    const uid = this.consent.playerId;
    if (!this.consent.sending || !uid || battle.time === 0) return;
    if (this.sent && this.sent.ticks === battle.time && this.sent.end === end) return;
    this.sent = { ticks: battle.time, end };
    try {
      const body: ReplayPost = { uid, run, end, build: this.build, platform: this.platform, replay: takeReplay(battle) };
      this.post(this.url, JSON.stringify(body));
    } catch {
      // a replay lost, never the game
    }
  }
}

/** The collector's replay route beside its event route (VITE_ANALYTICS_URL ends in /e). */
export const replayUrl = (eventsUrl: string): string => `${eventsUrl.replace(/\/e$/, '')}/r`;
