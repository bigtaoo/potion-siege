// The horde (wave 1, sim/waves.ts and sim/horde.ts) as BattleView draws it: each rush comes over
// the top edge in a cloud of dust with the board trembling, and the ranks still behind the edge
// fade in out of the haze. Its banner is the HUD's (Hud.ts), its drums and horns cues.ts's.

import type { Graphics } from 'pixi.js';
import type { Battle } from '../sim/battle';
import { isHordeWave } from '../sim/horde';
import { TICK_RATE, ticks } from '../sim/math/fixed';
import { BALANCE, type Enemy } from '../sim/types';

const H = BALANCE.waves.horde;
const F = BALANCE.field;

/** How hard the board trembles as a rush comes in, as BattleView's shake. */
export const RUSH_SHAKE = 0.15;
/** Seconds the dust of a rush hangs over the top edge. */
export const DUST_TIME = 1.1;

/** Watches a battle for the rushes of the horde coming in. */
export class RushWatch {
  private battle: Battle | null = null;
  private wave = 0;
  /** Rushes of the wave met so far. */
  private met = 0;

  /** Whether a rush came in since the last call: only one that just did, not one long past when
   *  the view caught up (a new battle or wave starts the count again). */
  arrived(b: Battle): boolean {
    if (b !== this.battle || b.wave !== this.wave) [this.battle, this.wave, this.met] = [b, b.wave, 0];
    if (!isHordeWave(b.wave)) return false;
    let fresh = false;
    for (; this.met < H.rushes.length && b.waveTime >= ticks(H.rushes[this.met]); this.met++) {
      if (b.waveTime - ticks(H.rushes[this.met]) < TICK_RATE) fresh = true;
    }
    return fresh;
  }
}

/** How far `e` (as drawn, world units) has come out of the haze over the top edge: 1 on the field,
 *  down to 0 a rank behind the edge, where it is not drawn yet. Its shadow and bar wait for 1. */
export function hordeFade(e: Enemy): number {
  return Math.min(1, 1 - (F.top - e.radius - e.y) / H.rowGap);
}

/** The dust a rush kicks up all along the top edge, `life` going from 1 to 0. */
export function hordeDust(g: Graphics, life: number): void {
  const k = 1 - life;
  for (let i = 0; i < 9; i++) {
    const x = F.left + ((F.right - F.left) * (i + 0.5)) / 9 + Math.sin(i * 2.3) * 30;
    const r = (46 + (i % 3) * 14) * (0.6 + k * 0.8);
    g.circle(x, F.top - 10 - k * 30 - (i % 2) * 12, r).fill({ color: 0xb59a76, alpha: life * 0.4 });
  }
}
