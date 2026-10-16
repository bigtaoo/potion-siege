// The first battle's tutorial: summon, merge, then the first 强化 and its skill pick, each shown
// when its moment comes. Pure rules over the battle; the shell holds the battle still while a
// step waits for its tap and the view draws the pointer.

import { SLOT_COUNT, type Battle } from './battle';
import type { BattleEvent } from './types';

export const TUTORIAL_STEPS = ['summon', 'merge', 'upgrade', 'pick'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

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

  /** Whether the battle stands still: while a step waits for its tap, but not during the pick,
   *  which pauses the battle by itself. */
  holds(b: Battle): boolean {
    const s = this.showing(b);
    return s !== null && s !== 'pick';
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

  skip(): void {
    this.step = null;
  }
}
