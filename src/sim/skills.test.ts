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
    slowFactor: 1, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
      markTime: 0, chill: 0, charge: 0, chargeTime: 0, atWall: false,
  };
  b.enemies.push(e);
  return e;
}

/** Fire one projectile of `kind` straight onto `target` and let it land. */
function hit(b: Battle, kind: HeroKind, target: Enemy, damage: number): void {
  b.projectiles.push({ id: 1, kind, star: 1, x: target.x, y: target.y, targetId: target.id, tx: target.x, ty: target.y, damage });
  b.step(1 / 60);
}

describe('rerolls', () => {
  it('leaves the replaced cards out, and brings them back only when nothing else is left', () => {
    const lv = newMeta().heroes;
    const shown: SkillId[] = ['allDamage', 'allSpeed', 'crit'];
    for (let seed = 1; seed < 50; seed++) {
      const next = rollChoices(new Rng(seed), emptySkills(), new Set<HeroKind>(['arcane']), lv, undefined, shown);
      expect(next).toHaveLength(3);
      expect(next.some((id) => shown.includes(id))).toBe(false);
    }
    // only gold and wallRepair besides these: one of the old cards has to come back
    const levels = { ...emptySkills(), allSpeed: 5, crit: 4 };
    const next = rollChoices(new Rng(1), levels, new Set(), lv, undefined, ['allDamage', 'gold', 'wallRepair']);
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

describe('arcane, ice and lightning lines', () => {
  it('opens each line with its level, and each recipe only with its partner fielded', () => {
    const lines: [HeroKind, SkillId, SkillId, SkillId, HeroKind][] = [
      ['arcane', 'arcaneMark', 'arcaneSplit', 'arcaneIce', 'ice'],
      ['ice', 'iceFrostbite', 'iceShatter', 'iceLightning', 'lightning'],
      ['lightning', 'lightningStatic', 'lightningStrike', 'lightningFire', 'fire'],
    ];
    for (const [hero, status, signature, recipe, partner] of lines) {
      const at1 = pool([hero], { [hero]: 1 });
      expect(at1).not.toContain(status);
      expect(at1).not.toContain(signature);
      expect(pool([hero], { [hero]: 5 })).toContain(status);
      expect(pool([hero], { [hero]: 14 })).not.toContain(signature);
      const at20 = pool([hero], { [hero]: 20 });
      expect(at20).toContain(signature);
      expect(at20).not.toContain(recipe);
      expect(pool([hero, partner], { [hero]: 20 })).toContain(recipe);
    }
    expect(pool(['ice'], {})).toContain('iceDamage');
    expect(pool(['lightning'], {})).toContain('lightningDamage');
  });

  it('marks enemies with arcane bolts so every hit lands harder, more with the perk', () => {
    const marked = (arcaneLevel: number) => {
      const b = withSkills(['arcaneMark'], { arcane: arcaneLevel });
      const e = enemy(b, 500, 600, 1e6);
      hit(b, 'arcane', e, 100);
      const before = e.hp;
      hit(b, 'ice', e, 100);
      return before - e.hp;
    };
    expect(marked(1)).toBeCloseTo(100 * (1 + BALANCE.skills.arcaneMark));
    expect(marked(10)).toBeCloseTo(100 * (1 + BALANCE.skills.arcaneMark * (1 + BALANCE.skills.arcaneMarkPlus)));
  });

  it('leaves the commander bolts out of the arcane line', () => {
    const b = withSkills(['arcaneMark', 'fireArcane']);
    const e = enemy(b, 500, 600, 1e6);
    const near = enemy(b, 560, 600, 1e6);
    b.projectiles.push({ id: 1, kind: 'arcane', star: 1, x: e.x, y: e.y, targetId: e.id, tx: e.x, ty: e.y, damage: 100, commander: true });
    b.step(1 / 60);
    expect(e.markTime).toBe(0);
    expect(near.hp).toBe(1e6);
  });

  it('splits a killing arcane bolt towards the nearest enemies, once', () => {
    const b = withSkills(['arcaneSplit']);
    const victim = enemy(b, 500, 600, 50);
    const a = enemy(b, 600, 600, 1e6);
    const c = enemy(b, 400, 640, 1e6);
    enemy(b, 900, 600, 1e6); // too far behind the other two
    hit(b, 'arcane', victim, 100);
    const split = b.projectiles.filter((p) => p.split);
    expect(split.map((p) => p.targetId).sort()).toEqual([a.id, c.id].sort());
    for (let i = 0; i < 30; i++) b.step(1 / 60);
    expect(a.hp).toBeCloseTo(1e6 - 100 * BALANCE.skills.splitBolt);
    expect(c.hp).toBeCloseTo(1e6 - 100 * BALANCE.skills.splitBolt);
  });

  it('slows with arcane bolts under the arcane-and-ice recipe', () => {
    const b = withSkills(['arcaneIce']);
    const e = enemy(b, 500, 600, 1e6);
    hit(b, 'arcane', e, 10);
    expect(e.slowTime).toBeGreaterThan(0);
    expect(e.slowFactor).toBeCloseTo(1 - BALANCE.skills.frostBoltSlow);
  });

  it('freezes after enough frostbite stacks, longer with the perk, never a boss', () => {
    const frozenFor = (iceLevel: number) => {
      const b = withSkills(['iceFrostbite'], { ice: iceLevel });
      const e = enemy(b, 500, 600, 1e6);
      for (let i = 1; i < BALANCE.skills.frostbiteStacks; i++) hit(b, 'ice', e, 1);
      expect(e.freezeTime).toBe(0);
      hit(b, 'ice', e, 1);
      expect(e.chill).toBe(0);
      return e.freezeTime;
    };
    expect(frozenFor(1)).toBeCloseTo(BALANCE.skills.frostbiteFreeze, 1);
    expect(frozenFor(10)).toBeCloseTo(BALANCE.skills.frostbiteFreeze * (1 + BALANCE.skills.iceFreezePlus), 1);
    const b = withSkills(['iceFrostbite']);
    const boss = enemy(b, 500, 600, 1e6);
    boss.kind = 'boss';
    for (let i = 0; i < 8; i++) hit(b, 'ice', boss, 1);
    expect(boss.freezeTime).toBe(0);
  });

  it('shatters enemies that die frozen', () => {
    const b = withSkills(['iceShatter']);
    const victim = enemy(b, 500, 600, 50);
    victim.freezeTime = 1;
    const near = enemy(b, 560, 600, 1e6);
    hit(b, 'arcane', victim, 100);
    expect(b.enemies).not.toContain(victim);
    expect(near.hp).toBeCloseTo(1e6 - 50 * BALANCE.skills.shatter);
    expect(near.slowTime).toBeGreaterThan(0);
  });

  it('hits slowed enemies harder with lightning under the ice-and-lightning recipe', () => {
    const b = withSkills(['iceLightning']);
    const slowed = enemy(b, 500, 600, 1e6);
    slowed.slowTime = 1;
    slowed.slowFactor = 0.6;
    hit(b, 'lightning', slowed, 100);
    expect(slowed.hp).toBeCloseTo(1e6 - 100 * (1 + BALANCE.skills.superconduct));
  });

  it('leaves static that the next hit of another potion sets off, more with the perk', () => {
    const extra = (lightningLevel: number) => {
      const b = withSkills(['lightningStatic'], { lightning: lightningLevel });
      const e = enemy(b, 500, 600, 1e6);
      hit(b, 'lightning', e, 100);
      const before = e.hp;
      hit(b, 'ice', e, 10);
      const first = before - e.hp - 10;
      hit(b, 'ice', e, 0); // spent: nothing more
      expect(e.charge).toBe(0);
      return first;
    };
    expect(extra(1)).toBeCloseTo(100 * BALANCE.skills.lightningStatic);
    expect(extra(10)).toBeCloseTo(100 * BALANCE.skills.lightningStatic * (1 + BALANCE.skills.lightningStaticPlus));
  });

  it('calls a sky strike on every few lightning shots', () => {
    const b = withSkills(['lightningStrike']);
    b.slots[0] = { id: 77, kind: 'lightning', star: 1, slot: 0, cooldown: 0 };
    enemy(b, 500, 600, 1e9);
    const flags: boolean[] = [];
    for (let i = 0; i < 60 * 12 && flags.length < 8; i++) {
      const before = new Set(b.projectiles.map((p) => p.id));
      b.step(1 / 60);
      for (const p of b.projectiles) if (!before.has(p.id) && p.kind === 'lightning') flags.push(!!p.strike);
    }
    expect(flags.slice(0, 8)).toEqual([false, false, false, true, false, false, false, true]);
  });

  it('strikes all around the target with the sky bolt', () => {
    const b = withSkills(['lightningStrike']);
    const target = enemy(b, 500, 600, 1e6);
    const near = enemy(b, 600, 600, 1e6); // also the first chain jump
    b.projectiles.push({ id: 1, kind: 'lightning', star: 1, x: target.x, y: target.y, targetId: target.id, tx: target.x, ty: target.y, damage: 100, strike: true });
    b.step(1 / 60);
    const chain = BALANCE.heroes.lightning.chainFalloff;
    expect(target.hp).toBeCloseTo(1e6 - 100 - 100 * BALANCE.skills.thunderstrike);
    expect(near.hp).toBeCloseTo(1e6 - 100 * chain - 100 * BALANCE.skills.thunderstrike);
  });

  it('sets enemies alight with lightning under the lightning-and-fire recipe, as fire', () => {
    const b = withSkills(['lightningFire', 'fireChain']);
    const e = enemy(b, 500, 600, 1e6);
    hit(b, 'lightning', e, 100);
    expect(e.burnDps).toBeCloseTo(100 * BALANCE.skills.plasmaBurn);
    expect(e.scorchTime).toBeGreaterThan(0);
  });
});
