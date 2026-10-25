// The commander's skills: casting the next one (the flask at the thickest crowd, sized by the
// board's damage, or the brew), its self-cast once charged too long, and its flasks landing.

import type { Battle } from './battle';
import { discharge, harm, slow, splash } from './damage';
import { K } from './field';
import { FP, muldiv, TICK_RATE, ticks, times } from './math/fixed';
import { within } from './targets';
import { BALANCE, type Enemy, type FlaskHit } from './types';

const B = BALANCE;
const C = B.commander;

export function doCast(b: Battle): boolean {
  if (!b.canCast()) return false;
  const skill = b.nextCast;
  if (skill === 'bomb') {
    const target = thickest(b);
    // nothing on the field to throw at: the charge waits
    if (!target) return false;
    const flight = ticks(C.bomb.flight);
    // thrown where the mark will be once the flask comes down, not where it stood, and on a mark
    // still coming in at the top, a little below it (still well within reach), so the burst is
    // seen down the road rather than under the HUD
    const step = target.freezeTime > 0 ? 0 : target.slowTime > 0 ? times(target.speed, target.slowFactor) : target.speed;
    const lead = Math.min(b.wallFront(target.x) - target.radius, target.y + step * flight);
    const y = Math.max(target.y, lead, Math.min(target.y + muldiv(K.bombRadius, 3, 4), K.bombFloor));
    b.flasks.push({ x: target.x, y, time: flight, damage: Math.max(K.bombMin, muldiv(boardDps(b), Math.round(C.bomb.seconds * 1000), 1000)) });
    b.events.push({ type: 'cast', skill, x: target.x / FP, y: y / FP, flight: C.bomb.flight });
  } else {
    b.brewTime = ticks(C.brew.time);
    b.events.push({ type: 'cast', skill, x: 0, y: 0, flight: 0 });
  }
  b.charge = 0;
  b.chargedFor = 0;
  b.casts++;
  return true;
}

/** The enemy with the most others within the flask's reach, the one nearer the wall on a tie.
 *  A crowd far enough down the road for the whole burst to be seen comes first: one still coming
 *  in at the top is under the HUD, and a flask thrown there looked like it did nothing. With
 *  nobody that far down, the one nearest the wall. */
export function thickest(b: Battle): Enemy | null {
  let best: Enemy | null = null;
  let most = 0;
  for (const e of b.enemies) {
    if (e.hp <= 0) continue;
    if (e.y < K.bombFloor) {
      if (most === 0 && (!best || e.y > best.y)) best = e;
      continue;
    }
    let n = 0;
    for (const o of b.enemies) if (o.hp > 0 && within(o, e.x, e.y, K.bombRadius)) n++;
    if (n > most || (n === most && best && e.y > best.y)) {
      best = e;
      most = n;
    }
  }
  return best;
}

/** What the potions on the wall deal a second between them, in FP: their shots' damage over
 *  their intervals, with the skills and perks picked. */
export function boardDps(b: Battle): number {
  let dps = 0;
  for (const h of b.slots) {
    if (!h) continue;
    const speed = h.kind === 'wind' ? b.fixed.windSpeed : b.fixed.speed;
    dps += muldiv(b.fixed.damage[h.kind][h.star - 1], TICK_RATE * speed, K.interval[h.kind][h.star - 1]);
  }
  return dps;
}

/** The brew wears off; a charge left full too long is cast by the commander itself. */
export function stepCommander(b: Battle): void {
  if (b.brewTime > 0) b.brewTime--;
  if (b.charge < C.charge) return;
  if (++b.chargedFor >= ticks(C.autoCast)) doCast(b);
}

/** The commander's flasks fly on; a landed one bursts on everything within its reach and slows
 *  what lives through it. It is no potion, so no resistance takes from it. */
export function stepFlasks(b: Battle): void {
  if (b.flasks.length === 0) return;
  const R = C.bomb;
  b.flasks = b.flasks.filter((f) => {
    if (--f.time > 0) return true;
    // what each one took, for the view's numbers (the events are not hashed)
    const hits: FlaskHit[] = [];
    for (const e of b.enemies) {
      if (e.hp <= 0 || !within(e, f.x, f.y, K.bombRadius)) continue;
      const hp = e.hp;
      harm(b, e, times(f.damage, splash(e)), undefined);
      discharge(b, e);
      if (e.hp > 0) slow(e, R.slow, ticks(R.slowTime));
      // a fallen one shows the flask's whole blow, not the sliver it had left
      const took = e.hp <= 0 ? Math.max(hp, times(f.damage, splash(e))) : hp - e.hp;
      hits.push({ x: e.x / FP, y: e.y / FP, damage: Math.round(took / FP), killed: e.hp <= 0 });
    }
    b.events.push({ type: 'flask', x: f.x / FP, y: f.y / FP, radius: R.radius, hits });
    return false;
  });
}
