// What the bosses and the winder do on the field: the clock's brood of mice, the anvil's hops and
// its slam at the wall, the gear king's rim cracking, and the winder winding back the crowd.

import type { Battle } from './battle';
import { K, slotCenter } from './field';
import { FP, muldiv, pm, ticks, times, toFp } from './math/fixed';
import { within } from './targets';
import { BALANCE, isBoss, type Enemy } from './types';
import { crowdOf } from './waves';

const B = BALANCE;

/** The clock boss opens its pendulum door and lets clockwork mice out at its feet, half as
 *  tough and half the gold of the wave's own. They come out after the loop over the field,
 *  so they start moving on the next tick. */
export function brood(b: Battle, c: Enemy): void {
  const P = B.bosses.clock;
  const hp = Math.round(crowdOf(b.wave, b.setup.endless === true).hp * B.enemies.runner.hp * b.setup.enemyHp * P.hp * FP);
  const spread = toFp(P.spread);
  for (let i = 0; i < P.mice; i++) {
    const side = P.mice === 1 ? 0 : muldiv(spread, 2 * i - (P.mice - 1), P.mice - 1);
    b.hatch.push({ s: { at: 0, kind: 'runner', hp, gold: pm(P.gold) }, x: c.x + side, y: c.y + muldiv(c.radius, 1, 2) });
  }
  b.events.push({ type: 'brood', x: c.x / FP, y: c.y / FP });
}

/** How far an anvil on the way moves this tick, `step` walking: every so often it springs
 *  forward a long way. Slowed, its spring cannot wind up, so the time to the next leap stands. */
export function hop(b: Battle, e: Enemy, step: number): number {
  const A = B.bosses.anvil;
  if (e.leapTime! > 0) {
    e.leapTime!--;
    return Math.trunc(toFp(A.leap) / ticks(A.leapTime));
  }
  if (e.slowTime <= 0 && --e.hopTime! <= 0) {
    e.hopTime = ticks(A.every);
    e.leapTime = ticks(A.leapTime);
    b.events.push({ type: 'leap', x: e.x / FP, y: e.y / FP });
  }
  return step;
}

/** An anvil at the wall slams down on it: a big bite out of the wall, and the potions in the
 *  cells under it stand dazed for a while. */
export function slam(b: Battle, e: Enemy): void {
  const A = B.bosses.anvil;
  b.wall -= K.wallDps.anvil * ticks(A.slam);
  const reach = toFp(A.reach);
  const slots: number[] = [];
  for (const h of b.slots) {
    if (!h || Math.abs(toFp(slotCenter(h.slot).x) - e.x) > reach) continue;
    h.stunTime = Math.max(h.stunTime ?? 0, ticks(A.stun));
    slots.push(h.slot);
  }
  b.events.push({ type: 'slam', x: e.x / FP, y: e.y / FP, slots });
}

/** A winder winds back the enemies around it: a share of their hit points back, and no more
 *  frost or slow on them (rust stays). The boss is too big for it. */
export function rewind(b: Battle, w: Enemy): void {
  const R = B.winder;
  for (const o of b.enemies) {
    if (o === w || o.hp <= 0 || isBoss(o.kind) || !within(o, w.x, w.y, toFp(R.range))) continue;
    o.hp = Math.min(o.maxHp, o.hp + times(o.maxHp, pm(R.heal)));
    o.freezeTime = 0;
    o.slowTime = 0;
    o.chill = 0;
    o.chillTime = 0;
    o.brittleTime = 0;
  }
  b.events.push({ type: 'rewind', x: w.x / FP, y: w.y / FP, radius: R.range });
}

/** The gear king's iron rim flies apart at half its health, whatever the hit: the crowned core
 *  stands a moment, then runs on faster, weak where the rim was strong. */
export function crack(b: Battle, e: Enemy): void {
  const G = B.bosses.gear;
  e.hp = times(e.maxHp, pm(G.at));
  e.core = true;
  e.guardTime = ticks(G.guard);
  e.speed = times(e.speed, pm(G.speed));
  b.events.push({ type: 'crack', x: e.x / FP, y: e.y / FP });
}
