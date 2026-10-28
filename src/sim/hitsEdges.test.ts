// The edges of what a shot does where it lands (hits.ts): who the sky strike, the gust, the acid,
// the burst and the split leave out, the knockback's clamps, the whirlwind's reach and the
// gale-and-fire recipe's heat. Pinned by mutation testing (ref/mutation-sim.md).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { RESIST } from './enemies';
import { K } from './field';
import { pull, push, windHit } from './hits';
import { battleSetup, newMeta } from './meta';
import { FP, ticks, times, toFp } from './math/fixed';
import { type SkillId } from './skills';
import { BALANCE, type Enemy, type HeroKind, type Projectile } from './types';

// Every potion lands in full on a grunt here; the resistances have tests of their own.
const gruntResist = RESIST.grunt;
beforeAll(() => {
  RESIST.grunt = {};
});
afterAll(() => {
  RESIST.grunt = gruntResist;
});

const S = BALANCE.skills;
const W = BALANCE.heroes.wind;

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

/** Fire one projectile straight onto `target` and let it land. */
function hit(b: Battle, kind: HeroKind, target: Enemy, damage: number, extra: Partial<Projectile> = {}): void {
  b.projectiles.push(shot(kind, target, damage, extra));
  b.step();
}

/** Static on `e`, for a hit of another potion to set off. */
function charged(e: Enemy): Enemy {
  e.charge = toFp(50);
  e.chargeTime = ticks(1);
  return e;
}

const u = (v: number) => v / FP;

/** A battle with no enemies and these skills taken, the heroes at these levels. */
function withSkills(skills: SkillId[], levels: Partial<Record<HeroKind, number>> = {}): Battle {
  const m = newMeta();
  Object.assign(m.heroes, levels);
  const b = new Battle(1, battleSetup(m));
  b.enemies = [];
  for (const id of skills) {
    b.choices = [id];
    b.choose(id);
  }
  return b;
}

describe('the sky strike', () => {
  it('strikes only the living within its reach', () => {
    const b = withSkills(['lightningStrike']);
    const target = enemy(b, 500, 600, 1e6);
    const near = enemy(b, 600, 600, 80); // the chain's first jump kills it, exactly
    const far = enemy(b, 500, 1000, 1e6); // out of the strike's and the chain's reach
    hit(b, 'lightning', target, 100, { strike: true });
    expect(near.hp).toBe(0);
    expect(far.hp).toBe(toFp(1e6));
    expect(u(target.hp)).toBeCloseTo(1e6 - 100 - 100 * S.thunderstrike);
  });
});

describe('any shot', () => {
  it('chains lightning as many jumps as it has, more with the chain card', () => {
    const struck = (skills: SkillId[]) => {
      const b = withSkills(skills);
      const row = [0, 1, 2, 3, 4, 5].map((i) => enemy(b, 500 + 100 * i, 600, 1e6));
      hit(b, 'lightning', row[0], 10);
      return row.filter((e) => e.hp < toFp(1e6)).length;
    };
    expect(struck([])).toBe(1 + BALANCE.heroes.lightning.chains);
    expect(struck(['lightningChain'])).toBe(1 + BALANCE.heroes.lightning.chains + S.lightningChains);
  });

  it('is wasted when its target is gone', () => {
    for (const kind of ['lightning', 'ice'] as const) {
      const b = withSkills([]);
      const e = enemy(b, 500, 600, 1e6);
      hit(b, kind, e, 10, { targetId: 4242 });
      expect(b.wasted[kind]).toBe(toFp(10));
      expect(e.hp).toBe(toFp(1e6));
    }
  });

  it('marks only with arcane bolts and the mark card, and knocks back only with wind', () => {
    const b = withSkills(['arcaneMark']);
    const e = enemy(b, 500, 600, 1e6);
    hit(b, 'ice', e, 1);
    expect(e.markTime).toBe(0);
    expect(e.y).toBe(toFp(600));
    const plain = withSkills([]);
    const f = enemy(plain, 500, 600, 1e6);
    hit(plain, 'arcane', f, 1);
    expect(f.markTime).toBe(0);
  });
});

