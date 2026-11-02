// Help after losing in a row early on (audit G1): a player who loses stages 1-3 twice running
// starts the next one there with a little more gold and one summon free, so the third try
// is not the same wall again; on stage 1 already after one loss, as a slow new player met its
// wave-5 boss short of a lineup. A win there clears the streak.
import type { BattleSetup, MetaSave } from './meta';

/** The last stage the streak counts on and helps on. */
export const ASSIST_UNTIL = 3;
/** Losses in a row that bring the help. */
export const ASSIST_AFTER = 2;
/** Losses that bring it on stage 1, the very first battle. */
export const ASSIST_AFTER_FIRST = 1;
/** What the help adds to the starting gold. */
export const ASSIST_GOLD = 40;
/** And the summons it makes free. */
export const ASSIST_SUMMONS = 1;

/** Books a stage's end: a loss on stages 1-3 adds one, a win there clears it. Later stages, a
 *  hard stage and the run a revive goes on with leave it as it is. */
export function bookLoss(m: MetaSave, stage: number, won: boolean, hard: boolean): void {
  if (stage > ASSIST_UNTIL || hard) return;
  m.lossStreak = won ? 0 : m.lossStreak + 1;
}

/** The setup with the help added when the streak has earned it. */
export function lossAssist(setup: BattleSetup, streak: number): BattleSetup {
  if (streak < (setup.stage === 1 ? ASSIST_AFTER_FIRST : ASSIST_AFTER) || setup.stage > ASSIST_UNTIL || setup.hard) return setup;
  return { ...setup, startGold: setup.startGold + ASSIST_GOLD, freeSummons: ASSIST_SUMMONS };
}
