import { describe, expect, it } from 'vitest';
import { Battle, SLOT_COUNT, WALL_ROW } from './battle';
import { botAct, playOut } from './bot';
import { FP, TICK_RATE, ticks, toFp } from './math/fixed';
import { skillHeroes } from './skills';
import { BALANCE, type Enemy, HERO_KINDS, type HeroKind, LINEUP, type Projectile } from './types';
import type { Spawn } from './waves';

/** The first cell of the wall row, open from the start. */
const W = WALL_ROW * BALANCE.grid.cols;

/** A grunt standing still at (x, y) with `hp` hit points, all in world units. */
function grunt(id: number, x: number, y: number, hp: number): Enemy {
  [x, y, hp] = [toFp(x), toFp(y), toFp(hp)];
  return {
    id, kind: 'grunt', x, y, px: x, py: y, hp, maxHp: hp, speed: 0, radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
    markTime: 0, chill: 0, chillTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000,
  };
}

/** A shot of `kind` already on `target` (`damage` in world units), landing on the next tick. */
function shot(kind: HeroKind, target: Enemy, damage: number): Projectile {
  const { x, y } = target;
  return { id: 1, kind, star: 1, x, y, px: x, py: y, targetId: target.id, tx: x, ty: y, damage: toFp(damage) };
}

/** Hit points back in world units. */
const u = (v: number) => v / FP;

