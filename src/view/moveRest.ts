// The player's last move, for every hand that guides: none shows sooner than REST_AFTER_MOVE after
// a summon, merge, 强化, cast or skill pick, so the player sees what their own tap did before the
// next hint asks for another (owner playtest 11-02: hints came so fast after a tap that a new
// player had not taken in what they had just done). One hint giving way to the next with no move
// between is not held.
import type { Battle } from '../sim/battle';

/** Seconds after the player's move before the next hint shows. */
export const REST_AFTER_MOVE = 2;

/** Changes with each summon, merge, 强化 and cast, as the skill cards open and are picked, and as
 *  a cell opens. */
export const movesOf = (b: Battle): string =>
  `${b.summons} ${b.merges} ${b.upgrades} ${b.casts} ${b.choices ? 1 : 0} ${b.freeSlots().length}`;

export class MoveRest {
  private battle: Battle | null = null;
  private moves = '';
  private since = Infinity;

  /** Seconds since the player last moved in `b`, `dt` seconds on; a new battle starts rested. */
  update(b: Battle, dt: number): number {
    const moves = movesOf(b);
    if (b !== this.battle) this.since = Infinity;
    else this.since = moves !== this.moves ? 0 : this.since + dt;
    this.battle = b;
    this.moves = moves;
    return this.since;
  }

  /** Whether the player moved in `b` less than REST_AFTER_MOVE back, a move since the last
   *  update counting too, without moving the clock on. */
  resting(b: Battle): boolean {
    return b === this.battle && (movesOf(b) !== this.moves || this.since < REST_AFTER_MOVE);
  }

  /** Whether the last move is REST_AFTER_MOVE back. */
  rested(b: Battle, dt: number): boolean {
    return this.update(b, dt) >= REST_AFTER_MOVE;
  }
}
