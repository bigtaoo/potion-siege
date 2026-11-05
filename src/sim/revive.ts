// The rewarded revive after a lost battle. Split from battle.ts.

import type { Battle } from './battle';
import { BALANCE, isBoss } from './types';

/** The wall comes back whole and the alchemist full, so the bomb is ready for the next wave:
 *  with half a wall and no charge a revive saved far fewer early runs than the plain attack did. */
export function doRevive(b: Battle): boolean {
  if (b.result !== 'lost') return false;
  b.wall = b.wallMax;
  b.enemies = b.enemies.filter((e) => isBoss(e.kind));
  b.charge = BALANCE.commander.charge;
  b.chargedFor = 0;
  b.result = null;
  return true;
}
