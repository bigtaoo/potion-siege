// The challenge's modifier chips (hudMods.ts): small, down the right edge, and faded away while
// an enemy walks under one.
import './layout/measure';
import { describe, expect, it } from 'vitest';
import { Battle } from '../sim/battle';
import { battleSetup, newMeta } from '../sim/meta';
import type { Enemy } from '../sim/types';
import { MOD_CHIP, MOD_FADE, ModChips } from './hudMods';
import { DESIGN_W } from './viewport';

const same = (p: { x: number; y: number }) => p;

describe('the challenge chips', () => {
  it('are small, one under another at the right edge, and clear with none', () => {
    const m = new ModChips();
    m.show(['swift', 'goldRain'], null);
    expect(m.children.map((c) => [c.x, c.y])).toEqual([
      [DESIGN_W - MOD_CHIP.right, MOD_CHIP.top],
      [DESIGN_W - MOD_CHIP.right, MOD_CHIP.top + MOD_CHIP.step],
    ]);
    // the tile's shadow hangs a little below it
    for (const c of m.children) expect(c.height).toBeLessThanOrEqual(MOD_CHIP.h + 8);
    // a turned field has them in the board's corner, and new ones go there too
    m.place(1400, MOD_CHIP.landTop);
    expect(m.children.map((c) => c.y)).toEqual([MOD_CHIP.landTop, MOD_CHIP.landTop + MOD_CHIP.step]);
    m.show(['cheap'], null);
    expect([m.children[0].x, m.children[0].y]).toEqual([1400, MOD_CHIP.landTop]);
    m.show([], null);
    expect(m.children.length).toBe(0);
  });

  it('fade while an enemy is under one, and come back once it has walked on', () => {
    const m = new ModChips();
    m.show(['swift'], null);
    const b = new Battle(1, battleSetup(newMeta(), 1));
    const chip = m.children[0];
    const r = chip.getBounds();
    b.enemies = [{ x: r.x + r.width / 2, y: r.y + r.height / 2 } as Enemy];
    m.update(b, same, 10);
    expect(chip.alpha).toBe(MOD_FADE.alpha);
    b.enemies[0].y = 900;
    m.update(b, same, 0.05);
    expect(chip.alpha).toBeGreaterThan(MOD_FADE.alpha);
    expect(chip.alpha).toBeLessThan(1);
    m.update(b, same, 10);
    expect(chip.alpha).toBe(1);
  });
});
