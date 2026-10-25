// The first battle's tutorial: summon, merge, then the first 强化 and its skill pick, each shown
// when its moment comes. Pure rules over the battle. Nothing is ever done for the player: while a
// step points, the shell holds the battle (no ticks run, so the replay only sees the player's own
// commands, just later) until the player does it, and the pick pauses the battle by itself. The
// first hold waits HOLD_AFTER_SECONDS so the crowd is seen walking in. While the merge step has no
// pair yet it points at 召唤 instead. The view draws the pointer.

import { SLOT_COUNT, type Battle } from './battle';
import { TICK_RATE } from './math/fixed';
import type { BattleEvent } from './types';

export const TUTORIAL_STEPS = ['summon', 'merge', 'upgrade', 'pick'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];
/** What the pointer shows: a step, or 'more' while the merge step waits for a pair (the hand on
 *  召唤, so the wait after the first summon is never empty). */
export type TutorialCue = TutorialStep | 'more';

/** Battle seconds before the first hold: the opening crowd walks a fifth of the way down (the
 *  wall is about 15 s off), so the frozen board shows what is coming, not a still picture. */
export const HOLD_AFTER_SECONDS = 2;

/** The first two slots that could merge, or null. */
export function mergeablePair(b: Battle): [number, number] | null {
  for (let i = 0; i < SLOT_COUNT; i++) for (let j = i + 1; j < SLOT_COUNT; j++) if (b.canMerge(i, j)) return [i, j];
  return null;
}

export class Tutorial {
  /** The step waiting to be done; null when all are done or skipped. */
  step: TutorialStep | null = 'summon';

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
  }

  /** The battle stands still: a step points and waits for the player (the pick pauses the
   *  battle by itself). Checked before every tick, so a step that comes up mid-frame holds there. */
  holds(b: Battle): boolean {
    const s = this.showing(b);
    return s !== null && s !== 'pick' && b.time >= HOLD_AFTER_SECONDS * TICK_RATE;
  }

  skip(): void {
    this.step = null;
  }
}
