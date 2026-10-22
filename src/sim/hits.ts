// What each potion's shot does where it lands: the fire blast, the lightning chain and sky strike,
// the wind's knockback, gust and whirlwinds, the ice's slow and freeze, the poison's acid, and
// the arcane bolt's mark, burst and split.

import type { Battle } from './battle';
import { corrode, discharge, freeze, harm, scorch, shock, slow, splash } from './damage';
import { K } from './field';
import { dist, FP, muldiv, pm, ticks, times, toFp } from './math/fixed';
import { nearest, within } from './targets';
import { BALANCE, isBoss, type Enemy, type Projectile, type Vortex } from './types';

const B = BALANCE;

export function impact(b: Battle, p: Projectile, target: Enemy | null): void {
  const h = B.heroes;
  const S = B.skills;
  const by = p.kind;
  switch (p.kind) {
    case 'fire': {
      const radius = b.fixed.fireRadius;
      for (const e of b.enemies) {
        if (!within(e, p.tx, p.ty, radius)) continue;
        scorch(b, e, e.id === p.targetId ? p.damage : times(p.damage, splash(e)), by);
        discharge(b, e);
      }
      b.events.push({ type: 'hit', kind: 'fire', x: p.tx / FP, y: p.ty / FP, radius: radius / FP });
      return;
    }
    case 'lightning': {
      if (!target) {
        b.wasted.lightning += p.damage;
        return;
      }
      const points = [{ x: p.x / FP, y: p.y / FP }];
      const hit = new Set<number>();
      let cur: Enemy | undefined = target;
      let damage = p.damage;
      for (let i = 0; cur && i <= h.lightning.chains + b.mods.extraChains; i++) {
        shock(b, cur, damage);
        hit.add(cur.id);
        points.push({ x: cur.x / FP, y: cur.y / FP });
        damage = times(damage, pm(h.lightning.chainFalloff));
        cur = nearest(b, cur, toFp(h.lightning.chainRange), hit);
      }
      b.events.push({ type: 'chain', points });
      if (p.strike) {
        // the sky strike: a bolt from above onto the first target, hitting all around it
        const radius = toFp(S.thunderRadius);
        for (const e of b.enemies) {
          if (e.hp > 0 && within(e, target.x, target.y, radius)) shock(b, e, times(p.damage, pm(S.thunderstrike)));
        }
        const x = target.x / FP;
        const y = target.y / FP;
        b.events.push({ type: 'chain', points: [{ x: x + 40, y: y - 700 }, { x: x - 20, y: y - 350 }, { x, y }] });
        b.events.push({ type: 'hit', kind: 'lightning', x, y, radius: S.thunderRadius });
      }
      return;
    }
    case 'wind': {
      if (!p.gust) break;
      // the gust: a wall of wind across the whole field, as deep as the target's front and back
      const depth = toFp(S.gustDepth);
      for (const e of b.enemies) {
        if (e.hp <= 0 || Math.abs(e.y - p.ty) > depth + e.radius) continue;
        harm(b, e, times(p.damage, pm(S.gust)), by);
        discharge(b, e);
        windHit(b, e, p, e.id === p.targetId);
      }
      b.events.push({ type: 'gust', x: p.tx / FP, y: p.ty / FP, depth: S.gustDepth });
      return;
    }
  }
  if (!target) {
    b.wasted[by] += p.damage;
    return;
  }
  harm(b, target, p.damage, by);
  discharge(b, target);
  if (p.kind === 'arcane') arcaneHit(b, p, target);
  if (p.kind === 'ice') {
    slow(target, h.ice.slow, ticks(h.ice.slowTime));
    if (b.shotRng.chance(b.fixed.freezeChance, 1000)) freeze(b, target, S.iceFreezeTime, p.damage);
    if (b.mods.frostbite && target.freezeTime <= 0) {
      // no stacking while it is frozen anyway
      target.chillTime = ticks(S.frostbiteTime);
      if (++target.chill >= S.frostbiteStacks) {
        target.chill = 0;
        freeze(b, target, S.frostbiteFreeze, p.damage);
      }
    }
  } else if (p.kind === 'poison') {
    const dps = b.fixed.poison[p.star - 1];
    corrode(b, target, dps);
    if (b.mods.acidSplash) {
      // the acid splashes: poison and rust on everything close to the target
      const radius = toFp(S.acidRadius);
      for (const e of b.enemies) {
        if (e !== target && e.hp > 0 && within(e, target.x, target.y, radius)) corrode(b, e, times(dps, splash(e)));
      }
      b.events.push({ type: 'hit', kind: 'poison', x: target.x / FP, y: target.y / FP, radius: S.acidRadius });
    }
  }
  if (p.kind === 'wind') windHit(b, target, p, true);
  b.events.push({ type: 'hit', kind: p.kind, x: target.x / FP, y: target.y / FP, radius: 30 });
}

