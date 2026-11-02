// The first battle's tutorial: summon, merge, then the first 强化 and its skill pick, each shown
// when its moment comes. Pure rules over the battle. Nothing is ever done for the player: while a
// step points the battle runs on at full speed, but stands still once the crowd is STOP_GAP short
// of the wall (the first step, 召唤, already half way down the field), until the player does it (the shell runs no ticks then, so the replay only sees the
// player's own commands, just later): waiting can never lose the battle. The pick pauses the
// battle by itself. A slow motion in between read as the game stuttering (owner 11-02). While the
// merge step has no pair yet it points at 召唤 instead, and so does the 强化 step for
// EXTRA_SUMMONS more summons while its gold comes in, and once those are given, at whatever else
// can be done (a pair to fuse, a paid summon): the wait for 100 gold is never a blank. The view
// draws the pointer.

import { SLOT_COUNT, type Battle } from './battle';
import { K } from './field';
import { FP } from './math/fixed';
import { BALANCE, type BattleEvent } from './types';

export const TUTORIAL_STEPS = ['summon', 'merge', 'upgrade', 'pick'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];
/** What the pointer shows: a step, or 'more' while the merge step waits for a pair (the hand on
 *  召唤, so the wait after the first summon is never empty), or 'again' while the 强化 step waits
 *  for its gold (召唤 again, EXTRA_SUMMONS times). */
export type TutorialCue = TutorialStep | 'more' | 'again';

/** Summons the 强化 step asks for while its gold comes in, spread over it: the ~20 s from the
 *  merge to 100 gold were an empty wait. The first battle gives them free (giftSummons), each
 *  GIFT_EVERY after the last (the battle keeps 召唤 shut until then; kill gold comes in too
 *  unevenly to go by). */
export const EXTRA_SUMMONS = 2;

/** While a step points the battle stands still once an enemy is this close to the wall (world
 *  units, one cell): checked before every tick, and no enemy walks a cell in one, so no idle
 *  player loses the wall to the tutorial. */
export const STOP_GAP = BALANCE.grid.cellH;

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
        if (b.canUpgrade()) return 'upgrade';
        if (b.giftReady()) return b.canSummon() ? 'again' : null;
        if (b.paused) return null;
        return mergeablePair(b) ? 'merge' : b.canSummon() ? 'again' : null;
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

  /** How fast the battle runs now: 1, or 0 while a step points and waits for the player once
   *  the crowd is STOP_GAP short of the wall (half way down the field for 召唤) (the pick pauses the battle by itself). The 强化
   *  step's pointers at a pair or a paid summon only fill its wait and stop nothing. Checked
   *  before every tick, so a step that comes up mid-frame stops the battle there. */
  pace(b: Battle): number {
    const s = this.showing(b);
    if (s === null || s === 'pick') return 1;
    if (this.step === 'upgrade' && s !== 'upgrade' && !b.giftReady()) return 1;
    // the first step stops early: a new player meets the crowd before it is on the wall (owner 11-02)
    const line = this.step === 'summon' ? (x: number) => (K.top + b.wallFront(x)) / 2 : (x: number) => b.wallFront(x) - STOP_GAP * FP;
    return b.enemies.some((e) => e.y + e.radius >= line(e.x)) ? 0 : 1;
  }

  skip(): void {
    this.step = null;
  }
}
