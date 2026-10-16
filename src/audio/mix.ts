// What may be heard right now, and how many copies of a sound may play at once. Plain state,
// no Web Audio, so it can be tested.

/** The player's two toggles, kept in the save. */
export interface SoundPrefs {
  music: boolean;
  sfx: boolean;
}

/** The player's toggles and everything else that silences the game. */
export class Mix {
  music = true;
  sfx = true;
  /** An ad is playing. */
  ad = false;
  /** The portal muted the game. */
  host = false;
  /** The tab is in the background. */
  hidden = false;

  /** Nothing outside the player's toggles is holding the sound down. */
  get open(): boolean {
    return !this.ad && !this.host && !this.hidden;
  }

  get musicLevel(): 0 | 1 {
    return this.open && this.music ? 1 : 0;
  }

  get sfxLevel(): 0 | 1 {
    return this.open && this.sfx ? 1 : 0;
  }

  /** The audio context should run (it is suspended whenever nothing can be heard). */
  get running(): boolean {
    return this.musicLevel + this.sfxLevel > 0;
  }
}

export interface Limit {
  /** At most this many playing at once. */
  limit: number;
  /** Seconds between two starts at the least. */
  gap: number;
}

/** Caps how many copies of each sound play at once and how close together they start, so a
 *  burst of hits stays a texture instead of clipping. Times are in seconds. */
export class Throttle {
  private readonly ends = new Map<string, number[]>();
  private readonly last = new Map<string, number>();

  /** True when a copy of `id` lasting `len` may start at `now` (and books it). */
  admit(id: string, rule: Limit, now: number, len: number): boolean {
    const last = this.last.get(id);
    if (last !== undefined && now - last < rule.gap) return false;
    const ends = (this.ends.get(id) ?? []).filter((e) => e > now);
    if (ends.length >= rule.limit) {
      this.ends.set(id, ends);
      return false;
    }
    ends.push(now + len);
    this.ends.set(id, ends);
    this.last.set(id, now);
    return true;
  }

  /** How many copies of `id` are still playing at `now`. */
  playing(id: string, now: number): number {
    return (this.ends.get(id) ?? []).filter((e) => e > now).length;
  }
}
