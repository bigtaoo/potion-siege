// The commander's spells: casting the next one where the player dragged it (or at the thickest
// crowd for a plain tap, the self-cast and the bot), its self-cast once charged too long, and
// how hard each one is, sized by the board's damage. What a landed flask does is in spells.ts.

import type { Battle } from './battle';
import { K } from './field';
import { FP, muldiv, TICK_RATE, ticks, times } from './math/fixed';
import { within } from './targets';
import { BALANCE, type CastHow, type CommanderSkill, type Enemy } from './types';

const B = BALANCE;
const C = B.commander;

/** The spells in the order they are cast, the bomb first. */
export const SPELLS: readonly CommanderSkill[] = ['bomb', 'frost', 'acid'];

/** Casts the next spell at `at` (FP, kept on the road), or with no point at the thickest crowd,
 *  where nothing on the field to throw at keeps the charge waiting. */
export function doCast(b: Battle, at?: { x: number; y: number }, auto = false): boolean {
  if (!b.canCast()) return false;
  const skill = b.nextCast;
  const spot = at ? onRoad(b, at) : aimAt(b, skill);
  if (!spot) return false;
  const how: CastHow = auto ? 'auto' : at ? 'drag' : 'tap';
  const flight = ticks(C.flight);
  b.flasks.push({ skill, how, x: spot.x, y: spot.y, time: flight, power: power(b, skill) });
  b.events.push({ type: 'cast', skill, how, x: spot.x / FP, y: spot.y / FP, flight: C.flight });
  b.charge = 0;
  b.chargedFor = 0;
  b.casts++;
  return true;
}

/** `at` rounded to whole FP and kept between the field's sides, its top and the wall. */
function onRoad(b: Battle, at: { x: number; y: number }): { x: number; y: number } {
  const x = Math.min(K.right, Math.max(K.left, Math.round(at.x)));
  return { x, y: Math.min(b.wallFront(x), Math.max(K.top, Math.round(at.y))) };
}

/** Where a cast with no point goes: on the thickest crowd, where its mark will be once the
 *  flask comes down, and on a mark still coming in at the top a little below it (still well
 *  within reach), so the burst is seen down the road rather than under the HUD. */
export function aimAt(b: Battle, skill: CommanderSkill): { x: number; y: number } | null {
  const target = thickest(b);
  if (!target) return null;
  const step = target.freezeTime > 0 ? 0 : target.slowTime > 0 ? times(target.speed, target.slowFactor) : target.speed;
  const lead = Math.min(b.wallFront(target.x) - target.radius, target.y + step * ticks(C.flight));
  return { x: target.x, y: Math.max(target.y, lead, Math.min(target.y + muldiv(K.spellRadius[skill], 3, 4), K.bombFloor)) };
}

/** The bomb's damage, or the acid's damage a second, from what the board deals now; the frost
 *  has none. */
function power(b: Battle, skill: CommanderSkill): number {
  if (skill === 'bomb') return Math.max(K.bombMin, muldiv(boardDps(b), Math.round(C.bomb.seconds * 1000), 1000));
  if (skill === 'acid') return muldiv(boardDps(b), Math.round(C.acid.share * 1000), 1000);
  return 0;
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

/** A charge left full too long is cast by the commander itself, at the thickest crowd. */
export function stepCommander(b: Battle): void {
  if (b.charge < C.charge) return;
  if (++b.chargedFor >= ticks(C.autoCast)) doCast(b, undefined, true);
}
