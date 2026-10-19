// What one of the horde (wave 1, waves.ts) is worth when it dies. Each of it weighs a fraction of
// an enemy, its heft in thousandths, and earns that share of what a whole one does: a share of a
// charge, of its kill gold and of each on-kill burst. The shares add up here and pay out as each
// reaches a whole, so the wave gives what the smaller crowd before it did. Counted, not rolled,
// so it takes no dice; and every count is an integer, which hash.ts walks with the battle.

import { BALANCE } from './types';

type Skill = 'fireChain' | 'melt' | 'split' | 'vortex';

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
    return heft < 1000 ? this.take('charge', Math.round(heft * BALANCE.waves.horde.charge)) : 1;
  }

  /** Whether the on-kill burst `skill` goes off for a death: always for a whole enemy; one of the
   *  horde adds its heft towards the next, so a quarter-weight crowd sets off one burst in four
   *  deaths, as strong as ever (shatter needs none of this, its shards scale with the maxHp of
   *  what died). */
  proc(skill: Skill, heft: number): boolean {
    return heft >= 1000 || this.take(skill, heft) > 0;
  }
}
