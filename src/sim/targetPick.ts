// Whom each potion throws at: its own preference among the enemies on the field, falling back
// to the front one (nearest the wall). Worked out once a tick for all the potions that throw in
// it, each rule only when one of its potions does.
//  arcane     the front, and its extra bolts the ones behind
//  fire       the thickest crowd: the one with the most others within the blast
//  ice        the fastest not slowed yet
//  lightning  the front-most one the chain jumps on from the furthest
//  poison     the front-most not poisoned yet
//  wind       what it can catch: the flyer or the winder
// Any enemy at the wall or about to reach it comes first for every potion but the wind.

import type { Battle } from './battle';
import { K } from './field';
import { toFp } from './math/fixed';
import { nearest, targets as aliveFrontFirst, within } from './targets';
import { BALANCE, type Enemy, type HeroKind } from './types';

const B = BALANCE;

/** How many of the front ones the lightning tries its chain from: the rest are too far back
 *  to be worth the look. */
const CHAIN_LOOK = 12;

export class TargetPick {
  /** Alive enemies, front first; ties keep the battle's own order. */
  readonly front: Enemy[];
  private readonly b: Battle;
  private dense?: Enemy;
  private chain?: Enemy;
  private danger?: Enemy | null;
  /** Ids a shot of that potion is already flying at (or was just thrown at this tick). */
  private readonly aimed = new Map<HeroKind, Set<number>>();

  constructor(b: Battle) {
    this.b = b;
    this.front = aliveFrontFirst(b);
  }

  /** The enemy a `kind` potion throws its (first) shot at. Only call with enemies left. */
  pick(kind: HeroKind): Enemy {
    if (kind === 'wind') return this.front.find((e) => e.kind === 'flyer' || e.kind === 'winder') ?? this.front[0];
    if (kind === 'arcane') return this.front[0];
    const danger = this.atWall();
    if (danger) return danger;
    switch (kind) {
      case 'fire':
        return (this.dense ??= this.densest());
      case 'lightning':
        return (this.chain ??= this.longestChain());
      case 'ice':
        return this.claim(kind, this.fastestFree(kind));
      case 'poison':
        return this.claim(kind, this.front.find((e) => onField(e) && e.poisonTime <= 0 && !this.taken(kind, e)));
    }
  }

  /** The front-most enemy at the wall or within a step of reaching it, if any: it may not wait. */
  private atWall(): Enemy | null {
    if (this.danger !== undefined) return this.danger;
    const e = this.front[0];
    const near = toFp(B.targeting.wallNear);
    return (this.danger = e && (e.atWall || e.y + e.radius + near >= this.b.wallFront(e.x)) ? e : null);
  }

  private densest(): Enemy {
    const radius = this.b.fixed.fireRadius;
    let best = this.front[0];
    let most = 0;
    for (const e of this.front) {
      if (!onField(e)) continue;
      let n = 0;
      for (const o of this.front) if (o !== e && within(o, e.x, e.y, radius)) n++;
      if (n > most) {
        best = e;
        most = n;
      }
    }
    return best;
  }

  /** The front-most of the first CHAIN_LOOK the chain runs on the longest from, as hits.ts
   *  chains it: each hop to the nearest one not hit yet. */
  private longestChain(): Enemy {
    const hops = B.heroes.lightning.chains + this.b.mods.extraChains;
    const range = toFp(B.heroes.lightning.chainRange);
    let best = this.front[0];
    let most = -1;
    for (const e of this.front.slice(0, CHAIN_LOOK)) {
      if (!onField(e)) continue;
      const hit = new Set([e.id]);
      let cur: Enemy | undefined = e;
      let n = 0;
      while (n < hops && (cur = nearest(this.b, cur, range, hit))) {
        hit.add(cur.id);
        n++;
      }
      if (n > most) {
        best = e;
        most = n;
        if (n === hops) break;
      }
    }
    return best;
  }

  private fastestFree(kind: HeroKind): Enemy | undefined {
    let best: Enemy | undefined;
    for (const e of this.front) {
      if (!onField(e) || e.slowTime > 0 || e.freezeTime > 0 || this.taken(kind, e)) continue;
      if (!best || e.speed > best.speed) best = e;
    }
    return best;
  }

  private taken(kind: HeroKind, e: Enemy): boolean {
    let ids = this.aimed.get(kind);
    if (!ids) {
      ids = new Set();
      for (const p of this.b.projectiles) if (p.kind === kind) ids.add(p.targetId);
      this.aimed.set(kind, ids);
    }
    return ids.has(e.id);
  }

  /** `e`, booked for the potion so the next one of its kind this tick looks elsewhere, or the
   *  front one without it. */
  private claim(kind: HeroKind, e: Enemy | undefined): Enemy {
    if (!e) return this.front[0];
    this.aimed.get(kind)!.add(e.id);
    return e;
  }
}

/** Down past the top edge, where the player can see it. */
function onField(e: Enemy): boolean {
  return e.y + e.radius >= K.top;
}
