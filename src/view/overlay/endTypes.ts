// What the result screen is told besides won or lost: the rewarded ×2, the damage, the tips,
// and a daily challenge's or an endless run's result.

import type { ChallengeResult, ModifierId } from '../../sim/challenge';
import type { EndlessResult } from '../../sim/endless';
import type { StarsResult } from '../../sim/stars';
import type { HeroKind } from '../../sim/types';

/** What else the result screen shows: the rewarded ×2 (null when it is not on offer), whether
 *  the crystals were doubled, each potion's damage, and the tips after a loss. */
export interface EndExtras {
  onDouble: (() => void) | null;
  doubled: boolean;
  /** Today's ×2s left, shown under the ×2 (greyed out at 0); undefined hides the line. */
  doublesLeft?: number;
  dealt: { kind: HeroKind; damage: number }[];
  onTip: ((tab: TipTab) => void) | null;
  /** After a loss, the tips in order (view/nudges.ts lossTips) and the one the player can act
   *  on right now (lossStep), lit green. */
  tipTabs?: TipTab[];
  ready?: TipTab | null;
  /** The daily challenge's result: the tiers this attempt reached instead of a stage's win. */
  challenge?: ChallengeEnd;
  /** Straight into the next stage, the big button, with Continue as a smaller 返回 under it
   *  (a new player's first wins). */
  onNext?: (() => void) | null;
  /** An endless run's result: the wave it reached, the best and the next milestone. */
  endless?: EndlessEnd;
  /** An adblocker took the revive or the ×2 away: a line over Continue says so. */
  adBlocked?: boolean;
  /** A stage win's stars: how many, the best before, and a hard mode it opened. */
  stars?: StarsResult;
}

export interface EndlessEnd {
  result: EndlessResult;
  /** The best wave, this run included. */
  best: number;
  /** The next milestone not reached yet, null once all are. */
  next: { wave: number; reward: number } | null;
}

export interface ChallengeEnd {
  result: ChallengeResult;
  mods: readonly ModifierId[];
  trial: HeroKind | null;
  /** Days in a row, and the crystals that paid today (0 on most days). */
  streak: number;
  streakBonus: number;
}

/** The home tabs a tip leads to. */
export type TipTab = 'potions' | 'workshop' | 'battle';
