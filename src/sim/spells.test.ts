// What each of the commander's spells does where it lands (spells.ts): the bomb's blow sized by
// the board and its knock back, the frost's freeze (a boss or a flyer only slowed), and the acid
// pool eating at and slowing what walks in it until it dries up.

import { describe, expect, it } from 'vitest';
import type { Battle } from './battle';
import { arcaneDps, charged, grunt } from './commanderKit';
import { FP, ticks, toFp } from './math/fixed';
import { BALANCE, type CommanderSkill, type Enemy } from './types';

const C = BALANCE.commander;
/** Hit points back in world units. */
const u = (v: number) => v / FP;

/** `b` casts `skill` at (x, y) in world units, and the flask comes down. */
function castAt(b: Battle, skill: CommanderSkill, x: number, y: number): void {
  b.casts = ['bomb', 'frost', 'acid'].indexOf(skill);
  b.charge = C.charge;
  expect(b.cast({ x: toFp(x), y: toFp(y) })).toBe(true);
  for (let i = 0; i < ticks(C.flight); i++) b.step();
}

describe('spells', () => {
  it('bursts the bomb on all in reach for two seconds of the board, and knocks them back', () => {
    const b = charged();
    const pack = [grunt(1, 500, 800, 1e6), grunt(2, 560, 820, 1e6)];
    const far = grunt(3, 500, 800 + C.bomb.radius + 60, 1e6);
    b.enemies.push(...pack, far);
    castAt(b, 'bomb', 520, 800);
    for (const e of pack) {
      expect(1e6 - u(e.hp)).toBeCloseTo(Math.max(C.bomb.min, arcaneDps() * C.bomb.seconds), 0);
      expect(u(e.y)).toBeLessThan(800);
    }
    expect(u(pack[0].y)).toBe(800 - C.bomb.push);
    expect(far.hp).toBe(toFp(1e6));
    const ev = b.drain().find((e) => e.type === 'flask');
    expect(ev).toMatchObject({ skill: 'bomb', how: 'drag', radius: C.bomb.radius });
    expect(ev && ev.type === 'flask' && ev.hits).toHaveLength(2);
  });

  it('does not push a boss, nor one still coming in past the top', () => {
    const b = charged();
    const boss = grunt(1, 500, 800, 1e6);
    boss.kind = 'boss';
    const top = grunt(2, 300, BALANCE.field.top - 40, 1e6);
    b.enemies.push(boss, top);
    castAt(b, 'bomb', 500, 800);
    expect(u(boss.y)).toBe(800);
    b.charge = C.charge;
    castAt(b, 'bomb', 300, BALANCE.field.top);
    expect(u(top.y)).toBe(BALANCE.field.top - 40);
  });

  it('freezes what it catches, but only slows a boss or a flyer by half', () => {
    const b = charged();
    const g = grunt(1, 500, 800, 1e6);
    const boss = grunt(2, 560, 800, 1e6);
    boss.kind = 'boss';
    const flyer = grunt(3, 440, 800, 1e6);
    flyer.kind = 'flyer';
    flyer.x0 = flyer.x;
    flyer.phase = 0;
    b.enemies.push(g, boss, flyer);
    castAt(b, 'frost', 500, 800);
    expect(g.freezeTime).toBe(ticks(C.frost.time));
    for (const e of [boss, flyer]) {
      expect(e.freezeTime).toBe(0);
      expect(e.slowFactor).toBe(1000 - C.frost.bossSlow * 1000);
      expect(e.slowTime).toBe(ticks(C.frost.time));
    }
    expect(g.hp).toBe(toFp(1e6));
    const ev = b.drain().find((e) => e.type === 'flask');
    expect(ev && ev.type === 'flask' && ev.hits.every((h) => h.damage === 0)).toBe(true);
  });

  it('leaves an acid pool that eats a quarter of the board a second and slows, then dries up', () => {
    const b = charged();
    const inside = grunt(1, 500, 800, 1e6);
    const outside = grunt(2, 500, 800 + C.acid.radius + 60, 1e6);
    b.enemies.push(inside, outside);
    castAt(b, 'acid', 500, 800);
    expect(b.pools).toHaveLength(1);
    const pool = b.pools[0];
    expect(pool.time).toBe(ticks(C.acid.time));
    for (let i = 0; i < ticks(1); i++) b.step();
    expect(1e6 - u(inside.hp)).toBeCloseTo(arcaneDps() * C.acid.share, 0);
    expect(inside.slowTime).toBeGreaterThan(0);
    expect(inside.slowFactor).toBe(1000 - C.acid.slow * 1000);
    expect(outside.hp).toBe(toFp(1e6));
    for (let i = 0; i < ticks(C.acid.time); i++) b.step();
    expect(b.pools).toHaveLength(0);
    const taken = 1e6 - u(inside.hp);
    expect(taken).toBeCloseTo(arcaneDps() * C.acid.share * C.acid.time, -1);
    b.step();
    expect(1e6 - u(inside.hp)).toBe(taken);
  });

  it('catches one walking into a pool laid ahead of it', () => {
    const b = charged();
    const walker: Enemy = grunt(1, 500, 400, 1e6);
    walker.speed = toFp(120) / 30;
    b.enemies.push(walker);
    castAt(b, 'acid', 500, 800);
    expect(walker.hp).toBe(toFp(1e6));
    for (let i = 0; i < ticks(C.acid.time); i++) b.step();
    expect(walker.hp).toBeLessThan(toFp(1e6));
  });
});