describe('the gust', () => {
  it('is only a gust when the shot is one', () => {
    const b = withSkills(['windGust']);
    const target = enemy(b, 500, 600, 1e6);
    const side = enemy(b, 100, 600, 1e6);
    hit(b, 'wind', target, 10);
    expect(side.hp).toBe(toFp(1e6));
    expect(u(target.hp)).toBeCloseTo(1e6 - 10);
  });

  it('reaches as deep as the enemy\'s own edge, leaves the dead be and sets off static', () => {
    const b = withSkills(['windGust']);
    const target = enemy(b, 500, 600, 1e6);
    const edge = enemy(b, 100, 600 + S.gustDepth + 30, 1e6);
    const dead = enemy(b, 300, 600, 0);
    const side = charged(enemy(b, 700, 600, 1e6));
    hit(b, 'wind', target, 10, { gust: true });
    expect(u(edge.hp)).toBeCloseTo(1e6 - 10 * S.gust);
    expect(dead.hp).toBe(0);
    expect(side.charge).toBe(0);
  });

  it('leaves a whirlwind only where its own target dies', () => {
    const b = withSkills(['windGust', 'windVortex']);
    const target = enemy(b, 500, 600, 5);
    enemy(b, 200, 600, 5);
    hit(b, 'wind', target, 100, { gust: true });
    expect(b.vortices.map((v) => v.x)).toEqual([toFp(500)]);
  });
});

describe('a wind hit', () => {
  it('leaves a whirlwind on a kill to the last hit point, not on a living one', () => {
    const b = withSkills(['windVortex']);
    const alive = enemy(b, 500, 600, 1);
    windHit(b, alive, shot('wind', alive, 0), true);
    expect(b.vortices).toHaveLength(0);
    const dead = enemy(b, 700, 600, 0);
    windHit(b, dead, shot('wind', dead, 0), true);
    expect(b.vortices).toHaveLength(1);
  });

  it('fans a burn or a scorch, never a cold one, onto the living, never cooling a hotter burn', () => {
    const b = withSkills(['windFire']);
    const burning = enemy(b, 500, 600, 1e6);
    burning.burnTime = ticks(2);
    burning.burnDps = toFp(5);
    const near = enemy(b, 560, 600, 1e6);
    const dead = enemy(b, 540, 600, 0);
    const hotter = enemy(b, 450, 600, 1e6);
    hotter.burnDps = toFp(1000);
    hotter.burnBy = 'fire';
    const even = enemy(b, 520, 600, 1e6);
    even.burnDps = toFp(5);
    even.burnBy = 'fire';
    windHit(b, burning, shot('wind', burning, 0), true);
    expect(near.burnDps).toBe(toFp(5));
    expect(near.burnBy).toBe('wind');
    expect(dead.burnTime).toBe(0);
    expect(hotter.burnDps).toBe(toFp(1000));
    expect(hotter.burnBy).toBe('fire');
    expect(hotter.burnTime).toBe(ticks(S.burnTime));
    expect(even.burnBy).toBe('wind');

    const scorched = withSkills(['windFire']);
    const s = enemy(scorched, 500, 600, 1e6);
    s.scorch = toFp(100);
    s.scorchTime = ticks(2);
    const n = enemy(scorched, 560, 600, 1e6);
    windHit(scorched, s, shot('wind', s, 0), true);
    expect(n.burnDps).toBe(times(toFp(100), S.windFire * 1000));

    const cold = withSkills(['windFire']);
    const c = enemy(cold, 500, 600, 1e6);
    c.scorch = toFp(100);
    const m = enemy(cold, 560, 600, 1e6);
    windHit(cold, c, shot('wind', c, 0), true);
    expect(m.burnTime).toBe(0);
  });
});

describe('the knockback', () => {
  it('lets the perk and frost lift only the boiler golem\'s weight', () => {
    const b = withSkills([], { wind: 10 });
    const runner = enemy(b, 500, 900, 1e6);
    runner.kind = 'runner';
    push(b, runner, 1);
    expect(900 - u(runner.y)).toBeCloseTo(W.push * W.weight.runner * (1 + S.windPushPlus));
  });

  it('stops at the field\'s top edge, leaves the dead and only rewinds a winder', () => {
    const b = withSkills([]);
    const high = enemy(b, 500, BALANCE.field.top, 1e6);
    push(b, high, 1);
    expect(high.y).toBe(K.top - high.radius);
    const dead = enemy(b, 500, 900, 0);
    push(b, dead, 1);
    expect(dead.y).toBe(toFp(900));
    expect(dead.pushTime).toBe(0);
    const grunt = enemy(b, 700, 900, 1e6);
    push(b, grunt, 1);
    expect(grunt.windTime).toBeUndefined();
  });
});

