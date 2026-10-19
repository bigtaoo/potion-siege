import { Battle, type Stamped } from './battle';
import { hashBattle } from './hash';
import type { BattleSetup } from './meta';

// A battle as a replay (after standing's engine/replay.ts): the seed, the setup and the
// player's commands with their ticks are enough to play it again tick for tick, since the
// battle is deterministic. The hash at the end checks a playback.

/** Bump when a change to the battle plays the same commands differently (the rules, the
 *  units, the trig table): an old replay then no longer checks. */
export const REPLAY_VERSION = 3;

export interface Replay {
  version: number;
  seed: number;
  setup: BattleSetup;
  commands: Stamped[];
  /** The tick it was taken on, and hashBattle then. */
  ticks: number;
  hash: number;
}

export function takeReplay(b: Battle): Replay {
  return { version: REPLAY_VERSION, seed: b.seed, setup: b.setup, commands: b.commands.map((c) => ({ ...c })), ticks: b.time, hash: hashBattle(b) };
}

/** Plays `r` from the start to its tick, calling `onTick` after every step; the battle at the
 *  end. Throws when the playback stops where the recording went on (a desync). */
export function playReplay(r: Replay, onTick?: (b: Battle) => void): Battle {
  const b = new Battle(r.seed, r.setup);
  let i = 0;
  for (;;) {
    while (i < r.commands.length && r.commands[i].tick === b.time) b.apply(r.commands[i++]);
    if (b.time >= r.ticks) break;
    if (b.paused) throw new Error(`replay desync: paused at tick ${b.time} with ${r.commands.length - i} commands left`);
    b.step();
    b.drain();
    onTick?.(b);
  }
  if (i < r.commands.length) throw new Error(`replay desync: ${r.commands.length - i} commands left after tick ${b.time}`);
  return b;
}

/** Whether `r` plays back to where it was taken (same version and hash). */
export function checkReplay(r: Replay): boolean {
  if (r.version !== REPLAY_VERSION) return false;
  try {
    return hashBattle(playReplay(r)) === r.hash;
  } catch {
    return false;
  }
}
