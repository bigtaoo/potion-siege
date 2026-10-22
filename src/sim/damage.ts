// Damage and the statuses it leaves: every hit through harm (resistance, the mark, rust, the
// tripod's jar, the credit to the potion), and the shock, corrosion, slow, freeze and scorch.

import type { Battle } from './battle';
import { crack } from './bosses';
import { resistOf } from './enemies';
import { FP, pm, ticks, times } from './math/fixed';
import { BALANCE, isBoss, type Enemy, type HeroKind } from './types';

const B = BALANCE;

/** What a blast aimed at something else does to `e`, in permille: a flyer is up in the air,
 *  above most of it. */
export function splash(e: Enemy): number {
  return e.kind === 'flyer' ? pm(B.flyer.splash) : 1000;
}

/** Every bit of damage goes through here, for the enemy's resistance to the potion it came
 *  from (`by`; the commander's flask has none), the arcane mark, the corrosion's rust and the
 *  brittleness a freeze leaves (all multiply), and for crediting that potion with what the
 *  enemy had left of it. */
export function harm(b: Battle, e: Enemy, damage: number, by: HeroKind | undefined): void {
  if (e.guardTime) return;
  if (e.shield) {
    // the tripod's bell jar takes it all: frost cracks the glass, the rest barely marks it
    const T = B.bosses.tripod;
    let into = times(damage, pm(by === 'ice' ? T.ice : T.other));
    if (e.markTime > 0) into = times(into, 1000 + b.fixed.mark);
    if (by) b.dealt[by] += Math.max(0, Math.min(e.shield, into));
    e.shield -= into;
    if (e.shield <= 0) {
      e.shield = 0;
      e.shieldTime = ticks(T.regrow);
      b.events.push({ type: 'jar', x: e.x / FP, y: e.y / FP, up: false });
    }
    return;
  }
  let dealt = by ? times(damage, pm(resistOf(e, by))) : damage;
  if (e.markTime > 0) dealt = times(dealt, 1000 + b.fixed.mark);
  dealt = times(dealt, 1000 + b.fixed.rustStep * e.rust);
  if (e.brittleTime > 0) dealt = times(dealt, 1000 + pm(B.skills.brittle));
  if (by) b.dealt[by] += Math.max(0, Math.min(e.hp, dealt));
  e.hp -= dealt;
  if (e.kind === 'gear' && !e.core && e.hp <= times(e.maxHp, pm(B.bosses.gear.at))) crack(b, e);
}

/** A hit by another potion sets off the static a lightning hit left. */
export function discharge(b: Battle, e: Enemy): void {
  if (e.charge <= 0) return;
  const charge = e.charge;
  e.charge = 0;
  e.chargeTime = 0;
  harm(b, e, charge, 'lightning');
}

/** Lightning damage: harder on chilled enemies with the ice recipe, leaving static, and with
 *  the fire recipe it counts as a fire hit that sets them alight. */
export function shock(b: Battle, e: Enemy, damage: number): void {
  const S = B.skills;
  if (b.mods.superconduct && (e.slowTime > 0 || e.freezeTime > 0)) damage = times(damage, 1000 + pm(S.superconduct));
  if (b.mods.plasma) scorch(b, e, damage, 'lightning', b.fixed.plasmaBurn);
  else harm(b, e, damage, 'lightning');
  if (b.mods.electrolysis) corrode(b, e);
  if (b.fixed.static > 0) {
    e.charge = Math.max(e.chargeTime > 0 ? e.charge : 0, times(damage, b.fixed.static));
    e.chargeTime = ticks(S.staticTime);
  }
}

/** Rusts by `stacks` and, with `dps` (FP a second), poisons: what a corrosion hit does. */
export function corrode(b: Battle, e: Enemy, dps = 0, stacks = 1): void {
  const P = B.heroes.poison;
  if (dps > 0) {
    e.poisonDps = Math.max(e.poisonDps, dps);
    e.poisonTime = ticks(P.poisonTime);
  }
  e.rust = Math.min(b.mods.rustMax, e.rust + stacks);
  e.rustTime = ticks(P.rustTime);
}

/** Slows by `amount` (a fraction) for `time` ticks. A weaker slow leaves a stronger one still
 *  running alone (it must not stretch it); a stronger one replaces it with its own time; the
 *  same one refreshes it. */
export function slow(e: Enemy, amount: number, time: number): void {
  const factor = 1000 - pm(amount);
  if (e.slowTime > 0) {
    if (factor > e.slowFactor) return;
    if (factor === e.slowFactor) {
      e.slowTime = Math.max(e.slowTime, time);
      return;
    }
  }
  e.slowFactor = factor;
  e.slowTime = time;
}

/** Freezes for `seconds`, for `hit`, the damage of the ice hit that froze it, and leaves it
 *  brittle as long. A boss is too big to freeze: the frost slows it hard instead and, with
 *  shatter, chips shards off it. A flyer cannot freeze either, its wings keep beating: it only
 *  slows. */
export function freeze(b: Battle, e: Enemy, seconds: number, hit: number): void {
  const S = B.skills;
  const time = times(ticks(seconds), b.fixed.freezeTime);
  if (!isBoss(e.kind) && e.kind !== 'flyer') {
    e.freezeTime = Math.max(e.freezeTime, time);
    e.brittleTime = Math.max(e.brittleTime, time);
    return;
  }
  slow(e, S.bossFreezeSlow, time);
  if (b.mods.shatter && isBoss(e.kind)) {
    harm(b, e, times(hit, pm(S.bossShatter)), 'ice');
    b.events.push({ type: 'hit', kind: 'ice', x: e.x / FP, y: e.y / FP, radius: e.radius / FP });
  }
  // brittle from here on: the shards that crack off it come before
  e.brittleTime = Math.max(e.brittleTime, time);
}

/** Fire damage: remembered for a while (a death soon after counts as burnt, for the chain
 *  explosion) and, with the burn skill (permille of the hit a second), it keeps burning. */
export function scorch(b: Battle, e: Enemy, damage: number, by: HeroKind | undefined, burn = b.fixed.burn): void {
  harm(b, e, damage, by);
  if (damage >= (e.scorchTime > 0 ? e.scorch : 0)) {
    e.scorch = damage;
    e.scorchBy = by;
  }
  e.scorchTime = ticks(B.skills.burnTime);
  if (burn > 0) {
    const dps = times(damage, burn);
    if (dps >= e.burnDps) {
      e.burnDps = dps;
      e.burnBy = by;
    }
    e.burnTime = ticks(B.skills.burnTime);
  }
}
