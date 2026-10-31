// 召唤 swells on stages 1-3 when the player has stood still for a few seconds with gold for a
// summon (audit G1): a lost new player is shown the one button that always helps. Every player
// gets it there, veterans too, unlike the HUD's idle hand (Hud.ts IDLE_SUMMON_AFTER).
import type { Battle } from '../sim/battle';
import { ASSIST_UNTIL } from '../sim/lossStreak';

/** Seconds standing still before 召唤 swells. */
export const IDLE_PULSE_AFTER = 3;

const clocks = new WeakMap<Battle, { idle: number; acted: string }>();

/** Changes with each summon, merge, 强化 and opened cell. */
const actedOn = (b: Battle): string => `${b.summons} ${b.merges} ${b.upgrades} ${b.freeSlots().length}`;

/** Whether 召唤 should swell this frame, `dt` seconds on. */
export function idlePulse(b: Battle | null, dt: number): boolean {
  if (!b) return false;
  const early = b.setup.stage <= ASSIST_UNTIL && !b.setup.endless && !b.setup.modifiers && !b.setup.hard;
  const clock = clocks.get(b) ?? { idle: 0, acted: actedOn(b) };
  clocks.set(b, clock);
  const acted = actedOn(b);
  const still = early && !b.result && b.canSummon() && acted === clock.acted;
  clock.idle = still ? clock.idle + dt : 0;
  clock.acted = acted;
  return clock.idle >= IDLE_PULSE_AFTER;
}
