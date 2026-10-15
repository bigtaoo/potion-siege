import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { battleSetup, newMeta } from './meta';
import { Rng } from './rng';
import { emptySkills, perksFor, rollChoices, SKILL_IDS, type SkillId } from './skills';
import { BALANCE, type Enemy, type HeroKind } from './types';

/** Every skill any roll could offer with these heroes fielded at these levels. */
function pool(fielded: HeroKind[], levels: Partial<Record<HeroKind, number>>): Set<SkillId> {
  const lv = { ...newMeta().heroes, ...levels };
  const out = new Set<SkillId>();
  for (let seed = 1; seed < 400; seed++) for (const id of rollChoices(new Rng(seed), emptySkills(), new Set(fielded), lv)) out.add(id);
  return out;
}

/** No enemies, and the commander holds fire, so only the test's own shots land. */
function quiet(b: Battle): void {
  b.enemies = [];
  b.commanderCooldown = 1e9;
}

function enemy(b: Battle, x: number, y: number, hp: number): Enemy {
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind: 'grunt', x, y, hp, maxHp: hp, speed: 0, radius: 30,
    slowFactor: 1, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0, atWall: false,
  };
  b.enemies.push(e);
  return e;
}

/** Fire one projectile of `kind` straight onto `target` and let it land. */
function hit(b: Battle, kind: HeroKind, target: Enemy, damage: number): void {
  b.projectiles.push({ id: 1, kind, star: 1, x: target.x, y: target.y, targetId: target.id, tx: target.x, ty: target.y, damage });
  b.step(1 / 60);
}

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
      for (let i = 0; i < 60; i++) b.step(1 / 60);
      return after - e.hp;
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
    expect(near.hp).toBeCloseTo(1e6 - 100 - 100 * BALANCE.skills.fireChain);
  });

  it('bursts arcane bolts with the fire-and-arcane recipe', () => {
    const b = new Battle(1);
    quiet(b);
    b.choices = ['fireArcane'];
    b.choose('fireArcane');
    const target = enemy(b, 500, 600, 1e6);
    const near = enemy(b, 560, 600, 1e6);
    hit(b, 'arcane', target, 100);
    expect(target.hp).toBe(1e6 - 100);
    expect(near.hp).toBe(1e6 - 100 * BALANCE.skills.burstBolt);
  });
});