/** What a wind shot (or its gust) does to `e` after the damage: the knockback, and the wind
 *  line's skills. `direct` is the one it was aimed at. */
export function windHit(b: Battle, e: Enemy, p: Projectile, direct: boolean): void {
  const S = B.skills;
  push(b, e, p.star);
  if (b.mods.vortex && direct && e.hp <= 0 && b.shares.proc('vortex', e.heft)) b.vortices.push({ x: e.x, y: e.y, time: ticks(S.vortexTime) });
  if (b.mods.windFire && (e.burnTime > 0 || e.scorchTime > 0)) {
    // the wind-and-fire recipe: the wind fans the flames on what it hits and blows them onto
    // everything close by
    const heat = Math.max(e.burnDps, times(e.scorch, pm(S.windFire)));
    const radius = toFp(S.windFireRadius);
    for (const o of b.enemies) {
      if (o.hp <= 0 || !within(o, e.x, e.y, radius)) continue;
      if (heat >= o.burnDps) {
        o.burnDps = heat;
        o.burnBy = 'wind';
      }
      o.burnTime = ticks(S.burnTime);
    }
    b.events.push({ type: 'hit', kind: 'fire', x: e.x / FP, y: e.y / FP, radius: S.windFireRadius });
  }
}

/** Knocks `e` back up the field, off the wall if it was at it: lighter ones further, the boiler
 *  golem half as far (all the way with the perk, or frozen stiff), the boss not at all (the
 *  wind only slows it). Each one at most once every `pushTime`. A winder blown back also has
 *  its key spun the wrong way: its rewind starts over. */
export function push(b: Battle, e: Enemy, star: number): void {
  const W = B.heroes.wind;
  if (isBoss(e.kind)) {
    slow(e, W.bossSlow, ticks(W.bossSlowTime));
    return;
  }
  if (e.pushTime > 0 || e.hp <= 0) return;
  let weight = W.weight[e.kind];
  if (e.kind === 'brute' && (b.mods.pushHeavy || e.freezeTime > 0)) weight = W.weight.grunt;
  const d = times(times(times(toFp(W.push), pm(W.pushStar[star - 1])), b.fixed.push), pm(weight));
  // one of a rush still behind the top edge is not pushed forward onto it
  const top = Math.min(e.y, K.top - e.radius);
  if (d <= 0) return;
  e.pushTime = ticks(W.pushTime);
  b.events.push({ type: 'push', x: e.x / FP, y: e.y / FP, id: e.id });
  e.y = Math.max(top, e.y - d);
  e.atWall = false;
  if (e.kind === 'winder') e.windTime = ticks(B.winder.every);
}

/** A whirlwind draws `e` towards its eye while it is within reach. */
export function pull(e: Enemy, v: Vortex): void {
  const dx = v.x - e.x;
  const dy = v.y - e.y;
  const d = dist(dx, dy);
  if (d < FP || d > toFp(B.skills.vortexRadius) + e.radius) return;
  const step = Math.min(d, K.vortexPull);
  if (e.kind === 'flyer') e.x0! += muldiv(dx, step, d);
  else e.x += muldiv(dx, step, d);
  e.y += muldiv(dy, step, d);
}

/** What the arcane line adds to a hero's bolt that has just hit. */
export function arcaneHit(b: Battle, p: Projectile, target: Enemy): void {
  const S = B.skills;
  if (b.fixed.mark > 0) target.markTime = ticks(S.markTime);
  if (b.mods.frostBolts) {
    // frost bolts chill, and leave it brittle for a moment as a freeze does
    slow(target, S.frostBoltSlow, ticks(S.frostBoltTime));
    target.brittleTime = Math.max(target.brittleTime, ticks(S.frostBoltBrittle));
  }
  if (b.mods.burstBolts) {
    // the fire-and-arcane recipe: the bolt bursts and singes what stands around its target
    const radius = toFp(S.burstBoltRadius);
    for (const e of b.enemies) {
      if (e === target || e.hp <= 0 || !within(e, target.x, target.y, radius)) continue;
      scorch(b, e, times(times(p.damage, pm(S.burstBolt)), splash(e)), 'arcane');
      discharge(b, e);
    }
    b.events.push({ type: 'hit', kind: 'fire', x: target.x / FP, y: target.y / FP, radius: S.burstBoltRadius });
  }
  if (b.mods.splitBolts && !p.split && target.hp <= 0 && b.shares.proc('split', target.heft)) {
    // the bolt that killed splits towards the nearest enemies left
    const skip = new Set([target.id]);
    for (let i = 0; i < S.splitBolts; i++) {
      const next = nearest(b, target, toFp(S.splitRange), skip);
      if (!next) break;
      skip.add(next.id);
      const { x, y } = target;
      b.projectiles.push({ id: b.nextId++, kind: 'arcane', star: p.star, x, y, px: x, py: y, targetId: next.id, tx: next.x, ty: next.y, damage: times(p.damage, pm(S.splitBolt)), split: true });
    }
  }
}
