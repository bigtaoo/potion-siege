// Which workshop upgrades are on sale. The lab (every potion's damage) opens once the campaign's
// last stage is cleared: before that it would only shorten the climb (ref/balance/economy/labA-C:
// casual reached stage 50 on day 26-30 instead of 32 at any price tried), after it it is the
// long sink for the crystals that endless and the tower keep paying.

import type { MetaSave, WorkshopId } from './meta';
import { reach } from './rebrew';
import { BALANCE } from './types';

const IDS: readonly WorkshopId[] = ['wall', 'startGold', 'crystals', 'lab'];

export function workshopOpen(m: Pick<MetaSave, 'cleared' | 'alchemy'>, id: WorkshopId): boolean {
  return id !== 'lab' || reach(m) >= BALANCE.meta.workshop.lab.from;
}

/** The upgrades on sale for this save, in the workshop's order. */
export function openWorkshop(m: Pick<MetaSave, 'cleared' | 'alchemy'>): WorkshopId[] {
  return IDS.filter((id) => workshopOpen(m, id));
}
