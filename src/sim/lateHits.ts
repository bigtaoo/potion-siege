// What the three later potions' shots do where they land (hits.ts hands them over):
//  light   a beam: its target takes the hit, and everything on the line on behind it a share
//  metal   a heavy slug, with shrapnel, the knock-down, the brittle break and the forge
//  vine    a root: the target held fast a moment (a boss only slowed), then tangled, so the
//          next root goes elsewhere; thorns, the spread on a kill and the poison recipe

import type { Battle } from './battle';
import { corrode, discharge, freeze, harm, scorch, slow, splash } from './damage';
import { dist, FP, muldiv, pm, ticks, times, toFp } from './math/fixed';
import { react } from './reactions';
import { nearest, within } from './targets';
import { BALANCE, isBoss, type Enemy, type Projectile } from './types';

const B = BALANCE;

export function lateHit(b: Battle, p: Projectile, target: Enemy): void {
  if (p.kind === 'light') beam(b, p, target);
  else if (p.kind === 'metal') slug(b, p, target);
  else vine(b, p, target);
}

/** The enemies a beam from `from` crosses past `target`, out to `reach` (FP) and `width` (FP)
 *  either side of its line; the target not among them. */
export function onBeam(b: Battle, target: Enemy, fromX: number, fromY: number, reach: number, width: number): Enemy[] {
  let dx = target.x - fromX;
  let dy = target.y - fromY;
  let d = dist(dx, dy);
  if (d < FP) {
    // straight up the field, the way the potions throw
    dx = 0;
    dy = -FP;
    d = FP;
  }
  const out: Enemy[] = [];
  for (const o of b.enemies) {
    if (o === target || o.hp <= 0) continue;
    const ox = o.x - target.x;
    const oy = o.y - target.y;
    const along = muldiv(ox, dx, d) + muldiv(oy, dy, d);
    if (along < -o.radius || along > reach + o.radius) continue;
    const across = Math.abs(muldiv(ox, dy, d) - muldiv(oy, dx, d));
    if (across <= width + o.radius) out.push(o);
  }
  return out;
}

function beam(b: Battle, p: Projectile, target: Enemy): void {
  const L = B.heroes.light;
  const S = B.skills;
  const m = b.mods;
  const reach = toFp(L.beamReach);
  const others = onBeam(b, target, p.px, p.py, reach, toFp(L.beamWidth * m.beamWidth));
  const share = m.focus ? 1000 : pm(L.pierce);
  for (const e of [target, ...others]) {
    const dealt = e === target ? p.damage : times(p.damage, share);
    if (m.sunfire) scorch(b, e, dealt, 'light');
    else harm(b, e, dealt, 'light');
    discharge(b, e);
    if (m.glareSlow > 0) slow(e, m.glareSlow, ticks(S.lightGlareTime));
    react(b, e, 'light', dealt);
  }
  // the line the view draws: from the target on, as far as the beam reaches
  let dx = target.x - p.px;
  let dy = target.y - p.py;
  let d = dist(dx, dy);
  if (d < FP) [dx, dy, d] = [0, -FP, FP];
  b.events.push({ type: 'beam', x1: target.x / FP, y1: target.y / FP, x2: (target.x + muldiv(dx, reach, d)) / FP, y2: (target.y + muldiv(dy, reach, d)) / FP });
}

function slug(b: Battle, p: Projectile, target: Enemy): void {
  const S = B.skills;
  const m = b.mods;
  // the forge: a burning one takes the slug harder
  const hot = m.forge && (target.burnTime > 0 || target.scorchTime > 0);
  const dealt = hot ? times(p.damage, pm(1 + S.metalFire)) : p.damage;
  harm(b, target, dealt, 'metal');
  discharge(b, target);
  if (m.crush > 0 && target.hp > 0 && b.shotRng.chance(m.crush, 1000)) freeze(b, target, S.metalCrushTime * m.crushTime, dealt);
  if (m.armorBreak) target.brittleTime = Math.max(target.brittleTime, ticks(S.metalBreakTime));
  react(b, target, 'metal', dealt);
  if (m.shrapnel > 0) {
    const radius = toFp(S.metalShrapnelRadius);
    const bit = times(dealt, pm(m.shrapnel));
    for (const e of b.enemies) {
      if (e === target || e.hp <= 0 || !within(e, target.x, target.y, radius)) continue;
      harm(b, e, times(bit, splash(e)), 'metal');
      discharge(b, e);
    }
    b.events.push({ type: 'hit', kind: 'metal', x: target.x / FP, y: target.y / FP, radius: S.metalShrapnelRadius });
  }
  b.events.push({ type: 'hit', kind: 'metal', x: target.x / FP, y: target.y / FP, radius: 36 });
}

/** Holds `e` for `time` ticks (a boss only slowed) and tangles it; false when it is tangled
 *  already. */
export function root(e: Enemy, time: number): boolean {
  if ((e.tangleTime ?? 0) > 0 || e.hp <= 0) return false;
  const V = B.heroes.vine;
  slow(e, isBoss(e.kind) ? V.bossSlow : 1, time);
  e.tangleTime = ticks(V.tangleTime);
  return true;
}

function vine(b: Battle, p: Projectile, target: Enemy): void {
  const S = B.skills;
  const m = b.mods;
  const hold = ticks(B.heroes.vine.rootTime * m.rootTime);
  harm(b, target, p.damage, 'vine');
  discharge(b, target);
  if (m.vinePoison) corrode(b, target, b.fixed.poison[p.star - 1]);
  if (root(target, hold) && m.thorns > 0) {
    // thorns: the held one bleeds while the root lasts
    const dps = times(p.damage, pm(m.thorns));
    if (dps >= target.burnDps) {
      target.burnDps = dps;
      target.burnBy = 'vine';
    }
    target.burnTime = Math.max(target.burnTime, hold);
  }
  react(b, target, 'vine', p.damage);
  if (m.vineSpread && target.hp <= 0) {
    // the tendril runs on from the fallen to the nearest one still standing
    const next = nearest(b, target, toFp(S.vineSpreadRange), new Set([target.id]));
    if (next && root(next, hold)) b.events.push({ type: 'hit', kind: 'vine', x: next.x / FP, y: next.y / FP, radius: 30 });
  }
  b.events.push({ type: 'hit', kind: 'vine', x: target.x / FP, y: target.y / FP, radius: 30 });
}
