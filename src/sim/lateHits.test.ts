// Where the three later potions' shots land (lateHits.ts): the light's beam, the quicksilver's
// slug and the vine's root, each with the skills that change it.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Battle } from './battle';
import { RESIST } from './enemies';
import { lateHit, onBeam, root } from './lateHits';
import { FP, ticks, toFp } from './math/fixed';
import { enemy, still } from './stillField';
import { BALANCE, type Enemy, type HeroKind, type Projectile } from './types';

const H = BALANCE.heroes;
const S = BALANCE.skills;

const gruntResist = RESIST.grunt;
beforeAll(() => {
  RESIST.grunt = {};
});
afterAll(() => {
  RESIST.grunt = gruntResist;
});

const lost = (e: Enemy) => (e.maxHp - e.hp) / FP;

/** A shot of `kind` thrown from (fromX, fromY) that lands on `target` for `damage`. */
function land(b: Battle, kind: HeroKind, target: Enemy, damage: number, fromX = target.x / FP, fromY = target.y / FP + 400): void {
  const p: Projectile = {
    id: 1, kind, star: 1, x: target.x, y: target.y, px: toFp(fromX), py: toFp(fromY), targetId: target.id, tx: target.x, ty: target.y, damage: toFp(damage),
  };
  lateHit(b, p, target);
}

describe('the light\'s beam', () => {
  it('finds the ones on the line on behind the target, not those beside or before it', () => {
    const b = still();
    const t = enemy(b, 500, 800);
    const behind = enemy(b, 500, 500);
    const beside = enemy(b, 700, 600);
    const before = enemy(b, 500, 950);
    const beyond = enemy(b, 500, 800 - H.light.beamReach - 100);
    const on = onBeam(b, t, toFp(500), toFp(1200), toFp(H.light.beamReach), toFp(H.light.beamWidth));
    expect(on).toEqual([behind]);
    expect(on).not.toContain(beside);
    expect(on).not.toContain(before);
    expect(on).not.toContain(beyond);
  });

  it('runs straight up the field when thrown from where the target stands', () => {
    const b = still();
    const t = enemy(b, 500, 800);
    const up = enemy(b, 500, 600);
    enemy(b, 500, 1000);
    expect(onBeam(b, t, t.x, t.y, toFp(400), toFp(36))).toEqual([up]);
  });

  it('hits the target in full and those behind for the pierce share, and is drawn', () => {
    const b = still();
    const t = enemy(b, 500, 800);
    const behind = enemy(b, 500, 600);
    land(b, 'light', t, 100);
    expect(lost(t)).toBeCloseTo(100, 0);
    expect(lost(behind)).toBeCloseTo(100 * H.light.pierce, 0);
    const ev = b.events.find((e) => e.type === 'beam');
    expect(ev).toMatchObject({ x1: 500, y1: 800, x2: 500, y2: 800 - H.light.beamReach });
    expect(t.glareTime).toBeGreaterThan(0);
  });

  it('hits all on the line in full with focus, and scorches with sunfire', () => {
    const b = still();
    b.mods.focus = true;
    b.mods.sunfire = true;
    const t = enemy(b, 500, 800);
    const behind = enemy(b, 500, 600);
    land(b, 'light', t, 100);
    expect(lost(behind)).toBeCloseTo(100, 0);
    expect(lost(t)).toBeCloseTo(100, 0);
    expect(t.scorchTime).toBeGreaterThan(0);
    expect(behind.scorchTime).toBeGreaterThan(0);
    // its own scorch is no fire for the light: neither this beam nor the next sets off a flare
    land(b, 'light', t, 100);
    expect(b.reactions.flare).toBe(0);
  });

  it('slows what it crosses with glare, and reaches wider with the wide beam', () => {
    const b = still();
    b.mods.glareSlow = 0.2;
    b.mods.beamWidth = 3;
    const t = enemy(b, 500, 800);
    const offLine = enemy(b, 500 + H.light.beamWidth + 50, 600);
    land(b, 'light', t, 100);
    expect(lost(offLine)).toBeGreaterThan(0);
    expect(offLine.slowFactor).toBe(800);
    expect(t.slowFactor).toBe(800);
  });
});

