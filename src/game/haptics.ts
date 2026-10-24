// Vibration on the battle's key moments, where the device can and the player left it on: a
// short buzz for a merge and a hit on the wall, a strong one for a boss coming, a boss's slam
// or kill, and the wall falling.

import type { BattleEvent } from '../sim/types';

/** The wall is hit many times a second in a rush: at most one buzz this often (ms). */
const WALL_GAP = 600;

export class Haptics {
  private lastWall = -Infinity;

  constructor(
    private readonly vibrate: ((strong: boolean) => void) | undefined,
    private readonly on: () => boolean,
  ) {}

  react(events: readonly BattleEvent[], now: number = performance.now()): void {
    if (!this.vibrate || !this.on()) return;
    const strong = events.some((e) => (e.type === 'wave' && e.boss) || e.type === 'slam' || (e.type === 'kill' && e.boss) || (e.type === 'end' && !e.won));
    if (strong) {
      this.vibrate(true);
      return;
    }
    let weak = events.some((e) => e.type === 'merge');
    if (events.some((e) => e.type === 'wallHit') && now - this.lastWall >= WALL_GAP) {
      this.lastWall = now;
      weak = true;
    }
    if (weak) this.vibrate(false);
  }
}
