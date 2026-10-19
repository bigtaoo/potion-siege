// The flyer and the winder in battle (enemyTick.ts, bosses.ts, damage.ts): each potion taken by
// its resistance, a flyer's weave and its frost and splash, a winder winding back the crowd.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { RESIST } from './enemies';
import { battleSetup, newMeta } from './meta';
import { FP, perTick, TICK_RATE, ticks, toFp } from './math/fixed';
import type { SkillId } from './skills';
import { BALANCE, type Enemy, type HeroKind, type Projectile } from './types';

// The skill lines' numbers are checked on a grunt that takes every potion in full; the
// resistances have tests of their own.
const gruntResist = RESIST.grunt;
beforeAll(() => {
  RESIST.grunt = {};
});
afterAll(() => {
  RESIST.grunt = gruntResist;
});

/** No enemies, so only the test's own shots land. */
function quiet(b: Battle): void {
  b.enemies = [];
}

/** An enemy at (x, y) with `hp` hit points, all in world units. */
function enemy(b: Battle, x: number, y: number, hp: number): Enemy {
  [x, y, hp] = [toFp(x), toFp(y), toFp(hp)];
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind: 'grunt', x, y, px: x, py: y, hp, maxHp: hp, speed: 0, radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
      markTime: 0, chill: 0, chillTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000, heft: 1000,
  };
  b.enemies.push(e);
  return e;
}

/** A shot of `kind` already on `target` (`damage` in world units), landing on the next tick. */
function shot(kind: HeroKind, target: Enemy, damage: number, extra: Partial<Projectile> = {}): Projectile {
  const { x, y } = target;
  return { id: 1, kind, star: 1, x, y, px: x, py: y, targetId: target.id, tx: x, ty: y, damage: toFp(damage), ...extra };
}

/** Fire one projectile of `kind` straight onto `target` and let it land. */
function hit(b: Battle, kind: HeroKind, target: Enemy, damage: number): void {
  b.projectiles.push(shot(kind, target, damage));
  b.step();
}

/** Hit points, position and the like back in world units. */
const u = (v: number) => v / FP;
/** Ticks in seconds. */
const sec = (t: number) => t / TICK_RATE;
/** Permille as a fraction. */
const frac = (v: number) => v / 1000;

/** A battle with these skills taken and the heroes at these levels (for their perks). */
function withSkills(skills: SkillId[], levels: Partial<Record<HeroKind, number>> = {}): Battle {
  const m = newMeta();
  Object.assign(m.heroes, levels);
  const b = new Battle(1, battleSetup(m));
  quiet(b);
  for (const id of skills) {
    b.choices = [id];
    b.choose(id);
  }
  return b;
}

describe('the new kinds in battle', () => {
  /** Like withSkills, but no wave comes either. */
  function still(skills: SkillId[] = []): Battle {
    const b = withSkills(skills);
    b['pending'] = [];
    return b;
  }

  it('takes each potion by its resistance', () => {
    const b = still();
    const brute = enemy(b, 500, 400, 1e6);
    brute.kind = 'brute';
    hit(b, 'ice', brute, 100);
    expect(1e6 - u(brute.hp)).toBeCloseTo(125);
    b.projectiles.push(shot('fire', brute, 100, { id: 3 }));
    const mid = brute.hp;
    b.step();
    expect(u(mid - brute.hp)).toBeCloseTo(50);
  });

  it('keeps a flyer from freezing: frost only slows it', () => {
    const b = still(['iceFrostbite']);
    const f = enemy(b, 500, 600, 1e6);
    f.kind = 'flyer';
    f.x0 = toFp(500);
    f.phase = 0;
    for (let i = 0; i < BALANCE.skills.frostbiteStacks * 2; i++) hit(b, 'ice', f, 1);
    expect(f.freezeTime).toBe(0);
    expect(frac(f.slowFactor)).toBeCloseTo(1 - BALANCE.skills.bossFreezeSlow);
  });

  it('lets a flyer take half of a fire splash aimed at another, all of one aimed at it', () => {
    const b = still();
    const g = enemy(b, 500, 400, 1e6);
    const f = enemy(b, 540, 400, 1e6);
    f.kind = 'flyer';
    f.x0 = toFp(540);
    f.phase = 0;
    hit(b, 'fire', g, 100);
    const fire = RESIST.flyer.fire!;
    expect(1e6 - u(f.hp)).toBeCloseTo(100 * BALANCE.flyer.splash * fire);
    const before = f.hp;
    hit(b, 'fire', f, 100);
    expect(u(before - f.hp)).toBeCloseTo(100 * fire);
  });

  it('weaves a flyer from side to side about where it came in', () => {
    const b = still();
    const f = enemy(b, 500, 200, 1e6);
    f.kind = 'flyer';
    f.x0 = toFp(500);
    f.phase = 0;
    const xs: number[] = [];
    for (let i = 0; i < 120; i++) {
      b.step();
      xs.push(u(f.x));
    }
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(BALANCE.flyer.weave);
    for (const x of xs) expect(Math.abs(x - 500)).toBeLessThanOrEqual(BALANCE.flyer.weave + 1e-6);
  });

  it('winds back the enemies around a winder: hit points back, frost and slow gone, rust kept', () => {
    const b = still();
    const w = enemy(b, 500, 300, 1e6);
    w.kind = 'winder';
    w.windTime = 1;
    const g = enemy(b, 560, 300, 100);
    g.hp = toFp(50);
    g.freezeTime = ticks(2);
    g.slowTime = ticks(2);
    g.rust = 3;
    g.rustTime = ticks(5);
    const boss = enemy(b, 440, 300, 1000);
    boss.kind = 'boss';
    boss.hp = toFp(500);
    const far = enemy(b, 500, 300 + BALANCE.winder.range + 200, 100);
    far.hp = toFp(50);
    b.drain();
    b.step();
    expect(u(g.hp)).toBeCloseTo(50 + 100 * BALANCE.winder.heal);
    expect(g.freezeTime).toBe(0);
    expect(g.slowTime).toBe(0);
    expect(g.rust).toBe(3);
    expect(boss.hp).toBe(toFp(500));
    expect(far.hp).toBe(toFp(50));
    expect(b.drain().some((e) => e.type === 'rewind')).toBe(true);
    expect(sec(w.windTime!)).toBeCloseTo(BALANCE.winder.every, 1);
  });

  it('keeps a winder behind the crowd it winds', () => {
    const b = still();
    const w = enemy(b, 500, 100, 1e6);
    w.kind = 'winder';
    w.speed = perTick(100);
    w.windTime = ticks(99);
    enemy(b, 700, 550, 1e6);
    for (let i = 0; i < 300; i++) b.step();
    expect(u(w.y)).toBeCloseTo(550 - BALANCE.winder.gap);
    expect(w.atWall).toBe(false);
  });
});
