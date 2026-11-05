// The first battles' seed, kept apart from meta.ts so the save's rules have room there.

import type { MetaSave } from './meta';

/** The seed of a new player's battles: the first one, and stage 1 again until it is won, so
 *  their telemetry compares run for run (the waves are the same whatever the player does).
 *  Picked by scripts/first-seed.test.ts over seeds 1-2000 on the stage 1 base setup: the first
 *  two summons are a fire pair side by side on the wall (cells 18 and 17, at and just right of
 *  the middle), so the tutorial's merge is one short drag on the first potions the art shows off,
 *  clear of the hands on 召唤 and 强化 that sit over the outer two columns on each side on a tall
 *  screen; the third is an arcane one in cell 16, so there is one pair to point at and it too stays
 *  in sight; wave 1 comes down both halves of the field evenly (18 / 20 of the first 38); and the
 *  bot wins with the wall untouched whether it acts every tick or only every 0.5, 1 or 2 s.
 *  It took over from 609, whose pair stood under the hand on 召唤.
 *  Summons roll on their own stream, so this opening holds however long the player waits between
 *  taps. A change to what the battle rolls its dice for, or in what order, changes what this
 *  seed plays: run the script again
 *  (SEEDS=2000 npx vitest run --config scripts/vitest.seed.config.js) and repick. */
export const FIRST_SEED = 1764;

/** FIRST_SEED for a save that has not won a battle yet on stage 1, else null (a random one). */
export function firstSeed(m: MetaSave): number | null {
  return m.cleared === 0 && m.stage === 1 && m.alchemy.rebrew.count === 0 ? FIRST_SEED : null;
}
