// The first battle's tutorial: summon, merge, then the first 强化 and its skill pick, each shown
// when its moment comes. Pure rules over the battle. Nothing is ever done for the player: while a
// step points, the shell runs the battle in slow motion (SLOW_PACE: fewer of the same ticks per
// second, so the replay only sees the player's own commands, just later) until the player does
// it, and the pick pauses the battle by itself. The crowd keeps creeping down, so the screen is
// never a still picture, but stops STOP_GAP short of the wall: waiting can never lose the battle.
// The slow motion starts after HOLD_AFTER_SECONDS so the crowd is seen walking in. While the merge
// step has no pair yet it points at 召唤 instead, and so does the 强化 step for EXTRA_SUMMONS more
// summons while its gold comes in. The view draws the pointer.

import { SLOT_COUNT, type Battle } from './battle';
import { FP, TICK_RATE } from './math/fixed';
import { BALANCE, type BattleEvent } from './types';

export const TUTORIAL_STEPS = ['summon', 'merge', 'upgrade', 'pick'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];
/** What the pointer shows: a step, or 'more' while the merge step waits for a pair (the hand on
 *  召唤, so the wait after the first summon is never empty), or 'again' while the 强化 step waits
 *  for its gold (召唤 again, EXTRA_SUMMONS times). */
export type TutorialCue = TutorialStep | 'more' | 'again';

/** Summons the 强化 step asks for while its gold comes in, spread over it: the ~20 s from the
 *  merge to 100 gold were an empty wait. The first battle gives them free (giftSummons). */
export const EXTRA_SUMMONS = 2;
/** Battle seconds between the merge and each of them; kill gold comes in too unevenly to go by. */
export const AGAIN_EVERY = 7;

/** Battle seconds before the first slow motion: the opening crowd walks a fifth of the way down
 *  (the wall is about 15 s off) at full speed, so the player sees at once what is coming. */
export const HOLD_AFTER_SECONDS = 2;

/** The battle's speed while a step points: the crowd creeps on at a fifth of its pace, so the
 *  wall's 13 s left at the first hold last about a minute of waiting before the stop below. */
export const SLOW_PACE = 0.2;

/** While a step points the battle stands still once an enemy is this close to the wall (world
 *  units, one cell): at the creep's few units a tick none ever reaches it, so no idle player
 *  loses the wall to the tutorial. */
export const STOP_GAP = BALANCE.grid.cellH;

/** The first two slots that could merge, or null. */
export function mergeablePair(b: Battle): [number, number] | null {
  for (let i = 0; i < SLOT_COUNT; i++) for (let j = i + 1; j < SLOT_COUNT; j++) if (b.canMerge(i, j)) return [i, j];
  return null;
}

export class Tutorial {
  /** The step waiting to be done; null when all are done or skipped. */
  step: TutorialStep | null = 'summon';
  /** Summons done during the 强化 step, up to EXTRA_SUMMONS. */
  private extra = 0;
  private mergedAt = 0;

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
        // spread over the wait, AGAIN_EVERY apart from the merge on
        const due = b.seconds - this.mergedAt >= AGAIN_EVERY * (this.extra + 1);
        return this.extra < EXTRA_SUMMONS && due && b.canSummon() ? 'again' : null;
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
      else if (this.step === 'merge' && ev.type === 'merge') {
        this.step = 'upgrade';
        this.mergedAt = b.seconds;
      }
      else if (this.step === 'upgrade' && ev.type === 'summon') this.extra++;
    }
    if (this.step === 'upgrade' && b.choices && b.choiceReason === 'upgrade') this.step = 'pick';
    else if (this.step === 'pick' && !b.choices) this.step = null;
  }

  /** How fast the battle runs now: 1, or SLOW_PACE while a step points and waits for the player
   *  (the pick pauses the battle by itself), or 0 once the crowd is STOP_GAP short of the wall.
   *  Checked before every tick, so a step that comes up mid-frame slows the battle there. */
  pace(b: Battle): number {
    const s = this.showing(b);
    if (s === null || s === 'pick' || b.time < HOLD_AFTER_SECONDS * TICK_RATE) return 1;
    const gap = STOP_GAP * FP;
    return b.enemies.some((e) => e.y + e.radius + gap >= b.wallFront(e.x)) ? 0 : SLOW_PACE;
  }

  skip(): void {
    this.step = null;
  }
}
