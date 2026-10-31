import { newMeta } from '../sim/meta';

/** A save after `runs` battles, with `levels` more potion levels and `cleared` stages won. */
export function saveWith(runs: number, levels = 0, cleared = 0): string {
  const m = newMeta();
  m.runs = runs;
  m.heroes.fire += levels;
  m.cleared = cleared;
  return JSON.stringify(m);
}
