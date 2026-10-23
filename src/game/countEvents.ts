// A battle's events counted toward today's tasks and the achievements.

import { recordEvents } from '../sim/achievements';
import { addProgress } from '../sim/daily';
import type { MetaSave } from '../sim/meta';
import { BALANCE, type BattleEvent } from '../sim/types';

export function countEvents(m: MetaSave, events: readonly BattleEvent[]): void {
  recordEvents(m, events);
  for (const ev of events) {
    if (ev.type === 'summon') addProgress(m, 'summon');
    else if (ev.type === 'merge') {
      addProgress(m, 'merge');
      if (ev.star === BALANCE.maxStar) addProgress(m, 'ultimate');
    } else if (ev.type === 'kill') {
      addProgress(m, 'kill');
      if (ev.boss) addProgress(m, 'boss');
    }
  }
}
