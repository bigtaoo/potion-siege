// The result screen's ways round a stage lost three times in a row (plan 4c, sim/stuck.ts): what
// they offer on this save, and what a tap on one does. Each leads to the home screen with the
// change made: the lineup fielded (on the potions tab, where it shows), hard mode switched on, or
// the battle tab, where the tower starts.

import type { Game } from '../app';
import { chapterOf } from '../sim/chapters';
import { endlessOpen } from '../sim/endless';
import { furthestHard, setHardMode } from '../sim/stars';
import { showExits, suggestLineup } from '../sim/stuck';
import type { ExitKind, ExitsEnd } from '../view/overlay/endTypes';
import { again, resultAction } from './resultScreen';

/** The ways round `stage` on this save, or none before the third loss in a row there. */
export function exitsFor(g: Game, stage: number, lost: boolean, hard: boolean): ExitsEnd | undefined {
  if (!lost || hard || g.autoplay || !showExits(g.save, stage)) return undefined;
  const tip = suggestLineup(g.save);
  const h = furthestHard(g.save);
  const e: ExitsEnd = { lineup: tip?.lineup ?? null, reactions: tip?.reactions.length ?? 0, hardChapter: h === null ? null : chapterOf(h), tower: endlessOpen(g.save) };
  return e.lineup || e.hardChapter !== null || e.tower ? e : undefined;
}

export function takeExit(g: Game, kind: ExitKind): void {
  if (kind === 'lineup') {
    const tip = suggestLineup(g.save);
    if (tip) g.save.lineup = tip.lineup;
  }
  if (kind === 'hard') setHardMode(g.save, true);
  g.store();
  const tab = kind === 'lineup' ? 'potions' : 'battle';
  resultAction(g, 'exit', tab);
  g.analytics.track('stuck_exit', { kind, stage: g.save.stage, run: g.save.runs });
  void again(g, tab);
}
