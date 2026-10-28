import { Graphics, Text } from 'pixi.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Battle, slotCenter } from '../sim/battle';
import { endlessSetup } from '../sim/endless';
import { FP } from '../sim/math/fixed';
import { battleSetup, newMeta } from '../sim/meta';
import { BALANCE, type BattleEvent, type HeroKind } from '../sim/types';
import { BattleView } from './BattleView';
import { badgeAt, commanderMid } from './battleView/commander';
import { fakeArt } from './fakeArt';
import { isLand, turnView } from './landView';

beforeAll(fakeArt);

const G = BALANCE.grid;

function stage(b = new Battle(1, battleSetup(newMeta(), 1))) {
  const v = new BattleView();
  v.attach(b);
  return { v, b };
}

/** A hero of `kind` and `star` put straight into `slot`. */
function put(b: Battle, slot: number, kind: HeroKind = 'fire', star = 1) {
  b.open[slot] = true;
  b.slots[slot] = { id: 1000 + slot, kind, star, slot, cooldown: 0 };
  return b.slots[slot]!;
}

/** A pointer event at view point (x, y), the view standing at the origin. */
const at = (x: number, y: number) => ({ global: { x, y } }) as never;
const cell = (s: number) => {
  const c = slotCenter(s);
  return at(c.x, c.y);
};

describe('the battle view before a battle', () => {
  it('draws nothing and shakes by default', () => {
    const v = new BattleView();
    v.update(0.1);
    expect(v.shakes()).toBe(true);
    expect(v.starMark()).toBe(false);
  });

  it('takes touches on the grid and on the commander, nowhere else', () => {
    const v = new BattleView();
    const hit = v.hitArea!;
    const c = slotCenter(4);
    expect(hit.contains(c.x, c.y)).toBe(true);
    const mid = commanderMid();
    expect(hit.contains(mid.x, mid.y)).toBe(true);
    expect(hit.contains(-50, -50)).toBe(false);
  });
});

describe('the battle events the view draws', () => {
  it('turns the bosses and the clockwork army into effects and shakes', () => {
    const { v, b } = stage();
    put(b, 12);
    put(b, 13, 'ice');
    const shake = () => v['shake'];
    const events: BattleEvent[] = [
      { type: 'brood', x: 500, y: 600 },
      { type: 'jar', x: 500, y: 600, up: true },
      { type: 'leap', x: 500, y: 600 },
      { type: 'gust', x: 500, y: 600, depth: 200 },
      { type: 'push', x: 500, y: 600, id: 9999 },
      { type: 'cellOpen', slot: 12, last: true },
    ];
    v.react(events);
    expect(shake()).toBe(0);
    v.react([{ type: 'jar', x: 500, y: 600, up: false }]);
    expect(shake()).toBeCloseTo(0.15);
    v.react([{ type: 'slam', x: 500, y: 900, slots: [12, 13] }]);
    expect(shake()).toBeCloseTo(0.35);
    v.react([{ type: 'crack', x: 500, y: 600 }]);
    expect(shake()).toBeCloseTo(0.4);
    v.react([{ type: 'kill', kind: 'grunt' as never, x: 500, y: 600, gold: 30, boss: true }]);
    expect(shake()).toBeCloseTo(0.5);
    v.react([{ type: 'kill', kind: 'grunt' as never, x: 500, y: 600, gold: 0, boss: true }]);
    for (let i = 0; i < 20; i++) v.update(0.1);
    expect(shake()).toBe(0);
  });

  it('trails the push lines behind an enemy still on the field', () => {
    const b = new Battle(1, battleSetup(newMeta(), 1));
    for (let i = 0; i < 200 && b.enemies.length === 0; i++) b.step();
    const { v } = stage(b);
    const e = b.enemies[0];
    const effect = vi.spyOn(v['fx'], 'effect');
    v.react([{ type: 'push', x: 0, y: 0, id: e.id }]);
    expect(effect).toHaveBeenCalledTimes(1);
    v.update(0.1);
  });

  it('throws from the hand of the figure whose turn it was', () => {
    const { v, b } = stage();
    put(b, 12, 'fire', 2);
    put(b, 13, 'lightning', BALANCE.maxStar);
    v.update(0.1);
    const launch = vi.spyOn(v['shots'], 'launch');
    v.react([
      { type: 'shot', slot: 12, projectile: 1 },
      { type: 'shot', slot: 12, projectile: 2 },
      { type: 'shot', slot: 13, projectile: 3 },
      { type: 'shot', slot: 5, projectile: 4 },
    ]);
    expect(launch).toHaveBeenCalledTimes(2);
  });

  it('changes an endless run’s field when its band changes, and keeps it within one', () => {
    const save = newMeta();
    save.cleared = 30;
    const { v, b } = stage(new Battle(1, endlessSetup(save)));
    const show = vi.spyOn(v['field'], 'show');
    v.react([{ type: 'wave', wave: 2, boss: false }]);
    expect(show).not.toHaveBeenCalled();
    v.react([{ type: 'wave', wave: 1 + BALANCE.endless.chapterEvery, boss: false }]);
    expect(show).toHaveBeenCalledTimes(1);
    expect(b.setup.endless).toBeTruthy();
  });
});

