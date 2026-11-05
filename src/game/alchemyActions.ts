// The home screen's late-game buttons: the rebrew (sim/rebrew.ts), its perks bought with essence,
// and the weekly tasks' crystals (sim/week.ts).

import type { Container } from 'pixi.js';
import type { Game } from '../app';
import { newMeta } from '../sim/meta';
import { buyPerk, rebrew, type PerkId } from '../sim/rebrew';
import { claimWeekTask, type WeekTaskId } from '../sim/week';
import { buy, claimed } from './homeActions';
import { home } from './homeScreen';

/** Pours the save back; the battle tab then shows stage 1 again. */
export function doRebrew(g: Game): void {
  const peak = g.save.cleared;
  const n = rebrew(g.save, newMeta());
  if (n === 0) return;
  g.audio.play('levelup');
  g.store();
  g.analytics.track('rebrew', { essence: n, peak, count: g.save.alchemy.rebrew.count, run: g.save.runs });
  g.tab = 'battle';
  home(g, 'rebrew');
}

export function doPerk(g: Game, id: PerkId): void {
  const ok = buyPerk(g.save, id);
  buy(g, ok, `perk_${id}`, g.save.alchemy.rebrew.perks[id]);
  if (ok) home(g, 'rebrew');
}

export function doClaimWeek(g: Game, id: WeekTaskId, at: Container): void {
  const n = claimWeekTask(g.save, id);
  if (n > 0) claimed(g, `week_${id}`, n, 'week', at);
}
