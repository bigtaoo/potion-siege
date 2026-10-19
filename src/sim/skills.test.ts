import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { RESIST } from './enemies';
import { battleSetup, newMeta } from './meta';
import { FP, perTick, TICK_RATE, ticks, toFp } from './math/fixed';
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
      return u(before - e.hp);
    };
    expect(marked(1)).toBeCloseTo(100 * (1 + BALANCE.skills.arcaneMark));
    expect(marked(10)).toBeCloseTo(100 * (1 + BALANCE.skills.arcaneMark * (1 + BALANCE.skills.arcaneMarkPlus)));
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
    for (let i = 0; i < TICK_RATE / 2; i++) b.step();
    expect(u(a.hp)).toBeCloseTo(1e6 - 100 * BALANCE.skills.splitBolt);
    expect(u(c.hp)).toBeCloseTo(1e6 - 100 * BALANCE.skills.splitBolt);
  });

  it('slows with arcane bolts under the arcane-and-ice recipe', () => {
    const b = withSkills(['arcaneIce']);
    const e = enemy(b, 500, 600, 1e6);
    hit(b, 'arcane', e, 10);
    expect(e.slowTime).toBeGreaterThan(0);
    expect(frac(e.slowFactor)).toBeCloseTo(1 - BALANCE.skills.frostBoltSlow);
  });

  it('freezes after enough frostbite stacks, longer with the perk; a boss slows hard instead', () => {
    const frozenFor = (iceLevel: number) => {
      const b = withSkills(['iceFrostbite'], { ice: iceLevel });
      const e = enemy(b, 500, 600, 1e6);
      for (let i = 1; i < BALANCE.skills.frostbiteStacks; i++) hit(b, 'ice', e, 1);
      expect(e.freezeTime).toBe(0);
      hit(b, 'ice', e, 1);
      expect(e.chill).toBe(0);
      return sec(e.freezeTime);
    };
    expect(frozenFor(1)).toBeCloseTo(BALANCE.skills.frostbiteFreeze, 1);
    expect(frozenFor(10)).toBeCloseTo(BALANCE.skills.frostbiteFreeze * (1 + BALANCE.skills.iceFreezePlus), 1);
    const b = withSkills(['iceFrostbite']);
    const boss = enemy(b, 500, 600, 1e6);
    boss.kind = 'boss';
    for (let i = 0; i < 8; i++) hit(b, 'ice', boss, 1);
    expect(boss.freezeTime).toBe(0);
    expect(frac(boss.slowFactor)).toBeCloseTo(1 - BALANCE.skills.bossFreezeSlow);
    expect(boss.slowTime).toBeGreaterThan(0);
  });

  it('cracks a boss instead of freezing it, with shatter', () => {
    const b = withSkills(['iceFrostbite', 'iceShatter']);
    const boss = enemy(b, 500, 600, 1e6);
    boss.kind = 'boss';
    for (let i = 1; i < BALANCE.skills.frostbiteStacks; i++) hit(b, 'ice', boss, 10);
    const before = boss.hp;
    hit(b, 'ice', boss, 10);
    expect(u(before - boss.hp)).toBeCloseTo(10 * (1 + BALANCE.skills.bossShatter));
  });

  it('shatters enemies that die frozen', () => {
    const b = withSkills(['iceShatter']);
    const victim = enemy(b, 500, 600, 50);
    victim.freezeTime = ticks(1);
    const near = enemy(b, 560, 600, 1e6);
    hit(b, 'arcane', victim, 100);
    expect(b.enemies).not.toContain(victim);
    expect(u(near.hp)).toBeCloseTo(1e6 - 50 * BALANCE.skills.shatter);
    expect(near.slowTime).toBeGreaterThan(0);
  });

  it('hits slowed enemies harder with lightning under the ice-and-lightning recipe', () => {
    const b = withSkills(['iceLightning']);
    const slowed = enemy(b, 500, 600, 1e6);
    slowed.slowTime = ticks(1);
    slowed.slowFactor = 600;
    hit(b, 'lightning', slowed, 100);
    expect(u(slowed.hp)).toBeCloseTo(1e6 - 100 * (1 + BALANCE.skills.superconduct));
  });

  it('leaves static that the next hit of another potion sets off, more with the perk', () => {
    const extra = (lightningLevel: number) => {
      const b = withSkills(['lightningStatic'], { lightning: lightningLevel });
      const e = enemy(b, 500, 600, 1e6);
      hit(b, 'lightning', e, 100);
      const before = e.hp;
      hit(b, 'ice', e, 10);
      const first = u(before - e.hp) - 10;
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
    for (let i = 0; i < TICK_RATE * 12 && flags.length < 8; i++) {
      const before = new Set(b.projectiles.map((p) => p.id));
      b.step();
      for (const p of b.projectiles) if (!before.has(p.id) && p.kind === 'lightning') flags.push(!!p.strike);
    }
    expect(flags.slice(0, 8)).toEqual([false, false, false, true, false, false, false, true]);
  });

  it('strikes all around the target with the sky bolt', () => {
    const b = withSkills(['lightningStrike']);
    const target = enemy(b, 500, 600, 1e6);
    const near = enemy(b, 600, 600, 1e6); // also the first chain jump
    b.projectiles.push(shot('lightning', target, 100, { strike: true }));
    b.step();
    const chain = BALANCE.heroes.lightning.chainFalloff;
    expect(u(target.hp)).toBeCloseTo(1e6 - 100 - 100 * BALANCE.skills.thunderstrike);
    expect(u(near.hp)).toBeCloseTo(1e6 - 100 * chain - 100 * BALANCE.skills.thunderstrike);
  });

  it('sets enemies alight with lightning under the lightning-and-fire recipe, as fire', () => {
    const b = withSkills(['lightningFire', 'fireChain']);
    const e = enemy(b, 500, 600, 1e6);
    hit(b, 'lightning', e, 100);
    expect(u(e.burnDps)).toBeCloseTo(100 * BALANCE.skills.plasmaBurn);
    expect(e.scorchTime).toBeGreaterThan(0);
  });

  it('raises ice and lightning damage with their concentrate cards', () => {
    const m = mods({ ...emptySkills(), iceDamage: 2, lightningDamage: 3 });
    expect(m.damage('ice')).toBeCloseTo(1 + 2 * BALANCE.skills.classDamage);
    expect(m.damage('lightning')).toBeCloseTo(1 + 3 * BALANCE.skills.classDamage);
    expect(m.damage('fire')).toBe(1);
  });

  it('never stretches a strong slow with a weaker one', () => {
    const b = withSkills(['arcaneIce']);
    const e = enemy(b, 500, 600, 1e9);
    hit(b, 'ice', e, 1);
    const strong = 1 - BALANCE.heroes.ice.slow;
    expect(frac(e.slowFactor)).toBeCloseTo(strong);
    // frost bolts keep landing well past the ice slow's own time
    for (let i = 0; i < ticks(BALANCE.heroes.ice.slowTime + 0.5); i++) hit(b, 'arcane', e, 1);
    expect(frac(e.slowFactor)).toBeCloseTo(1 - BALANCE.skills.frostBoltSlow);
    expect(sec(e.slowTime)).toBeLessThanOrEqual(BALANCE.skills.frostBoltTime);
  });

  it('lets the arcane mark wear off', () => {
    const b = withSkills(['arcaneMark']);
    const e = enemy(b, 500, 600, 1e6);
    hit(b, 'arcane', e, 100);
    for (let i = 0; i < ticks(BALANCE.skills.markTime + 0.1); i++) b.step();
    const before = e.hp;
    hit(b, 'ice', e, 100);
    expect(u(before - e.hp)).toBeCloseTo(100);
  });

  it('marks make poison and burn ticks hurt more too', () => {
    const b = withSkills(['arcaneMark']);
    const poisoned = enemy(b, 500, 600, 1e6);
    const burning = enemy(b, 800, 600, 1e6);
    for (const e of [poisoned, burning]) e.markTime = ticks(10);
    poisoned.poisonDps = toFp(60);
    poisoned.poisonTime = ticks(10);
    burning.burnDps = toFp(60);
    burning.burnTime = ticks(10);
    b.step();
    expect(1e6 - u(poisoned.hp)).toBeCloseTo((60 / TICK_RATE) * (1 + BALANCE.skills.arcaneMark));
    expect(1e6 - u(burning.hp)).toBeCloseTo((60 / TICK_RATE) * (1 + BALANCE.skills.arcaneMark));
  });

  it('lets static wear off, and fire splash sets it off', () => {
    const b = withSkills(['lightningStatic']);
    const old = enemy(b, 500, 600, 1e6);
    hit(b, 'lightning', old, 100);
    for (let i = 0; i < ticks(BALANCE.skills.staticTime + 0.1); i++) b.step();
    expect(old.charge).toBe(0);
    b.enemies = [];
    const e = enemy(b, 500, 600, 1e6);
    hit(b, 'lightning', e, 100);
    const before = e.hp;
    hit(b, 'fire', e, 10);
    expect(u(before - e.hp)).toBeCloseTo(10 + 100 * BALANCE.skills.lightningStatic);
  });

  it('splits only once, even when the split bolts kill', () => {
    const b = withSkills(['arcaneSplit']);
    const victim = enemy(b, 500, 600, 50);
    const a = enemy(b, 600, 600, 10);
    const c = enemy(b, 400, 600, 10);
    const d = enemy(b, 700, 600, 1e6); // next to a: a second split would reach it
    hit(b, 'arcane', victim, 100);
    let splits = 0;
    const seen = new Set<number>();
    for (let i = 0; i < TICK_RATE; i++) {
      for (const p of b.projectiles) if (p.split && !seen.has(p.id)) (seen.add(p.id), splits++);
      b.step();
    }
    expect(b.enemies).not.toContain(a);
    expect(b.enemies).not.toContain(c);
    expect(splits).toBe(BALANCE.skills.splitBolts);
    expect(d.hp).toBe(toFp(1e6));
  });

  it('counts a frozen enemy as chilled for superconduct', () => {
    const b = withSkills(['iceLightning']);
    const e = enemy(b, 500, 600, 1e6);
    e.freezeTime = ticks(1);
    hit(b, 'lightning', e, 100);
    expect(u(e.hp)).toBeCloseTo(1e6 - 100 * (1 + BALANCE.skills.superconduct));
  });

  it('stops frostbite stacking while frozen, and lets the stacks wear off', () => {
    const b = withSkills(['iceFrostbite']);
    const e = enemy(b, 500, 600, 1e6);
    e.freezeTime = ticks(1);
    hit(b, 'ice', e, 1);
    expect(e.chill).toBe(0);
    e.freezeTime = 0;
    hit(b, 'ice', e, 1);
    expect(e.chill).toBe(1);
    for (let i = 0; i < ticks(BALANCE.skills.frostbiteTime + 0.1); i++) b.step();
    expect(e.chill).toBe(0);
  });

  it('lets a plasma kill set off the fire chain blast', () => {
    const near = (skills: SkillId[]) => {
      const b = withSkills(skills);
      enemy(b, 500, 600, 50);
      const n = enemy(b, 560, 600, 1e6);
      hit(b, 'lightning', b.enemies[0], 100);
      return 1e6 - u(n.hp);
    };
    expect(near(['lightningFire', 'fireChain']) - near(['lightningFire'])).toBeCloseTo(100 * BALANCE.skills.fireChain);
  });

  it('shatters on: a frozen enemy killed by shards shatters too', () => {
    const b = withSkills(['iceShatter']);
    const victim = enemy(b, 500, 600, 50);
    const mid = enemy(b, 600, 600, 1);
    mid.maxHp = toFp(100);
    const far = enemy(b, 740, 600, 1e6); // out of the first burst's reach
    victim.freezeTime = ticks(1);
    mid.freezeTime = ticks(1);
    hit(b, 'arcane', victim, 100);
    b.step();
    expect(b.enemies).not.toContain(mid);
    expect(u(far.hp)).toBeCloseTo(1e6 - 100 * BALANCE.skills.shatter);
  });

  it('starts the sky-strike count over for a merged hero', () => {
    const b = withSkills(['lightningStrike']);
    const open = b.slots.map((_, i) => i).filter((i) => b.isOpen(i));
    const [s0, s1] = open;
    b.slots[s0] = { id: 77, kind: 'lightning', star: 1, slot: s0, cooldown: 0 };
    b.slots[s1] = { id: 78, kind: 'lightning', star: 1, slot: s1, cooldown: 0 };
    enemy(b, 500, 600, 1e9);
    const counts = (b as unknown as { shotCount: Map<number, number> }).shotCount;
    for (let i = 0; i < TICK_RATE * 3 && !(counts.has(77) && counts.has(78)); i++) b.step();
    expect(counts.has(77) && counts.has(78)).toBe(true);
    expect(b.move(s0, s1)).toBe(true);
    expect(counts.has(77) || counts.has(78)).toBe(false);
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