describe('the cells as the view draws them', () => {
  it('rings an ultimate hero, dazes a slammed one and swirls the vortices', () => {
    const { v, b } = stage();
    put(b, 12, 'arcane', BALANCE.maxStar);
    const stunned = put(b, 13, 'ice', 2);
    stunned.stunTime = 30;
    b.vortices.push({ x: 500 * FP, y: 600 * FP, time: 60 } as never);
    v.starMark = () => true;
    v.update(0.1);
    expect((v['grid'] as Graphics).bounds.width).toBeGreaterThan(0);
  });

  it('stands the wall’s numbers in the strip behind a turned bar, and smaller', () => {
    const { v } = stage();
    turnView(v, true);
    try {
      expect(isLand()).toBe(true);
      v.legible(2);
      expect((v['wallText'] as Text).scale.x).toBeCloseTo(1.1);
      v.update(0.1);
    } finally {
      turnView(v, false);
    }
    v.legible(2);
    expect((v['wallText'] as Text).scale.x).toBeCloseTo(1.4);
  });
});

describe('the drags between cells', () => {
  it('moves a dragged potion to an empty cell and lights the cells it can merge with', () => {
    const { v, b } = stage();
    put(b, 12, 'fire', 1);
    b.slots[13] = { id: 2000, kind: 'fire', star: 1, slot: 13, cooldown: 0 };
    b.open[13] = true;
    b.open[14] = true;
    v.emit('pointerdown', cell(12));
    expect(v['dragFrom']).toBe(12);
    v.emit('globalpointermove', at(300, 300));
    expect(v['dragPos']).toMatchObject({ x: 300, y: 300 });
    v.update(0.1);
    v.emit('pointerup', cell(14));
    expect(v['dragFrom']).toBeNull();
    expect(b.slots[14]?.kind).toBe('fire');
  });

  it('merges a pair dropped one on the other, with the merge animation', () => {
    const { v, b } = stage();
    put(b, 12, 'ice', 1);
    b.open[13] = true;
    b.slots[13] = { id: 2000, kind: 'ice', star: 1, slot: 13, cooldown: 0 };
    const drop = vi.spyOn(v['merges'], 'drop');
    v.emit('pointerdown', cell(12));
    v.emit('pointerupoutside', cell(13));
    expect(drop).toHaveBeenCalledTimes(1);
    b.step();
    expect(b.slots[13]?.star).toBe(2);
  });

  it('drops a drag let go off the grid, and ignores empty cells, the ground and a paused battle', () => {
    const { v, b } = stage();
    put(b, 12);
    v.emit('pointerup', cell(12));
    v.emit('globalpointermove', at(1, 1));
    expect(v['dragPos']).toMatchObject({ x: 0, y: 0 });
    v.emit('pointerdown', cell(12));
    v.emit('pointerup', at(-100, -100));
    expect(v['dragFrom']).toBeNull();
    expect(b.slots[12]).not.toBeNull();
    v.emit('pointerdown', cell(0));
    expect(v['dragFrom']).toBeNull();
    v.emit('pointerdown', at(G.x0 + G.cellW * G.cols + 10, G.y0 + 10));
    expect(v['dragFrom']).toBeNull();
    b.choices = ['crit' as never];
    v.emit('pointerdown', cell(12));
    expect(v['dragFrom']).toBeNull();
  });

  it('casts the commander’s skill on a tap on it once it is charged, and not before', () => {
    const { v, b } = stage();
    const badge = badgeAt();
    const cast = vi.spyOn(b, 'cast');
    v.emit('pointerdown', at(badge.x, badge.y));
    expect(cast).not.toHaveBeenCalled();
    vi.spyOn(b, 'canCast').mockReturnValue(true);
    v.emit('pointerdown', at(badge.x, badge.y));
    expect(cast).toHaveBeenCalledTimes(1);
  });
});
