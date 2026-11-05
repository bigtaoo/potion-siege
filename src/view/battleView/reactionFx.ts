// The potion reactions on the field (sim/reactions.ts): each kind its own two colours, a ring
// that runs out as far as the reaction reaches and a few sparks or puffs in it; the first of
// each kind in a battle also shouts its name over the spot, so a new player sees that two
// potions did something together.

import type { Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { REACTION_IDS, type ReactionId } from '../../sim/types';
import { INK } from '../potion';
import type { Floaters } from './floaters';
import type { FxLayer } from './fxLayer';

/** Each reaction's colours: the main one (its ring and name), and the one of its sparks. */
export const REACTION_COLORS: Record<ReactionId, readonly [number, number]> = {
  steam: [0xf2f6ff, 0xff8a5c],
  superconduct: [0x8fe4ff, 0xfff07a],
  overload: [0xff9a2e, 0xffe14d],
  electrolysis: [0x9be35a, 0xfff07a],
  combustion: [0xff6a3d, 0x9be35a],
  firestorm: [0xff7a2a, 0xffd36b],
  blizzard: [0xdff4ff, 0x8fe3c8],
  resonance: [0xc58cff, 0xffffff],
};

/** Seconds a reaction's ring takes to run out and fade. */
export const REACTION_TIME = 0.55;

const easeOut = (p: number): number => 1 - (1 - p) * (1 - p);

/** A reaction `p` (0..1) of the way through, at (x, y), reaching `radius`. */
export function reactionRing(g: Graphics, id: ReactionId, x: number, y: number, radius: number, p: number): void {
  const [main, spark] = REACTION_COLORS[id];
  const a = 1 - p;
  const r = Math.max(30, radius) * (0.35 + 0.75 * easeOut(p));
  g.circle(x, y, r).fill({ color: main, alpha: a * 0.28 });
  g.circle(x, y, r).stroke({ width: 10, color: INK, alpha: a * 0.6 });
  g.circle(x, y, r).stroke({ width: 6, color: main, alpha: a });
  // sparks thrown out round the ring, turned a little by the kind so no two look alike
  const n = id === 'resonance' ? 5 : 8;
  const turn = REACTION_IDS.indexOf(id) * 0.4 + p * (id === 'firestorm' || id === 'blizzard' ? 3 : 0.6);
  for (let i = 0; i < n; i++) {
    const ang = turn + (i * Math.PI * 2) / n;
    const d = r * (0.6 + 0.35 * p);
    g.circle(x + Math.cos(ang) * d, y + Math.sin(ang) * d, 9 * a + 3).fill({ color: spark, alpha: a });
  }
}

/** Shows the reactions as they go off; remembers which kinds this battle has named already. */
export class ReactionFx {
  private readonly named = new Set<ReactionId>();

  clear(): void {
    this.named.clear();
  }

  show(fx: FxLayer, floaters: Floaters, id: ReactionId, x: number, y: number, radius: number): void {
    fx.effect(REACTION_TIME, (g, life) => reactionRing(g, id, x, y, radius, 1 - life));
    if (this.named.has(id)) return;
    this.named.add(id);
    floaters.show(t('codex.rxShout', { name: t(`codex.rx.${id}`) }), x, y - 70, REACTION_COLORS[id][0], 1.25);
  }
}