describe('Battle', () => {
  it('summons onto a free open slot and raises the cost', () => {
    const b = new Battle(1);
    const cost = b.summonCost();
    expect(b.summon()).toBe(true);
    expect(b.gold).toBe(BALANCE.startGold - cost);
    expect(b.summonCost()).toBeGreaterThan(cost);
    expect(b.slots.filter(Boolean)).toHaveLength(1);
  });

  it('refuses to summon without gold or a free slot', () => {
    const b = new Battle(1);
    b.gold = 0;
    expect(b.summon()).toBe(false);
    b.gold = 1e9;
    while (b.freeSlots().length > 0) expect(b.summon()).toBe(true);
    expect(b.summon()).toBe(false);
  });

  it('starts with only the wall row open and builds connected cells as it summons', () => {
    const C = BALANCE.commander;
    for (let seed = 1; seed <= 20; seed++) {
      const b = new Battle(seed);
      const cols = BALANCE.grid.cols;
      const open = () => Array.from({ length: SLOT_COUNT }, (_, s) => s).filter((s) => b.isOpen(s));
      expect(open()).toEqual(Array.from({ length: cols }, (_, i) => WALL_ROW * cols + i));
      b.gold = 1e9;
      const built: number[] = [];
      let last = false;
      for (let i = 0; i < C.summonsPerCell * (C.extraCells + 2); i++) {
        // keep room on the grid so summoning never stalls
        if (b.freeSlots().length === 0) b.slots.fill(null);
        expect(b.summon()).toBe(true);
        for (const ev of b.drain()) {
          if (ev.type !== 'cellOpen') continue;
          // every new cell stands on one that was already open
          expect(b.isOpen(ev.slot + cols)).toBe(true);
          built.push(ev.slot);
          last = ev.last;
        }
      }
      expect(built).toHaveLength(C.extraCells);
      expect(last).toBe(true);
      expect(b.summonsToNextCell()).toBeNull();
      expect(open()).toHaveLength(cols + C.extraCells);
    }
  });

  it('will not move a hero onto a closed cell', () => {
    const b = new Battle(1);
    const closed = Array.from({ length: SLOT_COUNT }, (_, s) => s).find((s) => !b.isOpen(s))!;
    b.slots[W] = { id: 100, kind: 'arcane', star: 1, slot: W, cooldown: 0 };
    expect(b.move(W, closed)).toBe(false);
    expect(b.slots[W]).not.toBeNull();
  });

  it('leaves the enemies to the potions: the commander never shoots', () => {
    const b = new Battle(6);
    b.enemies.push(grunt(999, 500, 600, 1e6));
    for (let i = 0; i < 60; i++) b.step();
    expect(b.enemies.find((e) => e.id === 999)!.hp).toBe(toFp(1e6));
  });

  it('has a lineup of known heroes', () => {
    expect(LINEUP.length).toBe(4);
    for (const kind of LINEUP) expect(HERO_KINDS).toContain(kind);
  });

  it('summons only level-1 lineup heroes onto open cells', () => {
    const b = new Battle(2);
    b.gold = 1e9;
    while (b.summon()) {
      /* fill the grid */
    }
    const heroes = b.slots.filter((h) => h !== null);
    expect(heroes.length).toBeGreaterThan(BALANCE.grid.cols);
    for (const h of heroes) expect(h.star === 1 && LINEUP.includes(h.kind) && b.isOpen(h.slot)).toBe(true);
  });

  it('merges into a random lineup hero one level up', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const b = new Battle(seed);
      b.slots[W] = { id: 100, kind: 'fire', star: 2, slot: W, cooldown: 0 };
      b.slots[W + 1] = { id: 101, kind: 'fire', star: 2, slot: W + 1, cooldown: 0 };
      expect(b.move(W, W + 1)).toBe(true);
      expect(b.slots[W + 1]?.star).toBe(3);
      expect(LINEUP).toContain(b.slots[W + 1]?.kind);
      kinds.add(b.slots[W + 1]!.kind);
    }
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('merges two equal heroes into one a level higher, and moves onto free cells', () => {
    const b = new Battle(1);
    b.slots[W] = { id: 100, kind: 'arcane', star: 1, slot: W, cooldown: 0 };
    b.slots[W + 1] = { id: 101, kind: 'arcane', star: 1, slot: W + 1, cooldown: 0 };
    b.slots[W + 2] = { id: 102, kind: 'fire', star: 2, slot: W + 2, cooldown: 0 };
    expect(b.move(W, W + 2)).toBe(false);
    expect(b.move(W, W + 1)).toBe(true);
    expect(b.slots[W]).toBeNull();
    expect(b.slots[W + 1]?.star).toBe(2);
    expect(b.move(W + 1, W + 5)).toBe(true);
    expect(b.slots[W + 5]?.slot).toBe(W + 5);
  });

  it('offers a skill for the new ultimate hero', () => {
    const top = BALANCE.maxStar;
    const b = new Battle(3);
    b.slots[W] = { id: 100, kind: 'fire', star: top - 1, slot: W, cooldown: 0 };
    b.slots[W + 1] = { id: 101, kind: 'fire', star: top - 1, slot: W + 1, cooldown: 0 };
    expect(b.move(W, W + 1)).toBe(true);
    expect(b.slots[W + 1]?.star).toBe(top);
    expect(b.choiceReason).toBe('ultimate');
    expect(b.choices?.length).toBeGreaterThan(0);
    expect(b.move(W + 1, W + 2)).toBe(false);
    expect(b.canMerge(W + 1, W + 1)).toBe(false);
  });

  it('sells skill offers for rising gold and pauses until one is chosen', () => {
    const b = new Battle(3);
    b.summon();
    const U = BALANCE.upgrade;
    b.gold = U.costs[0] - 1;
    expect(b.upgrade()).toBe(false);
    b.gold = 1e6;
    expect(b.upgrade()).toBe(true);
    expect(b.gold).toBe(1e6 - U.costs[0]);
    expect(b.upgradeCost()).toBe(U.costs[1]);
    expect(b.choiceReason).toBe('upgrade');
    expect(b.choices?.length).toBeGreaterThan(0);
    expect(b.upgrade()).toBe(false);
    const time = b.time;
    b.step();
    expect(b.time).toBe(time);
    // one reroll per offer, and it brings other cards while there are others to bring
    const first = [...b.choices!];
    expect(b.reroll()).toBe(true);
    expect(b.choices!.some((id) => !first.includes(id))).toBe(true);
    expect(b.reroll()).toBe(false);
    b.choose(b.choices![0]);
    expect(b.choices).toBeNull();
    expect(b.canReroll()).toBe(false);
    expect(b.upgrades).toBe(1);
    b.upgrades = U.costs.length + 1;
    expect(b.upgradeCost()).toBe(U.costs[U.costs.length - 1] + 2 * U.costStep);
  });

  it('loses when the wall falls and can be revived once', () => {
    const b = new Battle(5);
    b.wall = 1;
    for (let i = 0; i < 2000 && !b.result; i++) b.step();
    expect(b.result).toBe('lost');
    b.revive();
    expect(b.result).toBeNull();
    expect(b.wall).toBeGreaterThan(0);
  });

  it('is reproducible from its seed', () => {
    const a = playOut(42);
    const c = playOut(42);
    expect([a.wave, a.kills, a.result]).toEqual([c.wave, c.kills, c.result]);
  });

  it('sends the same enemies on a seed whatever the player does', () => {
    // each enemy as it comes in: kind, place, speed, hit points (ids are shared with the heroes)
    const arrivals = (act: (b: Battle) => void) => {
      const b = new Battle(42);
      const seen = new Set<number>();
      const out: string[] = [];
      for (let t = 0; t < 600 * TICK_RATE && b.result === null; t++) {
        act(b);
        b.step();
        b.drain();
        for (const e of b.enemies) if (!seen.has(e.id)) (seen.add(e.id), out.push(`${e.kind} ${e.x} ${e.speed} ${e.maxHp}`));
      }
      return out;
    };
    const idle = arrivals(() => {});
    const played = arrivals(botAct);
    expect(idle.length).toBeGreaterThan(20);
    expect(played.length).toBeGreaterThan(idle.length);
    expect(played.slice(0, idle.length)).toEqual(idle);
  });

  it('rolls the same summons on a seed however long the player waits for them', () => {
    // by 10 s the commander has been shooting (and rolling crits) at wave 1 for a while
    const opening = (wait: number) => {
      const b = new Battle(42);
      for (let t = 0; t < wait * TICK_RATE; t++) b.step();
      b.summon();
      b.summon();
      return b.slots.flatMap((h) => (h ? [`${h.slot} ${h.kind}`] : []));
    };
    expect(opening(10)).toEqual(opening(0));
  });

  it('lets a simple bot get well into the run', () => {
    const b = playOut(7);
    expect(b.wave).toBeGreaterThanOrEqual(6);
  });
});

