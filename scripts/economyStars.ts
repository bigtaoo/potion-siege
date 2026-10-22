// The economy bot's stars and hard mode (STARS=0 leaves both out). Off the frontier it plays the
// furthest open hard stage, won or not, until two hard losses in a row (a hard stage pays as one
// six stages further on); otherwise it replays the highest stage near its farm stage short of
// three stars, and the farm stage itself once those all have three.

import type { MetaSave } from '../src/sim/meta';
import { furthestHard, stageStars } from '../src/sim/stars';

export interface Pick {
  stage: number;
  hard: boolean;
}

/** The battle to fight off the frontier; `farm` is the stage the plain bot would farm. */
export function offFrontier(m: MetaSave, farm: number, hardLosses: number, stars: boolean): Pick {
  const top = Math.max(1, Math.min(farm, m.cleared));
  if (!stars) return { stage: top, hard: false };
  const h = furthestHard(m);
  if (h !== null && hardLosses < 2) return { stage: h, hard: true };
  for (let s = top; s >= Math.max(1, top - 9); s--) if (stageStars(m, s) < 3) return { stage: s, hard: false };
  return { stage: top, hard: false };
}
