// The HUD's hand at the next move, as plain rules over the battle. In a player's first battles
// (`early`) it shows whatever can be done as soon as it can, 强化 first (it gives a new skill, the
// biggest step a battle has, and new players never found it behind the merges), then a pair to
// fuse, then 召唤; it waits only for the player's last move to settle (REST_AFTER_MOVE), and gives way to the
// commander's own hand while a full charge waits to be cast (a player still dragging a spell was
// sent to 召唤 mid-aim; the charge casts itself after 15 s anyway). Later it shows only to a player
// short of VETERAN_MERGES who has stood still a while, a pair first, then 强化, then 召唤.
// Measured on 11-02: the first battle had 98 s with something to do and nothing pointing at it.
import type { Battle } from '../sim/battle';
import { mergeablePair } from '../sim/tutorial';
import { BALANCE } from '../sim/types';
import { MoveRest, REST_AFTER_MOVE } from './moveRest';

export type Move = [number, number] | 'summon' | 'upgrade';

/** Early battles: seconds a move has been there before the hand shows it, and seconds after the
 *  player's last move before it shows anything. */
export const EARLY = { show: 0.6, rest: REST_AFTER_MOVE };

/** Seconds a player short of VETERAN_MERGES could act and has not before the hand shows the next
 *  move, past the early battles. Players who stopped after the tutorial's guided summons lost
 *  stage 1 with 1–2. */
export const IDLE_AFTER = 4;

const same = (a: Move | null, b: Move | null): boolean => `${a}` === `${b}`;

export class NextMove {
  /** The player's last move, and seconds since the move now at hand came up. */
  private rest = new MoveRest();
  private ready = 0;
  private move: Move | null = null;

  /** A new battle: the clocks start over. */
  reset(b: Battle): void {
    this.rest = new MoveRest();
    this.rest.update(b, 0);
    this.ready = 0;
    this.move = null;
  }

  /** The move to point at this frame, `dt` seconds on, or null. `on`: the hand may show at all
   *  (off while the tutorial points, or for a veteran past the early battles). */
  update(b: Battle, early: boolean, on: boolean, dt: number): Move | null {
    const live = !b.paused && !b.result;
    const pair = live ? mergeablePair(b) : null;
    const upgrade = b.canUpgrade() ? 'upgrade' : null;
    const summon = b.canSummon() ? 'summon' : null;
    const move = !live ? null : early ? (upgrade ?? pair ?? summon) : (pair ?? upgrade ?? summon);
    const quiet = this.rest.update(b, dt);
    if (!early) {
      // the old idle clock: any move at hand and none made
      this.ready = on && move !== null && quiet > 0 ? this.ready + dt : 0;
      return this.ready >= IDLE_AFTER ? move : null;
    }
    this.ready = same(move, this.move) ? this.ready + dt : 0;
    this.move = move;
    const full = b.charge >= BALANCE.commander.charge;
    return on && move !== null && !full && this.ready >= EARLY.show && quiet >= EARLY.rest ? move : null;
  }
}
