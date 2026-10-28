// The battle's 1.5x: a stage the player has won before may be played through faster. Each battle
// starts at 1x; the player turns it on in that battle, never carried over from the last one.

import type { BattleSetup, MetaSave } from '../sim/meta';
import { stageStars } from '../sim/stars';

/** How much faster the battle runs with the speed button on. */
export const FAST = 1.5;

/** A stage battle the player has won before, on the same mode: the speed button shows. Never in
 *  endless mode, which has no stage to have won (nor the daily challenge: its caller's to leave out,
 *  since a stage's chapter theme gives its setup `modifiers` too). */
export function canHurry(m: MetaSave, s: BattleSetup): boolean {
  if (s.endless) return false;
  return s.hard ? stageStars(m, s.stage, true) > 0 : s.stage <= m.cleared;
}