describe('the quicksilver\'s slug', () => {
  it('hits only its target unless it has shrapnel', () => {
    const b = still();
    const t = enemy(b, 500, 800);
    const near = enemy(b, 540, 800);
    land(b, 'metal', t, 100);
    expect(lost(t)).toBeCloseTo(100, 0);
    expect(lost(near)).toBe(0);
    expect(t.magnetTime).toBeGreaterThan(0);
  });

  it('throws shrapnel at those close round it, not further', () => {
    const b = still();
    b.mods.shrapnel = 0.3;
    const t = enemy(b, 500, 800);
    const near = enemy(b, 540, 800);
    const far = enemy(b, 500 + S.metalShrapnelRadius + 80, 800);
    land(b, 'metal', t, 100);
    expect(lost(near)).toBeGreaterThan(0);
    expect(lost(near)).toBeLessThanOrEqual(30.01);
    expect(lost(far)).toBe(0);
    expect(b.events.some((e) => e.type === 'hit' && e.kind === 'metal' && e.radius === S.metalShrapnelRadius)).toBe(true);
  });

  it('hits a burning one harder with the forge, a cold one not', () => {
    const b = still();
    b.mods.forge = true;
    const hot = enemy(b, 300, 800);
    const cold = enemy(b, 700, 800);
    hot.burnTime = 30;
    land(b, 'metal', hot, 100);
    land(b, 'metal', cold, 100);
    expect(lost(hot)).toBeCloseTo(100 * (1 + S.metalFire), 0);
    expect(lost(cold)).toBeCloseTo(100, 0);
  });

  it('leaves the target brittle with the armor break', () => {
    const b = still();
    b.mods.armorBreak = true;
    const t = enemy(b, 500, 800);
    land(b, 'metal', t, 10);
    expect(t.brittleTime).toBe(ticks(S.metalBreakTime));
  });

  it('knocks down (freezes) every time at the full crush chance', () => {
    const b = still();
    b.mods.crush = 1000;
    const t = enemy(b, 500, 800);
    land(b, 'metal', t, 10);
    expect(t.freezeTime).toBeGreaterThan(0);
  });
});

describe('the vine\'s root', () => {
  it('holds a grunt fast and only slows a boss, then tangles both', () => {
    const b = still();
    const g = enemy(b, 300, 800);
    const boss = enemy(b, 700, 800);
    boss.kind = 'boss';
    expect(root(g, 20)).toBe(true);
    expect(root(boss, 20)).toBe(true);
    expect(g.slowFactor).toBe(0);
    expect(boss.slowFactor).toBe(1000 - H.vine.bossSlow * 1000);
    expect(g.tangleTime).toBe(ticks(H.vine.tangleTime));
  });

  it('does not root a tangled one again, nor a dead one', () => {
    const b = still();
    const g = enemy(b, 300, 800);
    g.tangleTime = 5;
    expect(root(g, 20)).toBe(false);
    const dead = enemy(b, 600, 800);
    dead.hp = 0;
    expect(root(dead, 20)).toBe(false);
  });

  it('lands: damage, a hold for its root time, and the tangle', () => {
    const b = still();
    const t = enemy(b, 500, 800);
    land(b, 'vine', t, 10);
    expect(lost(t)).toBeCloseTo(10, 0);
    expect(t.slowFactor).toBe(0);
    expect(t.slowTime).toBe(ticks(H.vine.rootTime));
    expect(t.tangleTime).toBeGreaterThan(0);
  });

  it('bleeds the held one with thorns, but only when it took root', () => {
    const b = still();
    b.mods.thorns = 0.4;
    const t = enemy(b, 300, 800);
    land(b, 'vine', t, 10);
    expect(t.burnDps / FP).toBeCloseTo(4, 1);
    expect(t.burnBy).toBe('vine');
    expect(t.burnTime).toBe(ticks(H.vine.rootTime));
    const tangled = enemy(b, 700, 800);
    tangled.tangleTime = 10;
    land(b, 'vine', tangled, 10);
    expect(tangled.burnTime).toBe(0);
  });

  it('runs on from a fallen one to the nearest standing with the spread', () => {
    const b = still();
    b.mods.vineSpread = true;
    const t = enemy(b, 500, 800, 5);
    const next = enemy(b, 600, 800);
    const far = enemy(b, 500 + S.vineSpreadRange + 100, 800);
    land(b, 'vine', t, 10);
    expect(t.hp).toBeLessThanOrEqual(0);
    expect(next.tangleTime).toBeGreaterThan(0);
    expect(far.tangleTime ?? 0).toBe(0);
  });

  it('poisons as well with the poison recipe', () => {
    const b = still();
    b.mods.vinePoison = true;
    const t = enemy(b, 500, 800);
    land(b, 'vine', t, 10);
    expect(t.poisonTime).toBeGreaterThan(0);
  });
});
