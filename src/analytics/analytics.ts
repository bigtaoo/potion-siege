// Gameplay telemetry for tuning retention: who comes back on which day, where first sessions
// stop, how far runs get. Anonymous: a random player id kept in the game's own storage, no
// personal data. Events go to pluggable sinks (console in dev, an HTTP collector when set), once
// the player's privacy answer lets them (privacy.ts): until then they wait in memory, and no id
// is stored.

import type { KeyValueStore } from '../platform/types';
import type { Sharing } from './privacy';
import type { ReplayUpload } from './replayUpload';
import { UNKNOWN_SOURCE } from './source';

const PLAYER_KEY = 'mb.player';
const DAY_MS = 86_400_000;
/** Events kept in memory while the player has not answered; later ones are dropped. */
const HOLD_MAX = 1000;

export type Props = Record<string, string | number | boolean | string[] | number[] | null>;

export interface TrackedEvent {
  name: string;
  /** Anonymous player id, stable across sessions on this device/account. */
  uid: string;
  /** Session id, new on every page load. */
  sid: string;
  /** Wall-clock ms. */
  ts: number;
  /** Calendar days since this player's first session (0 = install day): D1/D7 come from this. */
  day: number;
  /** 1 for the first session ever. */
  session: number;
  build: string;
  platform: string;
  /** Where the player first came from (source.ts): a `?src=` tag, a referrer host, `direct`,
   *  or `unknown` for a player from before sources were recorded. */
  src: string;
  props: Props;
}

export interface Sink {
  send(events: TrackedEvent[]): void;
  /** Called when the page is going away; must not wait for anything. */
  flush?(): void;
}

interface PlayerRecord {
  /** '' until the player's events may be sent (privacy.ts): no id is stored before. */
  id: string;
  /** Local calendar day number of the first session. */
  firstDay: number;
  sessions: number;
  /** One-time milestones already reported (first summon, first merge, ...). */
  firsts: string[];
  /** Acquisition source, set on the first visit. */
  src: string;
}

export interface Clock {
  now(): number;
  /** Minutes to add to UTC to get local time (positive east of Greenwich). */
  offsetMinutes(): number;
}

const systemClock: Clock = {
  now: () => Date.now(),
  offsetMinutes: () => -new Date().getTimezoneOffset(),
};

function localDay(clock: Clock): number {
  return Math.floor((clock.now() + clock.offsetMinutes() * 60_000) / DAY_MS);
}

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export class Analytics {
  readonly sessionId = randomId();
  private readonly player: PlayerRecord;
  private readonly startedAt: number;
  /** Events waiting for the player's answer. */
  private held: TrackedEvent[] = [];
  /** Where the battles' replays go, under the same consent (createAnalytics); none in dev and autoplay. */
  replays: ReplayUpload | null = null;

  constructor(
    private readonly store: KeyValueStore,
    private readonly sinks: Sink[],
    private readonly build: string,
    private readonly platform: string,
    private readonly clock: Clock = systemClock,
    /** The source to record when this is the player's first visit (source.ts sourceOf). */
    private readonly newSource: () => string = () => 'direct',
    private sharing: Sharing = 'send',
  ) {
    this.player = this.loadPlayer();
    if (sharing === 'send' && !this.player.id) this.player.id = randomId();
    this.player.sessions++;
    this.savePlayer();
    this.startedAt = clock.now();
  }

  get day(): number {
    return localDay(this.clock) - this.player.firstDay;
  }

  get sessions(): number {
    return this.player.sessions;
  }

  get source(): string {
    return this.player.src;
  }

  /** The install id a request to see or delete data names; null while none is stored. */
  get playerId(): string | null {
    return this.player.id || null;
  }

  /** Whether events go out now. */
  get sending(): boolean {
    return this.sharing === 'send';
  }

  /**
   * The player answered (or changed their mind in the settings). `send` stores an id if there is
   * none yet and sends what waited; `off` drops what waited. An id already stored stays, so the
   * settings can still show it for a deletion request.
   */
  setSharing(sharing: Sharing): void {
    this.sharing = sharing;
    if (sharing === 'off') this.held = [];
    if (sharing !== 'send') return;
    if (!this.player.id) {
      this.player.id = randomId();
      this.savePlayer();
    }
    const held = this.held;
    this.held = [];
    for (const ev of held) ev.uid ||= this.player.id;
    if (held.length) this.deliver(held);
  }

  /** Seconds since this session started. */
  get sessionSeconds(): number {
    return Math.round((this.clock.now() - this.startedAt) / 1000);
  }

  track(name: string, props: Props = {}): void {
    const ev: TrackedEvent = {
      name,
      uid: this.player.id,
      sid: this.sessionId,
      ts: this.clock.now(),
      day: this.day,
      session: this.player.sessions,
      build: this.build,
      platform: this.platform,
      src: this.player.src,
      props,
    };
    if (this.sharing === 'send') this.deliver([ev]);
    else if (this.sharing === 'hold' && this.held.length < HOLD_MAX) this.held.push(ev);
  }

  private deliver(events: TrackedEvent[]): void {
    for (const s of this.sinks) {
      try {
        s.send(events);
      } catch {
        /* telemetry must never break the game */
      }
    }
  }

  /** Tracks `name` only the first time ever for this player (onboarding funnel steps); true
   *  when it did. */
  first(name: string, props: Props = {}): boolean {
    if (this.player.firsts.includes(name)) return false;
    this.player.firsts.push(name);
    this.savePlayer();
    this.track(name, props);
    return true;
  }

  flush(): void {
    for (const s of this.sinks) {
      try {
        s.flush?.();
      } catch {
        /* ignore */
      }
    }
  }

  private loadPlayer(): PlayerRecord {
    try {
      const raw = JSON.parse(this.store.getItem(PLAYER_KEY) ?? 'null') as Partial<PlayerRecord> | null;
      if (raw && typeof raw.id === 'string' && typeof raw.firstDay === 'number') {
        return {
          id: raw.id,
          firstDay: raw.firstDay,
          sessions: Number(raw.sessions) || 0,
          firsts: Array.isArray(raw.firsts) ? raw.firsts.filter((f) => typeof f === 'string') : [],
          src: typeof raw.src === 'string' && raw.src ? raw.src : UNKNOWN_SOURCE,
        };
      }
    } catch {
      /* start fresh */
    }
    let src = 'direct';
    try {
      src = this.newSource() || 'direct';
    } catch {
      // no location or referrer to read
    }
    // the id comes with the first send (constructor, setSharing)
    return { id: '', firstDay: localDay(this.clock), sessions: 0, firsts: [], src };
  }

  private savePlayer(): void {
    this.store.setItem(PLAYER_KEY, JSON.stringify(this.player));
  }
}
