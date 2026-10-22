// The potions firing: each one's cooldown (stunned, brewed), its target, the sky strike and gust
// counts, the crit roll, and the shots flying on to land.

import type { Battle } from './battle';
import { K, slotCenter } from './field';
import { impact } from './hits';
import { dist, muldiv, pm, times, toFp } from './math/fixed';
import { TargetPick } from './targetPick';
import { BALANCE, type Enemy, type Hero, type HeroKind, type Projectile } from './types';

const B = BALANCE;

export function stepHeroes(b: Battle): void {
  let pick: TargetPick | null = null;
  for (const h of b.slots) {
    if (!h) continue;
    if (h.stunTime) {
      h.stunTime--;
      continue;
    }
    const speed = h.kind === 'wind' ? b.fixed.windSpeed : b.fixed.speed;
    h.cooldown -= b.brewTime > 0 ? times(speed, K.brew) : speed;
    if (h.cooldown > 0) continue;
    pick ??= new TargetPick(b);
    const targets = pick.front;
    if (targets.length === 0) {
      // waiting: a small offset per hero, so the first enemy is not met by one big volley
      h.cooldown = (h.id % 5) * K.idleCooldown;
      continue;
    }
    h.cooldown += K.interval[h.kind][h.star - 1];
    if (h.kind !== 'arcane') {
      // each potion its own pick (targetPick.ts)
      fire(b, h, pick.pick(h.kind));
      continue;
    }
    // the arcane bolt goes for the front, the extra ones of its multishot for the enemies behind, weaker
    for (let i = 0; i <= b.mods.extraArrows && i < targets.length; i++) fire(b, h, targets[i], i === 0 ? 1000 : pm(B.skills.multiBolt));
  }
}

/** A hero's shot at `target`, `scale` permille of its damage. */
export function fire(b: Battle, h: Hero, target: Enemy, scale = 1000): void {
  const from = slotCenter(h.slot);
  b.events.push({ type: 'shot', slot: h.slot, projectile: b.nextId });
  let strike = false;
  let gust = false;
  if ((h.kind === 'lightning' && b.mods.thunder) || (h.kind === 'wind' && b.mods.gust)) {
    const n = (b.shotCount.get(h.id) ?? 0) + 1;
    b.shotCount.set(h.id, n);
    if (h.kind === 'lightning') strike = n % B.skills.thunderEvery === 0;
    else gust = n % B.skills.gustEvery === 0;
  }
  const base = times(b.fixed.damage[h.kind][h.star - 1], scale);
  shoot(b, h.kind, h.star, toFp(from.x), toFp(from.y - 40), target, base, strike ? { strike } : gust ? { gust } : {});
}

export function shoot(b: Battle, kind: HeroKind, star: number, x: number, y: number, target: Enemy, base: number, extra: Partial<Projectile> = {}): void {
  const crit = b.shotRng.chance(b.fixed.crit, 1000);
  b.projectiles.push({
    ...extra,
    id: b.nextId++,
    kind,
    star,
    x,
    y,
    px: x,
    py: y,
    targetId: target.id,
    tx: target.x,
    ty: target.y,
    damage: crit ? times(base, pm(B.critMultiplier)) : base,
  });
}

export function stepProjectiles(b: Battle): void {
  const reach = K.reach;
  const live: Projectile[] = [];
  for (const p of b.projectiles) {
    const t = b.enemies.find((e) => e.id === p.targetId && e.hp > 0);
    if (t) {
      p.tx = t.x;
      p.ty = t.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = dist(dx, dy);
    if (d <= reach) {
      impact(b, p, t ?? null);
    } else {
      p.x += muldiv(dx, reach, d);
      p.y += muldiv(dy, reach, d);
      live.push(p);
    }
  }
  b.projectiles = live;
}