describe('damage dealt', () => {
  /** No waves, so only the test's own shots land. */
  function quiet(): Battle {
    const b = new Battle(5);
    b.enemies = [];
    return b;
  }

  function enemy(b: Battle, x: number, y: number, hp: number): Enemy {
    const e = grunt(9000 + b.enemies.length, x, y, hp);
    b.enemies.push(e);
    return e;
  }

  /** A projectile of `kind` already on `target`, landing on the next step. */
  function hit(b: Battle, kind: HeroKind, target: Enemy, damage: number): void {
    b.projectiles.push(shot(kind, target, damage));
    b.step();
  }

  it('credits the fire splash on every enemy it reaches', () => {
    const b = quiet();
    const a = enemy(b, 500, 400, 1000);
    enemy(b, 540, 400, 1000);
    hit(b, 'fire', a, 100);
    expect(u(b.dealt.fire)).toBeCloseTo(200);
  });

  it('credits poison with its ticks', () => {
    const b = quiet();
    const e = enemy(b, 500, 400, 1e6);
    hit(b, 'poison', e, 10);
    for (let i = 0; i < TICK_RATE; i++) b.step();
    expect(u(b.dealt.poison)).toBeGreaterThan(10 + BALANCE.heroes.poison.poisonDps * 0.9);
  });

  it('credits lightning with its chain jumps', () => {
    const b = quiet();
    const a = enemy(b, 500, 400, 1e6);
    enemy(b, 560, 400, 1e6);
    enemy(b, 620, 400, 1e6);
    hit(b, 'lightning', a, 100);
    expect(u(b.dealt.lightning)).toBeGreaterThan(100 + 100 * BALANCE.heroes.lightning.chainFalloff * 0.99);
  });

  it('leaves out overkill and the commander', () => {
    const b = quiet();
    hit(b, 'arcane', enemy(b, 500, 400, 10), 1000);
    expect(u(b.dealt.arcane)).toBeCloseTo(10);
    enemy(b, 500, 400, 1e6);
    b.charge = BALANCE.commander.charge;
    expect(b.cast()).toBe(true);
    for (let i = 0; i < 60; i++) b.step();
    expect(HERO_KINDS.reduce((a, k) => a + b.dealt[k], 0)).toBe(b.dealt.arcane);
    expect(u(b.dealt.arcane)).toBeCloseTo(10);
  });

  it('never credits more than the enemies lost', () => {
    const b = new Battle(11);
    LINEUP.forEach((kind, i) => (b.slots[W + i] = { id: 500 + i, kind, star: 3, slot: W + i, cooldown: 0 }));
    const credited = () => HERO_KINDS.reduce((a, k) => a + b.dealt[k], 0);
    let lost = 0;
    // an enemy can come in and die in the same step (a splash already in flight), so what
    // spawns counts too: the hit points that left the wave plan less those still standing
    const pending = () => (b as unknown as { pending: Spawn[] }).pending;
    for (let i = 0; i < 900 && !b.paused && !b.result; i++) {
      const before = new Map(b.enemies.map((e) => [e.id, Math.max(0, e.hp)]));
      const planned = new Set(pending());
      b.step();
      const after = new Map(b.enemies.map((e) => [e.id, Math.max(0, e.hp)]));
      for (const [id, hp] of before) lost += hp - (after.get(id) ?? 0);
      const left = new Set(pending());
      for (const s of planned) if (!left.has(s)) lost += s.hp;
      for (const e of b.enemies) if (!before.has(e.id)) lost -= Math.max(0, e.hp);
    }
    expect(credited()).toBeGreaterThan(0);
    expect(credited()).toBeLessThanOrEqual(lost);
  });
});

