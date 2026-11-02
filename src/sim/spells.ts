// What the commander's flasks do where they land: the bomb bursts on everything within its reach
// and knocks it back; the frost freezes it (a boss or a flyer only slows); the acid leaves a pool
// that eats at and slows whatever walks in it for a while. None of it is a potion's, so no
// resistance takes from it.

import type { Battle } from './battle';
import { discharge, harm, slow, splash } from './damage';
import { K } from './field';
import { FP, muldiv, TICK_RATE, ticks, times } from './math/fixed';
import { within } from './targets';
import { BALANCE, isBoss, type Enemy, type Flask, type FlaskHit } from './types';

const B = BALANCE;
const C = B.commander;
/** How long the acid's slow lingers on one that walked out of the pool. */
const ACID_LINGER = 0.3;

/** The commander's flasks fly on and land; the acid pools eat at what is in them. */
export function stepFlasks(b: Battle): void {
  if (b.pools.length > 0) stepPools(b);
  if (b.flasks.length === 0) return;
  b.flasks = b.flasks.filter((f) => {
    if (--f.time > 0) return true;
    land(b, f);
    return false;
  });
}

/** A flask comes down: what each one within its reach took, for the view's numbers (the events
 *  are not hashed). */
function land(b: Battle, f: Flask): void {
  const radius = K.spellRadius[f.skill];
  const hits: FlaskHit[] = [];
  for (const e of b.enemies) {
    if (e.hp <= 0 || !within(e, f.x, f.y, radius)) continue;
    const hp = e.hp;
    if (f.skill === 'bomb') burst(b, e, f.power);
    else if (f.skill === 'frost') chill(e);
    // a fallen one shows the flask's whole blow, not the sliver it had left
    const took = f.skill !== 'bomb' ? 0 : e.hp <= 0 ? Math.max(hp, times(f.power, splash(e))) : hp - e.hp;
    hits.push({ x: e.x / FP, y: e.y / FP, damage: Math.round(took / FP), killed: e.hp <= 0 });
  }
  if (f.skill === 'acid') b.pools.push({ x: f.x, y: f.y, time: ticks(C.acid.time), perTick: muldiv(f.power, 1, TICK_RATE) });
  b.events.push({ type: 'flask', skill: f.skill, how: f.how, x: f.x / FP, y: f.y / FP, radius: radius / FP, hits });
}

/** The bomb's blow, then the knock back up the road (off the wall if it was at it). A boss is
 *  too big to move, and one of a rush still behind the top edge is not pushed onto it. */
function burst(b: Battle, e: Enemy, damage: number): void {
  harm(b, e, times(damage, splash(e)), undefined);
  discharge(b, e);
  if (e.hp <= 0 || isBoss(e.kind)) return;
  e.y = Math.max(Math.min(e.y, K.top - e.radius), e.y - K.bombPush);
  e.atWall = false;
  if (e.kind === 'winder') e.windTime = ticks(B.winder.every);
}

/** The frost: frozen in place, or a boss or a flyer (too big, or its wings keep beating) slowed. */
function chill(e: Enemy): void {
  const time = ticks(C.frost.time);
  if (isBoss(e.kind) || e.kind === 'flyer') slow(e, C.frost.bossSlow, time);
  else e.freezeTime = Math.max(e.freezeTime, time);
}

/** Each pool eats at what stands in it and slows it, then dries up. */
function stepPools(b: Battle): void {
  const radius = K.spellRadius.acid;
  const linger = ticks(ACID_LINGER);
  for (const p of b.pools) {
    for (const e of b.enemies) {
      if (e.hp <= 0 || !within(e, p.x, p.y, radius)) continue;
      harm(b, e, times(p.perTick, splash(e)), undefined);
      slow(e, C.acid.slow, linger);
    }
  }
  b.pools = b.pools.filter((p) => --p.time > 0);
}
