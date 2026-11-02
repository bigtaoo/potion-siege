// The commander's spells (commander.ts): its charge from kills, the revive, the three spells in
// turn, the self-cast, and a tapped cast in the replay. Where a cast lands is castPoint.test.ts,
// what each spell does spells.test.ts.

import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { charged, grunt } from './commanderKit';
import { ticks, toFp } from './math/fixed';
import { BALANCE, type Enemy, type HeroKind, type Projectile } from './types';
import type { Spawn } from './waves';

/** A shot of `kind` already on `target` (`damage` in world units), landing on the next tick. */
function shot(kind: HeroKind, target: Enemy, damage: number): Projectile {
  const { x, y } = target;
  return { id: 1, kind, star: 1, x, y, px: x, py: y, targetId: target.id, tx: x, ty: y, damage: toFp(damage) };
}

describe('commander skills', () => {
  const C = BALANCE.commander;

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

  it('casts the bomb, the frost and the acid in turn, the badge knowing which is next', () => {
    const b = charged();
    b.enemies.push(grunt(1, 500, 600, 1e6));
    const cast: string[] = [];
    for (let i = 0; i < 4; i++) {
      cast.push(b.nextCast);
      b.charge = C.charge;
      expect(b.cast()).toBe(true);
      expect(b.charge).toBe(0);
      expect(b.drain().find((e) => e.type === 'cast')).toMatchObject({ skill: cast[i], how: 'tap' });
    }
    expect(cast).toEqual(['bomb', 'frost', 'acid', 'bomb']);
    expect(b.casts).toBe(4);
  });

  it('casts by itself once the charge has waited, but only with something to throw at', () => {
    // an empty field calls in the next wave at once (waves.callAt): keep it empty
    const callAt = BALANCE.waves.callAt;
    BALANCE.waves.callAt = -1;
    try {
      const b = charged();
      for (let i = 0; i < ticks(C.autoCast) + 5; i++) b.step();
      expect(b.casts).toBe(0);
      b.enemies.push(grunt(1, 500, 400, 1e6));
      b.step();
      expect(b.casts).toBe(1);
      expect(b.charge).toBe(0);
      expect(b.drain().find((e) => e.type === 'cast')).toMatchObject({ how: 'auto' });
    } finally {
      BALANCE.waves.callAt = callAt;
    }
  });

  it('replays a tapped cast', () => {
    const b = charged();
    b.enemies.push(grunt(1, 500, 400, 1e6));
    b.cast();
    expect(b.commands[b.commands.length - 1]).toMatchObject({ type: 'cast' });
  });
});