describe('rust', () => {
  const P = BALANCE.heroes.poison;

  function rig(): { b: Battle; e: Enemy } {
    const b = new Battle(5);
    b.enemies = [];
    const e = grunt(9000, 500, 400, 1e6);
    b.enemies.push(e);
    return { b, e };
  }

  function shoot(b: Battle, kind: HeroKind, e: Enemy, damage: number): void {
    b.projectiles.push(shot(kind, e, damage));
    b.step();
  }

  it('stacks one rust per corrosion hit up to the cap', () => {
    const { b, e } = rig();
    for (let i = 1; i <= P.rustMax + 2; i++) {
      shoot(b, 'poison', e, 1);
      expect(e.rust).toBe(Math.min(i, P.rustMax));
    }
  });

  it('wears off once the corrosion stops', () => {
    const { b, e } = rig();
    shoot(b, 'poison', e, 1);
    for (let i = 0; i < ticks(P.rustTime + 0.5); i++) b.step();
    expect(e.rust).toBe(0);
  });

  it('makes every hit land harder, on top of the arcane mark', () => {
    const { b, e } = rig();
    e.rust = 3;
    e.rustTime = ticks(99);
    let before = e.hp;
    shoot(b, 'arcane', e, 100);
    expect(u(before - e.hp)).toBeCloseTo(100 * (1 + P.rustStep * 3));
    // one Arcane Mark level, taken as an offered skill
    b.choices = ['arcaneMark'];
    b.choose('arcaneMark');
    e.markTime = ticks(99);
    before = e.hp;
    shoot(b, 'arcane', e, 100);
    expect(u(before - e.hp)).toBeCloseTo(100 * (1 + BALANCE.skills.arcaneMark) * (1 + P.rustStep * 3));
  });
});

describe('lineup', () => {
  const lineup: HeroKind[] = ['poison', 'fire', 'ice', 'lightning'];
  const setup = { ...new Battle(1).setup, lineup };

  it('summons and merges only from the lineup it was given', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const b = new Battle(seed, setup);
      b.gold = 1e9;
      while (b.summon()) {
        /* fill the grid */
      }
      b.slots[W] = { id: 100, kind: 'fire', star: 2, slot: W, cooldown: 0 };
      b.slots[W + 1] = { id: 101, kind: 'fire', star: 2, slot: W + 1, cooldown: 0 };
      b.move(W, W + 1);
      for (const h of b.slots) if (h) expect(lineup).toContain(h.kind);
    }
  });

  it('offers skills only for potions on the field', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const b = new Battle(seed, setup);
      b.summon();
      b.gold = 1e6;
      b.upgrade();
      for (const id of b.choices ?? []) {
        const { hero, with: also } = skillHeroes(id);
        expect(hero === 'arcane' || also === 'arcane').toBe(false);
      }
    }
  });
});

