// The HUD's hand at the next move, as plain rules over the battle. In a player's first battles
// (`early`) it shows whatever can be done as soon as it can, 强化 first (it gives a new skill, the
// biggest step a battle has, and new players never found it behind the merges), then a pair to
// fuse, then 召唤; it waits only for the player's last move to settle (REST_AFTER_MOVE), and gives way to the
// commander's own hand while a full charge waits to be cast (a player still dragging a spell was
// sent to 召唤 mid-aim; the charge casts itself after 15 s anyway). Later it shows only to a player
// who could act and has not for IDLE_AFTER, a pair first, then 强化, then 召唤; a kind of move it
// showed IGNORE_LIMIT times without the player making it is left alone for the rest of the battle
// (owner 11-02: past battle 3 the player knows the rules, and is only now and then lost).
// Measured on 11-02: the first battle had 98 s with something to do and nothing pointing at it.
import type { Battle } from '../sim/battle';
import { mergeablePair } from '../sim/tutorial';
import { BALANCE } from '../sim/types';
import { MoveRest, REST_AFTER_MOVE } from './moveRest';

export type Move = [number, number] | 'summon' | 'upgrade';

/** Early battles: seconds a move has been there before the hand shows it, and seconds after the
 *  player's last move before it shows anything. */
export const EARLY = { show: 0.6, rest: REST_AFTER_MOVE };

/** Seconds a player could act and has not before the hand shows the next move, past the early
 *  battles. */
export const IDLE_AFTER = 10;

/** Times the hand shows a kind of move the player then does not make before it stops pointing at
 *  that kind for the battle. */
export const IGNORE_LIMIT = 3;

export type MoveKind = 'pair' | 'upgrade' | 'summon';

const same = (a: Move | null, b: Move | null): boolean => `${a}` === `${b}`;
const kindOf = (m: Move): MoveKind => (Array.isArray(m) ? 'pair' : m);
const made = (b: Battle): Record<MoveKind, number> => ({ pair: b.merges, upgrade: b.upgrades, summon: b.summons });

export class NextMove {
  /** The player's last move, and seconds since the move now at hand came up. */
  private rest = new MoveRest();
  private ready = 0;
  private move: Move | null = null;
  /** Past the early battles: the kind the hand is on, and how often each kind was shown since
   *  the player last made one. */
  private showing: MoveKind | null = null;
  private shows: Record<MoveKind, number> = { pair: 0, upgrade: 0, summon: 0 };
  private made: Record<MoveKind, number> = { pair: 0, upgrade: 0, summon: 0 };
  /** The idle hand came up on a kind of move, or the player made the move it was on. */
  onHint: (kind: MoveKind, result: 'shown' | 'followed') => void = () => {};

  /** A new battle: the clocks and counts start over. */
  reset(b: Battle): void {
    this.rest = new MoveRest();
    this.rest.update(b, 0);
    this.ready = 0;
    this.move = null;
    this.showing = null;
    this.shows = { pair: 0, upgrade: 0, summon: 0 };
    this.made = made(b);
  }

  /** The move to point at this frame, `dt` seconds on, or null. `on`: the hand may show at all
   *  (off while the tutorial points, or past the early battles with hints off in the settings). */
  update(b: Battle, early: boolean, on: boolean, dt: number): Move | null {
    const live = !b.paused && !b.result;
    const pair = live ? mergeablePair(b) : null;
    const upgrade = b.canUpgrade() ? 'upgrade' : null;
    const summon = b.canSummon() ? 'summon' : null;
    const quiet = this.rest.update(b, dt);
    if (!early) return this.idle(b, live ? [pair, upgrade, summon] : [], on, quiet, dt);
    const move = !live ? null : (upgrade ?? pair ?? summon);
    this.ready = same(move, this.move) ? this.ready + dt : 0;
    this.move = move;
    const full = b.charge >= BALANCE.commander.charge;
    return on && move !== null && !full && this.ready >= EARLY.show && quiet >= EARLY.rest ? move : null;
  }

  /** Past the early battles: the first move at hand of a kind not shown IGNORE_LIMIT times in
   *  vain, once the player could act and has not for IDLE_AFTER. */
  private idle(b: Battle, moves: (Move | null)[], on: boolean, quiet: number, dt: number): Move | null {
    const now = made(b);
    for (const k of Object.keys(now) as MoveKind[]) {
      if (now[k] === this.made[k]) continue;
      this.shows[k] = 0;
      if (k === this.showing) this.onHint(k, 'followed');
    }
    this.made = now;
    const move = moves.find((m): m is Move => m !== null && (kindOf(m) === this.showing || this.shows[kindOf(m)] < IGNORE_LIMIT)) ?? null;
    this.ready = on && move !== null && quiet > 0 ? this.ready + dt : 0;
    if (this.ready < IDLE_AFTER || !move) {
      this.showing = null;
      return null;
    }
    const kind = kindOf(move);
    if (kind !== this.showing) {
      this.showing = kind;
      this.shows[kind]++;
      this.onHint(kind, 'shown');
    }
    return move;
  }
}
