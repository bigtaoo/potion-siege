// Replaying the latest stage pays less (plan 4c): the latest stage cleared, normal mode, pays in
// full `replay.free` times a day and `replay.factor` of it from then on, so farming it is not the
// best way on; hard mode and the tower pay their own way. Pure: the day comes from the caller.

import type { MetaSave, Reward } from './meta';
import { BALANCE } from './types';

const R = BALANCE.alchemy.replay;

/** Whether a battle on `stage` counts as a replay of the latest stage. */
export function isReplay(m: MetaSave, stage: number, hard: boolean): boolean {
  return !hard && stage > 0 && stage === m.cleared;
}

/** Books one more battle on the latest stage today (none for another stage); returns the share
 *  of the pay it earns. `again`: the same battle ending again after a revive, not counted twice. */
export function bookReplay(m: MetaSave, stage: number, hard: boolean, day: string, again = false): number {
  if (!isReplay(m, stage, hard)) return 1;
  const r = m.alchemy.replay;
  if (r.day !== day || r.stage !== stage) m.alchemy.replay = { day, stage, n: 0 };
  if (!again) m.alchemy.replay.n++;
  return replayShare(m.alchemy.replay.n);
}

/** The share of the pay the `n`th battle of a day on the latest stage earns. */
export function replayShare(n: number): number {
  return n > R.free ? R.factor : 1;
}

/** Whether the battle on `stage` that just ended was paid a cut share: booked as a replay of
 *  that very stage. Read after the battle settled, so a first clear (which has moved `cleared`
 *  onto its stage, while the count is still the stage before's) is never one. */
export function replayCut(m: MetaSave, stage: number, hard: boolean): boolean {
  return isReplay(m, stage, hard) && m.alchemy.replay.stage === stage && replayShare(m.alchemy.replay.n) < 1;
}

/** Battles on the latest stage left today at full pay. */
export function replaysLeft(m: MetaSave, day: string): number {
  const r = m.alchemy.replay;
  return r.day === day && r.stage === m.cleared ? Math.max(0, R.free - r.n) : R.free;
}

/** `reward` with its crystals cut to `share`. */
export function shareOf(reward: Reward, share: number): Reward {
  return share >= 1 ? reward : { ...reward, crystals: Math.round(reward.crystals * share) };
}
