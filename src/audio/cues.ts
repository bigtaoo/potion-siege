// Which sound each battle event makes.

import type { BattleEvent } from '../sim/types';
import { isHordeWave } from '../sim/horde';
import type { SfxId } from './sfx';

export interface Cue {
  id: SfxId;
  /** Stereo position, -1 (left) .. 1 (right). */
  pan?: number;
  /** Playback rate on top of the sound's own random spread. */
  rate?: number;
  /** Extra level, 0..1. */
  gain?: number;
}

/** A hero kind's hit; unknown kinds (a potion added later) fall back to the arcane zap. */
const HIT: Record<string, SfxId> = {
  arcane: 'hitArcane',
  fire: 'hitFire',
  ice: 'hitIce',
  lightning: 'hitLightning',
  poison: 'hitPoison',
  wind: 'hitWind',
};

/** The board is 1080 wide: its left edge pans a little left, its right a little right. */
const pan = (x: number): number => Math.max(-0.6, Math.min(0.6, (x / 1080 - 0.5) * 1.2));

export function battleCues(events: readonly BattleEvent[]): Cue[] {
  const out: Cue[] = [];
  for (const ev of events) {
    switch (ev.type) {
      case 'hit':
        out.push({ id: HIT[ev.kind] ?? 'hitArcane', pan: pan(ev.x) });
        break;
      case 'kill':
        out.push(ev.boss ? { id: 'kill', pan: pan(ev.x), rate: 0.6, gain: 1 } : { id: 'kill', pan: pan(ev.x), gain: 0.8 });
        break;
      case 'summon':
        out.push({ id: 'summon' });
        break;
      case 'merge':
        // a higher star pours a little higher
        out.push({ id: 'merge', rate: 0.94 + ev.star * 0.04 });
        break;
      case 'offer':
        // the upgrade button's click (the hud's buttons have no click of their own)
        if (ev.reason !== 'ultimate') out.push({ id: 'tap' });
        break;
      case 'cast':
        // the flask leaves the hand with a low pour; the brew bubbles up like a level up
        out.push(ev.skill === 'bomb' ? { id: 'merge', rate: 0.75 } : { id: 'levelup' });
        break;
      case 'flask':
        // a boom of its own, not a fire potion's whoosh lost among the others
        out.push({ id: 'blast', pan: pan(ev.x) });
        break;
      case 'cellOpen':
        out.push({ id: 'crystal' });
        break;
      case 'wave':
        out.push({ id: ev.boss ? 'boss' : isHordeWave(ev.wave) ? 'horde' : 'wave' });
        break;
      case 'wallHit':
        out.push({ id: 'wallHit' });
        break;
      case 'end':
        out.push({ id: ev.won ? 'win' : 'lose' });
        break;
    }
  }
  return out;
}
