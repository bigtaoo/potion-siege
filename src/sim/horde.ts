// The horde: the first wave of every stage (and of an endless run) comes as some fifty small grunts
// in three rushes instead of the usual crowd. planWave (waves.ts) rolls the crowd as before and
// makes each of it one of the horde here; the battle (battle.ts) brings them in by their lanes and
// pays out their deaths through Shares. Each of the horde weighs a share of an enemy, its heft in
// thousandths, at the wall, for the commander, in gold and for the on-kill skills, so the wave is
// worth what the smaller crowd before it was. None of it takes dice.

import { ticks, toFp } from './math/fixed';
import { BALANCE } from './types';
import type { Spawn } from './waves';

const H = BALANCE.waves.horde;
const F = BALANCE.field;

/** Whether `wave` opens with the horde: the first wave of every stage (and of an endless run). */
export function isHordeWave(wave: number): boolean {
  return wave === 1;
}

/** Makes `spawn` one of the horde: `heft` thousandths of an enemy, `horde.size` of its kind's
 *  radius and `horde.hp` of its hit points (fifty-odd bodies coming in twelve seconds want a shot
 *  each, and at full weight the potions of a weak save need two for each by stage 4, fall behind
 *  and lose by wave 3). */
export function joinHorde(spawn: Spawn, heft: number): void {
  spawn.hp = Math.round((spawn.hp * Math.round(H.hp * 1000)) / 1000);
  spawn.heft = heft;
  spawn.size = Math.round(H.size * 1000);
}

/** Lays the crowd of the horde wave out as `horde.rushes`: the n-th spawn joins rush
 *  floor(n * rushes / count), all of a rush come in on the same tick, in rows of up to
 *  `horde.cols` across the field's width, each row `horde.rowGap` further behind the top edge
 *  than the one before and every other one shifted by a quarter of a lane, so a rush marches in
 *  as a block. Only the times and lanes change: the kinds are rolled as before, and each spawn
 *  still draws its x (within its lane now) and its speed, so the horde takes no extra dice. */
export function rankAndFile(spawns: Spawn[]): void {
  const width = F.right - F.left;
  const rushes = H.rushes.length;
  const count = spawns.length;
  for (let r = 0; r < rushes; r++) {
    const from = Math.ceil((count * r) / rushes);
    const to = Math.ceil((count * (r + 1)) / rushes);
    const n = to - from;
    const rows = Math.ceil(n / H.cols);
    for (let j = 0; j < n; j++) {
      const row = Math.floor(j / H.cols);
      const across = row < rows - 1 ? H.cols : n - H.cols * (rows - 1);
      const lane = width / across;
      const shift = across === H.cols ? (row % 2 === 0 ? -lane / 4 : lane / 4) : 0;
      const x0 = F.left + lane * (j % H.cols) + shift;
      const spawn = spawns[from + j];
      spawn.at = ticks(H.rushes[r]);
      spawn.lane = { x0: Math.round(x0), x1: Math.round(x0 + lane), back: row * H.rowGap };
    }
  }
}

/** The span (FP) `s` may come in at, inside `lo`..`hi`, the field's for its radius: its lane, for
 *  one of a rush, else all of it. */
export function laneSpan(s: Spawn, lo: number, hi: number): [number, number] {
  if (!s.lane) return [lo, hi];
  const from = Math.max(lo, toFp(s.lane.x0));
  return [from, Math.max(from, Math.min(hi, toFp(s.lane.x1)))];
}

type Skill = 'fireChain' | 'melt' | 'split' | 'vortex';

/** What the horde's deaths have earned: the shares add up and pay out as each reaches a whole.
 *  Every count is an integer, which hash.ts walks with the battle. */
export class Shares {
  /** Thousandths owed towards the next charge, coin and burst of each skill. */
  private owed = { charge: 0, gold: 0, fireChain: 0, melt: 0, split: 0, vortex: 0 };

  /** Adds `thousandths` to `key` and pays out the wholes it makes. */
  private take(key: keyof Shares['owed'], thousandths: number): number {
    this.owed[key] += thousandths;
    const whole = Math.trunc(this.owed[key] / 1000);
    this.owed[key] %= 1000;
    return whole;
  }

  /** The kill gold for a death worth `pay` thousandths of a coin: rounded for a whole enemy; one
   *  of the horde pays its share exactly, carried over to the next, so fifty-odd small ones do
   *  not round up to more than the wave was worth. */
  gold(pay: number, heft: number): number {
    return heft < 1000 ? this.take('gold', Math.round(pay)) : Math.round(pay / 1000);
  }

  /** The charge a (non-boss) death gives: one for a whole enemy; one of the horde gives
   *  `horde.charge` times its heft, so the wave fills the commander as the 25 of it used to. */
  charge(heft: number): number {
    return heft < 1000 ? this.take('charge', Math.round(heft * H.charge)) : 1;
  }

  /** Whether the on-kill burst `skill` goes off for a death: always for a whole enemy; one of the
   *  horde adds its heft towards the next, so a quarter-weight crowd sets off one burst in four
   *  deaths, as strong as ever (shatter needs none of this, its shards scale with the maxHp of
   *  what died). */
  proc(skill: Skill, heft: number): boolean {
    return heft >= 1000 || this.take(skill, heft) > 0;
  }
}
