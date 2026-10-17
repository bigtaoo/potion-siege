// Gameplay telemetry for tuning retention: who comes back on which day, where first sessions
// stop, how far runs get. Anonymous: a random player id kept in the game's own storage, no
// personal data. Events go to pluggable sinks (console in dev, an HTTP collector when set).

import type { KeyValueStore } from '../platform/types';

const PLAYER_KEY = 'mb.player';
const DAY_MS = 86_400_000;

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
  props: Props;
}

export interface Sink {
  send(events: TrackedEvent[]): void;
  /** Called when the page is going away; must not wait for anything. */
  flush?(): void;
}

interface PlayerRecord {
  id: string;
  /** Local calendar day number of the first session. */
  firstDay: number;
  sessions: number;
  /** One-time milestones already reported (first summon, first merge, ...). */
  firsts: string[];
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

  constructor(
    private readonly store: KeyValueStore,
    private readonly sinks: Sink[],
    private readonly build: string,
    private readonly platform: string,
    private readonly clock: Clock = systemClock,
  ) {
    this.player = this.loadPlayer();
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
      props,
    };
    for (const s of this.sinks) {
      try {
        s.send([ev]);
      } catch {
        /* telemetry must never break the game */
      }
    }
  }

  /** Tracks `name` only the first time ever for this player (onboarding funnel steps). */
  first(name: string, props: Props = {}): void {
    if (this.player.firsts.includes(name)) return;
    this.player.firsts.push(name);
    this.savePlayer();
    this.track(name, props);
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
        };
      }
    } catch {
      /* start fresh */
    }
    return { id: randomId(), firstDay: localDay(this.clock), sessions: 0, firsts: [] };
  }

  private savePlayer(): void {
    this.store.setItem(PLAYER_KEY, JSON.stringify(this.player));
  }
}
