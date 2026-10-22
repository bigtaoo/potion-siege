// The skill cards (skills.ts): the rolls and rerolls, what each hero's level opens, and the fire
// and corrosion lines in battle. The arcane, ice and lightning lines are in
// arcaneIceLightning.test.ts, the gale line in gale.test.ts, the flyer and winder in
// kindsInBattle.test.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { RESIST } from './enemies';
import { battleSetup, newMeta } from './meta';
import { FP, TICK_RATE, toFp } from './math/fixed';
import { Prng } from './math/prng';
import { emptySkills, mods, perksFor, rollChoices, SKILL_IDS, type SkillId } from './skills';
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

/** Fire one projectile of `kind` straight onto `target` and let it land. */
function hit(b: Battle, kind: HeroKind, target: Enemy, damage: number): void {
  b.projectiles.push(shot(kind, target, damage));
  b.step();
}

/** Hit points, position and the like back in world units. */
const u = (v: number) => v / FP;

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

describe('rerolls', () => {
  it('leaves the replaced cards out, and brings them back only when nothing else is left', () => {
    const lv = newMeta().heroes;
    const shown: SkillId[] = ['allDamage', 'allSpeed', 'crit'];
    for (let seed = 1; seed < 50; seed++) {
      const next = rollChoices(new Prng(seed), emptySkills(), new Set<HeroKind>(['arcane']), lv, undefined, shown);
      expect(next).toHaveLength(3);
      expect(next.some((id) => shown.includes(id))).toBe(false);
    }
    // only gold and wallRepair besides these: one of the old cards has to come back
    const levels = { ...emptySkills(), allSpeed: 5, crit: 4 };
    const next = rollChoices(new Prng(1), levels, new Set(), lv, undefined, ['allDamage', 'gold', 'wallRepair']);
    expect(next.sort()).toEqual(['allDamage', 'gold', 'wallRepair']);
  });
});

describe('hero skills', () => {
  it('opens fire cards with the fire level, and the recipe only with arcane fielded too', () => {
    expect(pool(['fire'], { fire: 1 })).not.toContain('fireBurn');
    const at20 = pool(['fire'], { fire: 20 });
    expect(at20).toContain('fireBurn');
    expect(at20).toContain('fireChain');
    expect(at20).not.toContain('fireArcane');
    expect(pool(['fire', 'arcane'], { fire: 20 })).toContain('fireArcane');
    expect(pool(['arcane'], { fire: 20 })).not.toContain('fireBurn');
    expect(SKILL_IDS).not.toContain('poisonSpread');
  });

  it('gives the burn perk at fire level 10', () => {
    expect(perksFor({ ...newMeta().heroes, fire: 9 }).has('fireBurnPlus')).toBe(false);
    expect(perksFor({ ...newMeta().heroes, fire: 10 }).has('fireBurnPlus')).toBe(true);
  });

  it('burns after a fire hit, harder with the perk', () => {
    const burnt = (fireLevel: number) => {
      const m = newMeta();
      m.heroes.fire = fireLevel;
      const b = new Battle(1, battleSetup(m));
      quiet(b);
      b.choices = ['fireBurn'];
      b.choose('fireBurn');
      const e = enemy(b, 500, 600, 1e6);
      hit(b, 'fire', e, 100);
      const after = e.hp;
      for (let i = 0; i < TICK_RATE; i++) b.step();
      return u(after - e.hp);
    };
    expect(burnt(1)).toBeCloseTo(100 * BALANCE.skills.fireBurn, 0);
    expect(burnt(10)).toBeCloseTo(100 * BALANCE.skills.fireBurn * (1 + BALANCE.skills.fireBurnPlus), 0);
  });

  it('makes enemies burnt to death explode once more', () => {
    const b = new Battle(1);
    quiet(b);
    b.choices = ['fireChain'];
    b.choose('fireChain');
    const victim = enemy(b, 500, 600, 50);
    const near = enemy(b, 560, 600, 1e6);
    hit(b, 'fire', victim, 100);
    expect(b.enemies).not.toContain(victim);
    // the blast itself, then the victim's explosion
    expect(u(near.hp)).toBeCloseTo(1e6 - 100 - 100 * BALANCE.skills.fireChain);
  });

  it('bursts arcane bolts with the fire-and-arcane recipe', () => {
    const b = new Battle(1);
    quiet(b);
    b.choices = ['fireArcane'];
    b.choose('fireArcane');
    const target = enemy(b, 500, 600, 1e6);
    const near = enemy(b, 560, 600, 1e6);
    hit(b, 'arcane', target, 100);
    expect(target.hp).toBe(toFp(1e6 - 100));
    expect(near.hp).toBe(toFp(1e6 - 100 * BALANCE.skills.burstBolt));
  });
});

