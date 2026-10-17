// The first battle's tutorial: summon, merge, then the first 强化 and its skill pick, each shown
// when its moment comes. Pure rules over the battle. The battle never stands still for it: a
// step the player leaves alone for ASSIST_SECONDS is done for them (through the same commands,
// so the replay has it), and the pick pauses the battle by itself. The view draws the pointer.

import { SLOT_COUNT, type Battle } from './battle';
import { TICK_RATE } from './math/fixed';
import type { BattleEvent } from './types';

export const TUTORIAL_STEPS = ['summon', 'merge', 'upgrade', 'pick'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

/** How long a step points before the tutorial does it itself: long enough to read the card,
 *  well before the first enemies reach the wall (about 22 s into stage 1). */
export const ASSIST_SECONDS = 8;

/** The first two slots that could merge, or null. */
export function mergeablePair(b: Battle): [number, number] | null {
  for (let i = 0; i < SLOT_COUNT; i++) for (let j = i + 1; j < SLOT_COUNT; j++) if (b.canMerge(i, j)) return [i, j];
  return null;
}

export class Tutorial {
  /** The step waiting to be done; null when all are done or skipped. */
  step: TutorialStep | null = 'summon';
  /** The step on screen and the battle tick it came up on, for the assist. */
  private shown: TutorialStep | null = null;
  private shownAt = 0;

  get done(): boolean {
    return this.step === null;
  }

  /** The step to point at now, or null while its moment has not come (the battle plays on). */
  showing(b: Battle): TutorialStep | null {
    switch (this.step) {
      case 'summon':
        return b.canSummon() ? 'summon' : null;
      case 'merge':
        return !b.paused && mergeablePair(b) ? 'merge' : null;
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

  /** Does the step on screen for the player once it has waited ASSIST_SECONDS (or, while the
   *  merge step waits for a pair, summons one more); returns the step it did, or null. Never the
   *  pick: that one waits for the player's own choice. */
  assist(b: Battle): TutorialStep | null {
    // waiting for a pair to merge with nothing to point at: another potion brings one closer
    const s = this.shown ?? (this.step === 'merge' && b.canSummon() && !b.paused ? 'summon' : null);
    if (!s || s === 'pick' || (this.shown && this.showing(b) !== s) || b.time - this.shownAt < ASSIST_SECONDS * TICK_RATE) return null;
    let ok = false;
    if (s === 'summon') ok = b.summon();
    else if (s === 'upgrade') ok = b.upgrade();
    else {
      const pair = mergeablePair(b);
      ok = !!pair && b.move(pair[0], pair[1]);
    }
    if (!ok) return null;
    this.shownAt = b.time; // one try per wait, even if the event is not drained yet
    return s;
  }

  skip(): void {
    this.step = null;
  }
}
