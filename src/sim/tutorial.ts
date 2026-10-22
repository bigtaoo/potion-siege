// The first battle's tutorial: summon, merge, then the first 强化 and its skill pick, each shown
// when its moment comes. Pure rules over the battle. The battle never stands still for it: a
// step the player leaves alone for ASSIST_SECONDS is done for them (through the same commands,
// so the replay has it), and the pick pauses the battle by itself. While the merge step has no
// pair yet it points at 召唤 instead and summons after a short PAIR_WAIT_SECONDS. The view draws
// the pointer.

import { SLOT_COUNT, type Battle } from './battle';
import { TICK_RATE } from './math/fixed';
import type { BattleEvent } from './types';

export const TUTORIAL_STEPS = ['summon', 'merge', 'upgrade', 'pick'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];
/** What the pointer shows: a step, or 'more' while the merge step waits for a pair (the hand on
 *  召唤, so the wait after the first summon is never empty). */
export type TutorialCue = TutorialStep | 'more';

/** How long a step points before the tutorial does it itself: long enough to read the card,
 *  well before the first enemies reach the wall (about 22 s into stage 1). */
export const ASSIST_SECONDS = 8;

/** How long 'more' points before the tutorial summons the next potion itself: the first auto
 *  summon at 8 s brings the second at about 10 s, and its pair the auto merge at about 18 s. */
export const PAIR_WAIT_SECONDS = 2;

/** The first two slots that could merge, or null. */
export function mergeablePair(b: Battle): [number, number] | null {
  for (let i = 0; i < SLOT_COUNT; i++) for (let j = i + 1; j < SLOT_COUNT; j++) if (b.canMerge(i, j)) return [i, j];
  return null;
}

export class Tutorial {
  /** The step waiting to be done; null when all are done or skipped. */
  step: TutorialStep | null = 'summon';
  /** The step on screen and the battle tick it came up on, for the assist. */
  private shown: TutorialCue | null = null;
  private shownAt = 0;

  get done(): boolean {
    return this.step === null;
  }

  /** The step to point at now, or null while its moment has not come (the battle plays on). */
  showing(b: Battle): TutorialCue | null {
    switch (this.step) {
      case 'summon':
        return b.canSummon() ? 'summon' : null;
      case 'merge':
        if (b.paused) return null;
        return mergeablePair(b) ? 'merge' : b.canSummon() ? 'more' : null;
      case 'upgrade':
        return b.canUpgrade() ? 'upgrade' : null;
      case 'pick':
        return b.choices ? 'pick' : null;
      default:
        return null;
    }
  }

  /** Moves on when the player did what the step asked. */
  update(b: Battle, events: readonly BattleEvent[]): void {
    for (const ev of events) {
      if (this.step === 'summon' && ev.type === 'summon') this.step = 'merge';
      else if (this.step === 'merge' && ev.type === 'merge') this.step = 'upgrade';
    }
    if (this.step === 'upgrade' && b.choices && b.choiceReason === 'upgrade') this.step = 'pick';
    else if (this.step === 'pick' && !b.choices) this.step = null;
    // the clock restarts whenever the pointer goes away or moves to another step
    const s = this.showing(b);
    if (s !== this.shown) {
      this.shown = s;
      this.shownAt = b.time;
    }
  }

  /** Does the step on screen for the player once it has waited ASSIST_SECONDS (PAIR_WAIT_SECONDS
   *  for 'more', which summons one more); returns the step it did ('summon' for 'more'), or null.
   *  Never the pick: that one waits for the player's own choice. */
  assist(b: Battle): TutorialStep | null {
    const s = this.shown;
    const wait = s === 'more' ? PAIR_WAIT_SECONDS : ASSIST_SECONDS;
    if (!s || s === 'pick' || this.showing(b) !== s || b.time - this.shownAt < wait * TICK_RATE) return null;
    let ok = false;
    if (s === 'summon' || s === 'more') ok = b.summon();
    else if (s === 'upgrade') ok = b.upgrade();
    else {
      const pair = mergeablePair(b);
      ok = !!pair && b.move(pair[0], pair[1]);
    }
    if (!ok) return null;
    this.shownAt = b.time; // one try per wait, even if the event is not drained yet
    // done now rather than when its event drains, so the same frame never points at it again
    // (after the merge, the pair is gone and 'more' would flash on 召唤)
    if (s === 'summon') this.step = 'merge';
    else if (s === 'merge') this.step = 'upgrade';
    return s === 'more' ? 'summon' : s;
  }

  skip(): void {
    this.step = null;
  }
}