describe('commander skills', () => {
  const C = BALANCE.commander;

  /** No waves, a full charge. */
  function charged(): Battle {
    const b = new Battle(5);
    (b as unknown as { pending: Spawn[] }).pending = [];
    b.enemies = [];
    b.charge = C.charge;
    return b;
  }

  it('charges one a kill and a boss more, up to full', () => {
    const b = new Battle(5);
    (b as unknown as { pending: Spawn[] }).pending = [];
    b.enemies = [grunt(1, 500, 400, 1)];
    b.projectiles.push(shot('arcane', b.enemies[0], 10));
    b.step();
    expect(b.charge).toBe(1);
    expect(b.canCast()).toBe(false);
    expect(b.cast()).toBe(false);
    const boss = grunt(2, 500, 400, 1);
    boss.kind = 'boss';
    b.enemies.push(boss);
    b.charge = C.charge - 2;
    b.projectiles.push(shot('arcane', boss, 10));
    b.step();
    expect(b.charge).toBe(C.charge);
  });

  it('comes back from the revive with the wall whole and the bomb ready', () => {
    const b = new Battle(5);
    (b as unknown as { pending: Spawn[] }).pending = [];
    const boss = grunt(2, 500, 400, 1e6);
    boss.kind = 'boss';
    b.enemies = [grunt(1, 300, 1900, 1e6), boss]; // the grunt at the wall
    b.charge = 3;
    b.wall = 1;
    for (let i = 0; i < 2000 && !b.result; i++) b.step();
    expect(b.result).toBe('lost');
    expect(b.revive()).toBe(true);
    expect(b.result).toBeNull();
    expect(b.wall).toBe(b.wallMax);
    expect(b.enemies.map((e) => e.kind)).toEqual(['boss']);
    expect(b.charge).toBe(C.charge);
    expect(b.canCast()).toBe(true);
  });

  it('throws the flask into the thick of them, then brews, in turn', () => {
    const b = charged();
    b.slots[W] = { id: 100, kind: 'arcane', star: 2, slot: W, cooldown: 1e9 };
    const lone = grunt(1, 200, 700, 1e6);
    const pack = [grunt(2, 700, 400, 1e6), grunt(3, 740, 420, 1e6), grunt(4, 680, 450, 1e6)];
    b.enemies.push(lone, ...pack);
    expect(b.nextCast).toBe('bomb');
    expect(b.cast()).toBe(true);
    expect(b.charge).toBe(0);
    const cast = b.drain().find((e) => e.type === 'cast');
    expect(cast).toMatchObject({ skill: 'bomb' });
    // nothing lands until the flask has flown
    b.step();
    expect(pack[0].hp).toBe(toFp(1e6));
    for (let i = 0; i < ticks(C.bomb.flight); i++) b.step();
    const H = BALANCE.heroes.arcane;
    const dps = (H.damage * BALANCE.starDamage[1] * BALANCE.starSpeed[1]) / H.interval;
    for (const e of pack) {
      expect(1e6 - u(e.hp)).toBeCloseTo(Math.max(C.bomb.min, dps * C.bomb.seconds), 0);
      expect(e.slowTime).toBeGreaterThan(0);
    }
    expect(lone.hp).toBe(toFp(1e6));

    b.charge = C.charge;
    expect(b.nextCast).toBe('brew');
    expect(b.cast()).toBe(true);
    expect(b.brewTime).toBe(ticks(C.brew.time));
    expect(b.nextCast).toBe('bomb');
  });

  it('throws faster while the brew lasts', () => {
    const shots = (brew: boolean): number => {
      const b = charged();
      b.slots[W] = { id: 100, kind: 'arcane', star: 1, slot: W, cooldown: 0 };
      b.enemies.push(grunt(1, 500, 400, 1e9));
      b.casts = 1;
      if (!brew) b.charge = 0;
      else expect(b.cast()).toBe(true);
      let n = 0;
      for (let i = 0; i < ticks(C.brew.time); i++) {
        b.step();
        n += b.drain().filter((e) => e.type === 'shot').length;
      }
      return n;
    };
    expect(shots(true) / shots(false)).toBeCloseTo(1 + C.brew.speed, 0);
    expect(shots(true)).toBeGreaterThan(shots(false));
  });

  it('casts by itself once the charge has waited, but only with something to throw at', () => {
    const b = charged();
    for (let i = 0; i < ticks(C.autoCast) + 5; i++) b.step();
    expect(b.casts).toBe(0);
    b.enemies.push(grunt(1, 500, 400, 1e6));
    b.step();
    expect(b.casts).toBe(1);
    expect(b.charge).toBe(0);
  });

  it('replays a tapped cast', () => {
    const b = charged();
    b.enemies.push(grunt(1, 500, 400, 1e6));
    b.cast();
    expect(b.commands[b.commands.length - 1]).toMatchObject({ type: 'cast' });
  });
});
