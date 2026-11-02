// How each kind of clockwork enemy walks, driven by how far it has come down the field, not by the
// clock: one that is frozen, slowed, waiting or at the wall stops stepping, and at the battle's
// fast forward its feet keep pace with the ground.

import { BALANCE, type Enemy, type EnemyKind } from '../sim/types';

/** How a walker stands mid-step: lifted `up` over its feet, turned `rot`, scaled by `sx` and `sy`. */
export interface Step {
  up: number;
  rot: number;
  sx: number;
  sy: number;
}

const GRUNT = BALANCE.enemies.grunt.speed;

/** Radians of step per world unit walked: a walker of speed v used to take 9·√(v/grunt) radians a
 *  second, so a quicker kind takes quicker, longer steps. */
export function strideRate(kind: EnemyKind): number {
  return 9 / Math.sqrt(BALANCE.enemies[kind].speed * GRUNT);
}

/** Where `e` (as drawn: world units) is in its walk: its distance down the field over its stride,
 *  out of step with the others by its id. */
export function stepPhase(e: Enemy): number {
  return e.y * strideRate(e.kind) + e.id * 1.7;
}

/** The step of a walker at phase `s`. The flyer, winder, anvil and gear king walk in enemyPose. */
export function walk(kind: EnemyKind, s: number): Step {
  const hop = Math.abs(Math.sin(s));
  switch (kind) {
    case 'runner':
      // light and springy: high bounces, stretched as it leaves the ground
      return { up: hop * 12, rot: Math.cos(s) * 0.04, sx: 1.03 - hop * 0.05, sy: 0.94 + hop * 0.1 };
    case 'brute': {
      // heavy: barely leaves the ground, a wide sway and a squash each time a foot comes down
      const off = Math.min(1, hop * 3);
      return { up: hop * hop * 6, rot: Math.cos(s) * 0.1, sx: 1.04 - off * 0.04, sy: 0.92 + off * 0.08 };
    }
    case 'boss':
      // the tank rolls on tracks: no steps, only a rumble
      return { up: Math.abs(Math.sin(s * 3)) * 0.3 * 8, rot: 0, sx: 1, sy: 1 };
    case 'clock':
      // tick, tock: it snaps from one side to the other like its pendulum
      return { up: hop * 5, rot: 0.08 * Math.tanh(4 * Math.sin(s * 0.5)), sx: 1, sy: 0.97 + hop * 0.04 };
    case 'tripod': {
      // three legs in turn: a lean that comes round every third step
      const h = Math.abs(Math.sin(s * 1.5));
      return { up: h * 6, rot: 0.07 * Math.sin(s), sx: 1, sy: 0.97 + h * 0.05 };
    }
    default:
      // the grunt's waddle
      return { up: hop * 8, rot: Math.cos(s) * 0.07, sx: 1, sy: 0.96 + hop * 0.06 };
  }
}

/** Seconds between the blows of each kind beating on the wall. */
export const BASH_EVERY: Record<EnemyKind, number> = {
  grunt: 0.8, runner: 0.55, brute: 1.1, boss: 1, flyer: 0.7, winder: 0.7, clock: 1.2, tripod: 1, anvil: 1, gear: 0.9,
};
/** The point of the blow where it lands on the wall. */
export const BASH_IMPACT = 0.7;

/** 0-1 through `e`'s blow at battle time `t`, out of step with the others by its id. */
export function bashPhase(e: Enemy, t: number): number {
  const p = t / BASH_EVERY[e.kind] + e.id * 0.37;
  return p - Math.floor(p);
}

/** A blow on the wall at phase `c`: it rears back, lunges `fwd` toward the wall (world units, for
 *  a radius of 30) and squashes into it, then settles back. */
export function bash(c: number): { fwd: number; up: number; sy: number } {
  if (c < 0.55) {
    const k = Math.sin((c / 0.55) * (Math.PI / 2));
    return { fwd: -10 * k, up: 4 * k, sy: 1 + 0.06 * k };
  }
  if (c < BASH_IMPACT) {
    const k = (c - 0.55) / (BASH_IMPACT - 0.55);
    return { fwd: -10 + 28 * k * k, up: 4 * (1 - k), sy: 1.06 - 0.16 * k };
  }
  const k = (c - BASH_IMPACT) / (1 - BASH_IMPACT);
  return { fwd: 18 * (1 - k) * (1 - k), up: 0, sy: 0.9 + 0.1 * k };
}