describe('a whirlwind', () => {
  const eye = { x: toFp(500), y: toFp(600), time: 10 };
  /** Where `e` at (x, y) stands after one pull, in world units. */
  function pulled(x: number, y: number, kind: Enemy['kind'] = 'grunt'): Enemy {
    const b = withSkills([]);
    const e = enemy(b, x, y, 1e6);
    e.kind = kind;
    e.x0 = e.x;
    pull(e, eye);
    return e;
  }

  it('draws in by its pull a tick, from as far as its reach and the enemy\'s edge', () => {
    const step = u(K.vortexPull);
    expect(u(pulled(600, 600).x)).toBeCloseTo(600 - step);
    expect(u(pulled(500, 700).y)).toBeCloseTo(700 - step);
    const edge = 500 + S.vortexRadius + 30;
    expect(u(pulled(edge, 600).x)).toBeCloseTo(edge - step);
    expect(u(pulled(edge + 1, 600).x)).toBe(edge + 1);
  });

  it('leaves one in its eye be, and pulls one a unit off the rest of the way', () => {
    expect(u(pulled(500.5, 600).x)).toBe(500.5);
    expect(u(pulled(501, 600).x)).toBe(500);
  });

  it('moves an ornithopter\'s line of flight, not where it is', () => {
    const e = pulled(600, 600, 'flyer');
    expect(u(e.x0!)).toBeCloseTo(600 - u(K.vortexPull));
    expect(u(e.x)).toBe(600);
  });
});

describe('ice and poison', () => {
  it('freezes on the freeze chance', () => {
    const b = withSkills([]);
    (b.fixed as { freezeChance: number }).freezeChance = 1000;
    const e = enemy(b, 500, 600, 1e6);
    hit(b, 'ice', e, 1);
    expect(e.freezeTime).toBeGreaterThan(0);
  });

  it('poisons by the shot\'s own star', () => {
    const b = withSkills([]);
    const e = enemy(b, 500, 600, 1e6);
    hit(b, 'poison', e, 1, { star: 2 });
    expect(e.poisonDps).toBe(b.fixed.poison[1]);
  });

  it('splashes acid on the living around the target, not twice on the target', () => {
    const b = withSkills(['poisonSplash']);
    const target = enemy(b, 500, 600, 1e6);
    const near = enemy(b, 560, 600, 1e6);
    const dead = enemy(b, 540, 600, 0);
    hit(b, 'poison', target, 1);
    expect(target.rust).toBe(1);
    expect(near.poisonDps).toBeGreaterThan(0);
    expect(dead.poisonDps).toBe(0);
  });
});

describe('the arcane bolt', () => {
  it('never shortens a longer brittleness with frost bolts', () => {
    const b = withSkills(['arcaneIce']);
    const e = enemy(b, 500, 600, 1e6);
    e.brittleTime = ticks(5);
    hit(b, 'arcane', e, 1);
    expect(e.brittleTime).toBeGreaterThan(ticks(4));
  });

  it('bursts onto the living around, setting off their static', () => {
    const b = withSkills(['fireArcane']);
    const target = enemy(b, 500, 600, 1e6);
    const dead = enemy(b, 540, 600, 0);
    const side = charged(enemy(b, 460, 600, 1e6));
    hit(b, 'arcane', target, 10);
    expect(dead.scorchTime).toBe(0);
    expect(side.charge).toBe(0);
  });

  it('splits only on a kill, to the last hit point, as far as there are enemies, with new ids', () => {
    const b = withSkills(['arcaneSplit']);
    const target = enemy(b, 500, 600, 1e6);
    enemy(b, 600, 600, 1e6);
    hit(b, 'arcane', target, 10);
    expect(b.projectiles.filter((p) => p.split)).toHaveLength(0);

    const k = withSkills(['arcaneSplit']);
    const victim = enemy(k, 500, 600, 100);
    const only = enemy(k, 600, 600, 1e6);
    const id = k.nextId;
    hit(k, 'arcane', victim, 100);
    const split = k.projectiles.filter((p) => p.split);
    expect(split.map((p) => p.targetId)).toEqual([only.id]);
    expect(split[0].id).toBeGreaterThanOrEqual(id);
    expect(k.nextId).toBeGreaterThan(split[0].id);
  });
});
