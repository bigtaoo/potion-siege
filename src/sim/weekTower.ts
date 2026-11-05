// The tower under the week's rule (sim/week.ts over sim/endless.ts), apart from week.ts so the
// save's week (alchemySave.ts → week.ts) never pulls the climb, and with it meta.ts, back in.

import { endlessSetup } from './endless';
import type { BattleSetup, MetaSave } from './meta';
import { rollWeek, weekRule, weekSetup } from './week';

/** The tower's setup on `day`: the week rolled on first, then its rule laid over the climb. */
export function towerSetup(m: MetaSave, day: string): BattleSetup {
  rollWeek(m, day);
  return weekSetup(endlessSetup(m), weekRule(m.alchemy.week.id));
}
