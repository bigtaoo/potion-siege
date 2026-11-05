// Potion reactions: when a potion's hit lands on an enemy still carrying another potion's
// element, the two react, on their own, with no skill needed. Fire's element is its scorch, the
// ice's the frost it leaves, lightning's the shock, poison's the poison itself; wind and arcane
// leave none and only set reactions off. The light leaves its glare, the quicksilver its
// magnet, the vine its tangle (only when it roots).
//
//   fire + ice        steam         a scalding cloud: damage and a slow all around
//   lightning + ice   superconduct  the frozen one shatters the bolt out: damage all around
//   fire + lightning  overload      a blast all around
//   lightning + poison electrolysis the poison runs down the current: poison and rust all around
//   fire + poison     combustion    the poison left goes up at once, on everything around
//   wind + fire       firestorm     the wind fans the flames onto everything around
//   wind + ice        blizzard      the frost blown about: a slow all around
//   light + ice       prism         the frost splits the light: beams at the nearest around
//   light + fire      flare         a burst of heat and glare: damage and a slow all around
//   metal + lightning magnetize     the current makes the quicksilver a magnet: all around drawn in
//   metal + fire      molten        the quicksilver boils on it: a heavy burn
//   vine + poison     spores        the vine blooms poison: poison on everything around
//   vine + ice        bramble       the frozen vine shoots thorns: all around held and hurt
//   arcane + any      resonance     the bolt rings with the element: extra damage on it
//
// An enemy reacts at most once every `cooldown`; the element a reaction used up is gone.

import type { Battle } from './battle';
import { corrode, harm, slow, splash } from './damage';
import { root } from './lateHits';
import { dist, FP, muldiv, pm, TICK_RATE, ticks, times, toFp } from './math/fixed';
import { reactionPower } from './reactionPower';
import { nearest, within } from './targets';
import { BALANCE, isBoss, type Enemy, type HeroKind, type ReactionId } from './types';

const R = () => BALANCE.reactions;

/** The potions that leave an element behind (wind and arcane only set reactions off). */
export const ELEMENTS = ['fire', 'ice', 'lightning', 'poison', 'light', 'metal', 'vine'] as const;
export type Element = (typeof ELEMENTS)[number];

export function isElement(kind: HeroKind): kind is Element {
  return (ELEMENTS as readonly HeroKind[]).includes(kind);
}

/** The elements `e` carries now. */
export function elementsOn(e: Enemy): Element[] {
  const out: Element[] = [];
  if (e.scorchTime > 0) out.push('fire');
  if ((e.frostTime ?? 0) > 0) out.push('ice');
  if ((e.shockTime ?? 0) > 0) out.push('lightning');
  if (e.poisonTime > 0) out.push('poison');
  if ((e.glareTime ?? 0) > 0) out.push('light');
  if ((e.magnetTime ?? 0) > 0) out.push('metal');
  if ((e.tangleTime ?? 0) > 0) out.push('vine');
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
    case 'ice+light':
      return 'prism';
    case 'fire+light':
      return 'flare';
    case 'lightning+metal':
      return 'magnetize';
    case 'fire+metal':
      return 'molten';
    case 'poison+vine':
      return 'spores';
    case 'ice+vine':
      return 'bramble';
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
  if (by === 'light') e.glareTime = ticks(R().glareTime);
  if (by === 'metal') e.magnetTime = ticks(R().magnetTime);
}

/** The element `on` is used up by the reaction. */
function useUp(e: Enemy, on: Element): void {
  if (on === 'ice') e.frostTime = 0;
  else if (on === 'lightning') e.shockTime = 0;
  else if (on === 'poison') {
    e.poisonTime = 0;
    e.poisonDps = 0;
  } else if (on === 'light') e.glareTime = 0;
  else if (on === 'metal') e.magnetTime = 0;
  else if (on === 'vine') e.tangleTime = 0;
  else e.scorchTime = 0;
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
    case 'steam':
    case 'flare': {
      const c = C[id];
      radius = reachOf(c.radius);
      const hit = times(damage, P(c.damage));
      for (const o of around(b, e, toFp(radius))) {
        harm(b, o, o === e ? hit : times(hit, splash(o)), by);
        slow(o, c.slow, T(c.slowTime));
      }
      break;
    }
    case 'prism': {
      // beams from the frozen light to the nearest ones around
      radius = reachOf(C.prism.range);
      const hit = times(damage, P(C.prism.damage));
      harm(b, e, hit, by);
      const skip = new Set([e.id]);
      for (let i = 0; i < C.prism.bolts; i++) {
        const o = nearest(b, e, toFp(radius), skip);
        if (!o) break;
        skip.add(o.id);
        harm(b, o, hit, by);
        b.events.push({ type: 'beam', x1: e.x / FP, y1: e.y / FP, x2: o.x / FP, y2: o.y / FP });
      }
      break;
    }
    case 'magnetize': {
      radius = reachOf(C.magnetize.radius);
      const hit = times(damage, P(C.magnetize.damage));
      const step = toFp(C.magnetize.pull);
      for (const o of around(b, e, toFp(radius))) {
        harm(b, o, o === e ? hit : times(hit, splash(o)), by);
        if (o !== e && !isBoss(o.kind)) drawTo(o, e, step);
      }
      break;
    }
    case 'molten': {
      const heat = times(Math.max(e.scorch, damage), P(C.molten.burn));
      if (heat >= e.burnDps) {
        e.burnDps = heat;
        e.burnBy = by;
      }
      e.burnTime = Math.max(e.burnTime, T(C.molten.time));
      break;
    }
    case 'spores': {
      radius = reachOf(C.spores.radius);
      const dps = times(poisonDps, P(1));
      for (const o of around(b, e, toFp(radius))) corrode(b, o, dps, 0);
      break;
    }
    case 'bramble': {
      radius = reachOf(C.bramble.radius);
      const hit = times(damage, P(C.bramble.damage));
      for (const o of around(b, e, toFp(radius))) {
        harm(b, o, o === e ? hit : times(hit, splash(o)), by);
        root(o, T(C.bramble.root));
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
  if (e.glareTime) e.glareTime--;
  if (e.magnetTime) e.magnetTime--;
  if (e.tangleTime) e.tangleTime--;
  if (e.shockTime) e.shockTime--;
  if (e.reactTime) e.reactTime--;
}

/** Moves `o` up to `step` (FP) towards `to`, not into it; a flyer's weave moves with it. */
function drawTo(o: Enemy, to: Enemy, step: number): void {
  const dx = to.x - o.x;
  const dy = to.y - o.y;
  const d = dist(dx, dy);
  const gap = d - o.radius - to.radius;
  if (gap <= 0) return;
  const move = Math.min(step, gap);
  if (o.kind === 'flyer') o.x0! += muldiv(dx, move, d);
  else o.x += muldiv(dx, move, d);
  o.y += muldiv(dy, move, d);
}
