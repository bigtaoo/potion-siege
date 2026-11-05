// Potion reactions: when a potion's hit lands on an enemy still carrying another potion's
// element, the two react, on their own, with no skill needed. Fire's element is its scorch, the
// ice's the frost it leaves, lightning's the shock, poison's the poison itself; wind and arcane
// leave none and only set reactions off.
//
//   fire + ice        steam         a scalding cloud: damage and a slow all around
//   lightning + ice   superconduct  the frozen one shatters the bolt out: damage all around
//   fire + lightning  overload      a blast all around
//   lightning + poison electrolysis the poison runs down the current: poison and rust all around
//   fire + poison     combustion    the poison left goes up at once, on everything around
//   wind + fire       firestorm     the wind fans the flames onto everything around
//   wind + ice        blizzard      the frost blown about: a slow all around
//   arcane + any      resonance     the bolt rings with the element: extra damage on it
//
// An enemy reacts at most once every `cooldown`; the element a reaction used up is gone.

import type { Battle } from './battle';
import { corrode, harm, slow, splash } from './damage';
import { FP, pm, TICK_RATE, ticks, times, toFp } from './math/fixed';
import { reactionPower } from './reactionPower';
import { within } from './targets';
import { BALANCE, type Enemy, type HeroKind, type ReactionId } from './types';

const R = () => BALANCE.reactions;


type Element = 'fire' | 'ice' | 'lightning' | 'poison';

/** The elements `e` carries now. */
export function elementsOn(e: Enemy): Element[] {
  const out: Element[] = [];
  if (e.scorchTime > 0) out.push('fire');
  if ((e.frostTime ?? 0) > 0) out.push('ice');
  if ((e.shockTime ?? 0) > 0) out.push('lightning');
  if (e.poisonTime > 0) out.push('poison');
  return out;
}

/** The reaction a hit by `by` sets off with `on`, the element already there; null when none. */
export function reactionOf(by: HeroKind, on: Element): ReactionId | null {
  if (by === on) return null;
  if (by === 'arcane') return 'resonance';
  const pair = [by, on].sort().join('+');
  switch (pair) {
    case 'fire+ice':
      return 'steam';
    case 'ice+lightning':
      return 'superconduct';
    case 'fire+lightning':
      return 'overload';
    case 'lightning+poison':
      return 'electrolysis';
    case 'fire+poison':
      return 'combustion';
    case 'fire+wind':
      return 'firestorm';
    case 'ice+wind':
      return 'blizzard';
  }
  return null;
}

/** A hit by `by` for `damage` (FP) has landed on `e`: sets off the first reaction it finds with an
 *  element `e` carries, then leaves the hit's own element on it (ice and lightning; fire's and
 *  poison's the hit itself left). */
export function react(b: Battle, e: Enemy, by: HeroKind, damage: number): void {
  if (!b.reacting) return;
  if (e.hp > 0 && (e.reactTime ?? 0) <= 0) {
    for (const on of elementsOn(e)) {
      const id = reactionOf(by, on);
      if (!id) continue;
      e.reactTime = ticks(R().cooldown);
      setOff(b, e, id, on, by, damage);
      break;
    }
  }
  if (by === 'ice') e.frostTime = ticks(R().frostTime);
  if (by === 'lightning') e.shockTime = ticks(R().shockTime);
}

/** The element `on` is used up by the reaction. */
function useUp(e: Enemy, on: Element): void {
  if (on === 'ice') e.frostTime = 0;
  else if (on === 'lightning') e.shockTime = 0;
  else if (on === 'poison') {
    e.poisonTime = 0;
    e.poisonDps = 0;
  } else e.scorchTime = 0;
}

/** Everything alive within `radius` (FP) of `e`, `e` first. */
function around(b: Battle, e: Enemy, radius: number): Enemy[] {
  const out = [e];
  for (const o of b.enemies) if (o !== e && o.hp > 0 && within(o, e.x, e.y, radius)) out.push(o);
  return out;
}

function setOff(b: Battle, e: Enemy, id: ReactionId, on: Element, by: HeroKind, damage: number): void {
  const C = R();
  // the mastery stars and the legend recipe's boost: harder, longer and (the recipe) further
  const { power, reach } = reactionPower(b, id);
  const P = (x: number) => pm(x * power);
  const T = (x: number) => ticks(x * power);
  const reachOf = (x: number) => Math.round(x * reach);
  let radius = 0;
  // what the poison left would still have done, before it is used up
  const poisonLeft = Math.trunc((e.poisonDps * e.poisonTime) / TICK_RATE);
  const poisonDps = Math.max(e.poisonDps, b.fixed.poison[0]);
  useUp(e, on);
  switch (id) {
    case 'steam': {
      radius = reachOf(C.steam.radius);
      const hit = times(damage, P(C.steam.damage));
      for (const o of around(b, e, toFp(radius))) {
        harm(b, o, o === e ? hit : times(hit, splash(o)), by);
        slow(o, C.steam.slow, T(C.steam.slowTime));
      }
      break;
    }
    case 'superconduct':
    case 'overload': {
      const c = C[id];
      radius = reachOf(c.radius);
      const hit = times(damage, P(c.damage));
      for (const o of around(b, e, toFp(radius))) harm(b, o, o === e ? hit : times(hit, splash(o)), by);
      break;
    }
    case 'electrolysis': {
      radius = reachOf(C.electrolysis.radius);
      const dps = times(poisonDps, P(1));
      for (const o of around(b, e, toFp(radius))) corrode(b, o, o === e ? 0 : dps, C.electrolysis.rust);
      break;
    }
    case 'combustion': {
      radius = reachOf(C.combustion.radius);
      const hit = times(Math.max(poisonLeft, damage), P(C.combustion.damage));
      for (const o of around(b, e, toFp(radius))) harm(b, o, o === e ? hit : times(hit, splash(o)), by);
      break;
    }
    case 'firestorm': {
      radius = reachOf(C.firestorm.radius);
      const heat = times(Math.max(e.scorch, damage), P(C.firestorm.burn));
      for (const o of around(b, e, toFp(radius))) {
        if (heat >= o.burnDps) {
          o.burnDps = heat;
          o.burnBy = by;
        }
        o.burnTime = ticks(BALANCE.skills.burnTime);
      }
      break;
    }
    case 'blizzard': {
      radius = reachOf(C.blizzard.radius);
      for (const o of around(b, e, toFp(radius))) slow(o, C.blizzard.slow, T(C.blizzard.slowTime));
      break;
    }
    case 'resonance':
      harm(b, e, times(damage, P(C.resonance.damage)), by);
      break;
  }
  b.reactions[id]++;
  b.events.push({ type: 'reaction', id, x: e.x / FP, y: e.y / FP, radius });
}

/** The enemy tick's part: the elements and the reaction cooldown wearing off. */
export function wearReactions(e: Enemy): void {
  if (e.frostTime) e.frostTime--;
  if (e.shockTime) e.shockTime--;
  if (e.reactTime) e.reactTime--;
}
