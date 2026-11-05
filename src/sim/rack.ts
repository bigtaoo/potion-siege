// The brewing rack (plan 4b): once stage `rack.from` is cleared it brews crystals while the game is
// closed, more the further the campaign has come, up to `capHours` of it; the home screen empties
// it. A clock set back starts it over from now rather than paying for time that never passed.

import type { MetaSave } from './meta';
import { reach } from './rebrew';
import { BALANCE } from './types';

const R = BALANCE.alchemy.rack;
const HOUR = 3_600_000;

/** Whether the rack is open on this save. */
export function rackOpen(m: MetaSave): boolean {
  return reach(m) >= R.from;
}

/** Crystals an hour. */
export function rackRate(m: MetaSave): number {
  return rackOpen(m) ? R.base + R.perStage * reach(m) : 0;
}

/** Hours brewed so far, 0..capHours (0 before the rack is set up). */
export function rackHours(m: MetaSave, now: number): number {
  const at = m.alchemy.rack;
  if (!rackOpen(m) || at <= 0 || now <= at) return 0;
  return Math.min(R.capHours, (now - at) / HOUR);
}

/** What emptying the rack now pays. */
export function rackFill(m: MetaSave, now: number): number {
  return Math.floor(rackRate(m) * rackHours(m, now));
}

/** Whether it is full. */
export function rackFull(m: MetaSave, now: number): boolean {
  return rackOpen(m) && rackHours(m, now) >= R.capHours;
}

/** Sets the rack going the first time it is open, and from now again after the clock went back;
 *  true when the save changed. */
export function startRack(m: MetaSave, now: number): boolean {
  if (!rackOpen(m)) return false;
  if (m.alchemy.rack > 0 && m.alchemy.rack <= now) return false;
  m.alchemy.rack = now;
  return true;
}

/** Empties the rack into the crystals; returns what it paid. */
export function claimRack(m: MetaSave, now: number): number {
  if (startRack(m, now)) return 0;
  const n = rackFill(m, now);
  if (n <= 0) return 0;
  m.crystals += n;
  m.alchemy.rack = now;
  return n;
}
