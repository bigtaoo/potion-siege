import { describe, expect, it } from 'vitest';
import { Battle, SLOT_COUNT, WALL_ROW } from './battle';
import { playOut } from './bot';
import { BALANCE, HERO_KINDS, LINEUP } from './types';

/** The first cell of the wall row, open from the start. */
const W = WALL_ROW * BALANCE.grid.cols;

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

  it('lets the commander shoot on its own', () => {
    const b = new Battle(6);
    b.enemies.push({
      id: 999, kind: 'grunt', x: 500, y: 600, hp: 1e6, maxHp: 1e6, speed: 0, radius: 30,
      slowFactor: 1, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0, atWall: false,
    });
    for (let i = 0; i < 60; i++) b.step(1 / 30);
    expect(b.enemies.find((e) => e.id === 999)!.hp).toBeLessThan(1e6);
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
    b.step(1);
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
    b.wall = 0.001;
    for (let i = 0; i < 2000 && !b.result; i++) b.step(1 / 30);
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

  it('lets a simple bot get well into the run', () => {
    const b = playOut(7);
    expect(b.wave).toBeGreaterThanOrEqual(6);
  });

  it('counts the damage each potion fires, not the commander', () => {
    const b = new Battle(3);
    b.slots[W] = { id: 999, kind: 'ice', star: 1, slot: W, cooldown: 0 };
    for (let i = 0; i < 600 && !b.paused; i++) b.step(1 / 30);
    expect(b.dealt.ice).toBeGreaterThan(0);
    expect(b.dealt.arcane).toBe(0);
  });
});
