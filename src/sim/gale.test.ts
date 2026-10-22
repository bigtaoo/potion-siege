// The gale skill line in battle (hits.ts, shots.ts): the knock-back and its cooldown by heft,
// tailwind, the gust, the whirlwind and the gale-and-fire recipe.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { RESIST } from './enemies';
import { battleSetup, newMeta } from './meta';
import { FP, TICK_RATE, ticks, toFp } from './math/fixed';
import { Prng } from './math/prng';
import { emptySkills, rollChoices, type SkillId } from './skills';
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

/** Every skill any roll could offer with these heroes fielded at these levels. */
function pool(fielded: HeroKind[], levels: Partial<Record<HeroKind, number>>): Set<SkillId> {
  const lv = { ...newMeta().heroes, ...levels };
  const out = new Set<SkillId>();
  for (let seed = 1; seed < 400; seed++) for (const id of rollChoices(new Prng(seed), emptySkills(), new Set(fielded), lv)) out.add(id);
  return out;
}

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
      markTime: 0, chill: 0, chillTime: 0, brittleTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000, heft: 1000,
  };
  b.enemies.push(e);
  return e;
}

/** A shot of `kind` already on `target` (`damage` in world units), landing on the next tick. */
function shot(kind: HeroKind, target: Enemy, damage: number, extra: Partial<Projectile> = {}): Projectile {
  const { x, y } = target;
  return { id: 1, kind, star: 1, x, y, px: x, py: y, targetId: target.id, tx: x, ty: y, damage: toFp(damage), ...extra };
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

describe('the gale line', () => {
  const W = BALANCE.heroes.wind;
  const S = BALANCE.skills;
  /** A wind shot of `star` straight onto `target`. */
  function gale(b: Battle, target: Enemy, damage = 1, star = 1, gust = false): void {
    b.projectiles.push(shot('wind', target, damage, { star, ...(gust ? { gust } : {}) }));
    b.step();
  }
  /** A star-1 wind hero in the first open cell. */
  function windHero(b: Battle): void {
    const open = b.slots.findIndex((_, i) => b.isOpen(i));
    b.slots[open] = { id: 70, kind: 'wind', star: 1, slot: open, cooldown: 0 };
  }

  it('offers its cards by level, and the recipe only with fire fielded', () => {
    expect(pool(['wind'], { wind: 1 })).toEqual(new Set([...pool([], {}), 'windDamage', 'windPush', 'windHaste']));
    const all = pool(['wind'], { wind: 20 });
    expect(all.has('windGust') && all.has('windVortex')).toBe(true);
    expect(pool(['wind'], { wind: 14 }).has('windVortex')).toBe(false);
    expect(all.has('windFire')).toBe(false);
    expect(pool(['wind', 'fire'], { wind: 20 }).has('windFire')).toBe(true);
    expect(pool(['wind', 'fire'], { wind: 19 }).has('windFire')).toBe(false);
  });

  it('knocks an enemy back off the wall, then not again until its cooldown is over', () => {
    const b = withSkills([]);
    const e = enemy(b, 500, 900, 1e6);
    e.atWall = true;
    gale(b, e);
    expect(u(e.y)).toBeCloseTo(900 - W.push * W.weight.grunt);
    expect(e.atWall).toBe(false);
    const y = e.y;
    gale(b, e);
    expect(e.y).toBe(y);
    e.pushTime = 0;
    gale(b, e, 1, 4);
    expect(u(e.y)).toBeCloseTo(u(y) - W.push * W.pushStar[3] * W.weight.grunt);
  });

  it('blows the light ones further and the boiler golem about half as far, unless the perk or frost brings it up to a clockwork soldier', () => {
    const at = (kind: Enemy['kind'], skills: SkillId[] = [], levels: Partial<Record<HeroKind, number>> = {}, frozen = false) => {
      const b = withSkills(skills, levels);
      const e = enemy(b, 500, 900, 1e6);
      e.kind = kind;
      if (kind === 'flyer') {
        e.x0 = toFp(500);
        e.phase = 0;
      }
      if (frozen) e.freezeTime = ticks(5);
      gale(b, e);
      return 900 - u(e.y);
    };
    expect(at('runner')).toBeCloseTo(W.push * W.weight.runner);
    expect(at('flyer')).toBeCloseTo(W.push * W.weight.flyer);
    expect(at('brute')).toBeCloseTo(W.push * W.weight.brute);
    expect(at('brute', [], {}, true)).toBeCloseTo(W.push * W.weight.grunt);
    expect(at('brute', [], { wind: 10 })).toBeCloseTo(W.push * W.weight.grunt * (1 + S.windPushPlus));
    expect(at('grunt', ['windPush'])).toBeCloseTo(W.push * W.weight.grunt * (1 + S.windPush));
  });

  it('only slows the boss', () => {
    const b = withSkills([]);
    const e = enemy(b, 500, 900, 1e6);
    e.kind = 'boss';
    gale(b, e);
    expect(e.y).toBe(toFp(900));
    expect(e.slowTime).toBeGreaterThan(0);
    expect(frac(e.slowFactor)).toBeCloseTo(1 - W.bossSlow);
  });

  it('spins a winder\'s key back: its rewind starts over', () => {
    const b = withSkills([]);
    const e = enemy(b, 500, 900, 1e6);
    e.kind = 'winder';
    e.windTime = 3;
    gale(b, e);
    expect(sec(e.windTime!)).toBeCloseTo(BALANCE.winder.every, 1);
  });

  it('goes for an ornithopter or a winder before the front enemy', () => {
    const b = withSkills([]);
    const front = enemy(b, 500, 700, 1e9);
    const back = enemy(b, 300, 400, 1e9);
    back.kind = 'flyer';
    back.x0 = toFp(300);
    back.phase = 0;
    windHero(b);
    b.step();
    expect(b.projectiles.map((p) => p.targetId)).toEqual([back.id]);
    expect(front.hp).toBe(toFp(1e9));
  });

  it('shoots faster with tailwind', () => {
    const shots = (skills: SkillId[]) => {
      const b = withSkills(skills);
      enemy(b, 500, 400, 1e12);
      windHero(b);
      let n = 0;
      for (let i = 0; i < TICK_RATE * 10; i++) {
        b.step();
        n += b.drain().filter((ev) => ev.type === 'shot').length;
      }
      return n;
    };
    expect(shots(['windHaste'])).toBeGreaterThan(shots([]) * 1.12);
  });

  it('sweeps a gust across the whole field, as deep as the target', () => {
    const b = withSkills(['windGust']);
    const e = enemy(b, 500, 900, 1e6);
    const side = enemy(b, 100, 900 + S.gustDepth / 2, 1e6);
    const far = enemy(b, 500, 900 - S.gustDepth * 3, 1e6);
    gale(b, e, 10, 1, true);
    expect(u(e.hp)).toBeCloseTo(1e6 - 10 * S.gust);
    expect(u(side.hp)).toBeCloseTo(1e6 - 10 * S.gust);
    expect(u(side.y)).toBeLessThan(900 + S.gustDepth / 2);
    expect(far.hp).toBe(toFp(1e6));
  });

  it('makes every fourth shot of a hero a gust', () => {
    const b = withSkills(['windGust']);
    enemy(b, 500, 400, 1e12);
    windHero(b);
    const seen = new Set<number>();
    const gusts: boolean[] = [];
    for (let i = 0; i < TICK_RATE * 8 && gusts.length < 8; i++) {
      b.step();
      for (const p of b.projectiles) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        gusts.push(!!p.gust);
      }
    }
    expect(gusts.slice(0, 8)).toEqual([false, false, false, true, false, false, false, true]);
  });

  it('leaves a whirlwind where a wind shot kills, pulling the others in', () => {
    const b = withSkills(['windVortex']);
    const e = enemy(b, 500, 600, 5);
    const near = enemy(b, 600, 600, 1e6);
    gale(b, e, 100);
    expect(b.vortices).toHaveLength(1);
    for (let i = 0; i < TICK_RATE / 2; i++) b.step();
    expect(u(near.x)).toBeLessThan(600);
    for (let i = 0; i < ticks(S.vortexTime); i++) b.step();
    expect(b.vortices).toHaveLength(0);
    const plain = withSkills([]);
    gale(plain, enemy(plain, 500, 600, 5), 100);
    expect(plain.vortices).toHaveLength(0);
  });

  it('fans the flames onto those around with the gale-and-fire recipe', () => {
    const b = withSkills(['windFire']);
    const e = enemy(b, 500, 600, 1e6);
    const near = enemy(b, 560, 600, 1e6);
    const far = enemy(b, 500 + S.windFireRadius * 3, 600, 1e6);
    e.burnTime = ticks(2);
    e.burnDps = toFp(5);
    e.scorch = toFp(100);
    e.scorchTime = ticks(2);
    gale(b, e);
    expect(near.burnTime).toBeGreaterThan(0);
    expect(u(near.burnDps)).toBeCloseTo(100 * S.windFire);
    expect(far.burnTime).toBe(0);
    const plain = withSkills([]);
    const f = enemy(plain, 500, 600, 1e6);
    const g = enemy(plain, 560, 600, 1e6);
    f.burnTime = ticks(2);
    f.scorch = toFp(100);
    f.scorchTime = ticks(2);
    gale(plain, f);
    expect(g.burnTime).toBe(0);
  });
});