describe('the corrosion line', () => {
  const P = BALANCE.heroes.poison;

  it('offers its cards by level, and the recipe only with lightning fielded', () => {
    expect(pool(['poison'], { poison: 1 })).toEqual(new Set([...pool([], {}), 'poisonDamage', 'poisonRust']));
    const all = pool(['poison'], { poison: 20 });
    expect(all.has('poisonSplash') && all.has('poisonMelt')).toBe(true);
    expect(all.has('poisonLightning')).toBe(false);
    expect(pool(['poison', 'lightning'], { poison: 20 }).has('poisonLightning')).toBe(true);
    expect(pool(['poison', 'lightning'], { poison: 19 }).has('poisonLightning')).toBe(false);
  });

  it('holds more rust with deep rust, and each stack counts more with the perk', () => {
    expect(mods(emptySkills()).rustMax).toBe(P.rustMax);
    expect(mods({ ...emptySkills(), poisonRust: 2 }).rustMax).toBe(P.rustMax + 2 * BALANCE.skills.rustExtra);
    expect(mods(emptySkills(), perksFor({ arcane: 1, fire: 1, ice: 1, lightning: 1, poison: 10, wind: 1 })).rustStep).toBeCloseTo(P.rustStep * (1 + BALANCE.skills.rustPlus));
    const b = withSkills(['poisonRust']);
    const e = enemy(b, 500, 600, 1e6);
    for (let i = 0; i < P.rustMax + BALANCE.skills.rustExtra + 2; i++) hit(b, 'poison', e, 1);
    expect(e.rust).toBe(P.rustMax + BALANCE.skills.rustExtra);
  });

  it('splashes poison and rust onto enemies close to the target', () => {
    const b = withSkills(['poisonSplash']);
    const e = enemy(b, 500, 600, 1e6);
    const near = enemy(b, 500 + BALANCE.skills.acidRadius / 2, 600, 1e6);
    const far = enemy(b, 500 + BALANCE.skills.acidRadius * 4, 600, 1e6);
    hit(b, 'poison', e, 1);
    expect(near.rust).toBe(1);
    expect(near.poisonTime).toBeGreaterThan(0);
    expect(far.rust).toBe(0);
  });

  it('passes a rusted kill\'s rust on to those around it, with meltdown', () => {
    const b = withSkills(['poisonMelt']);
    const e = enemy(b, 500, 600, 5);
    const near = enemy(b, 560, 600, 1e6);
    hit(b, 'poison', e, 0);
    hit(b, 'poison', e, 0);
    hit(b, 'arcane', e, 100);
    expect(near.rust).toBe(2);
  });

  it('rusts with lightning under the corrosion-and-lightning recipe', () => {
    const b = withSkills(['poisonLightning']);
    const e = enemy(b, 500, 600, 1e6);
    hit(b, 'lightning', e, 1);
    expect(e.rust).toBe(1);
    const plain = withSkills([]);
    const f = enemy(plain, 500, 600, 1e6);
    hit(plain, 'lightning', f, 1);
    expect(f.rust).toBe(0);
  });
});
