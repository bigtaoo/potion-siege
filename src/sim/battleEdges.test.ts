// The edges of the battle's commands (battle.ts): the summons to the next cell, the getters, the
// once-per-offer reroll and its refusal, a choice not on offer, the wall repair, and a revive
// only after a loss. Pinned by mutation testing (ref/mutation-sim.md).

import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { pm, TICK_RATE, times } from './math/fixed';
import { BALANCE } from './types';

const C = BALANCE.commander;
const S = BALANCE.skills;

describe('battle edges', () => {
  it('counts the summons to the next cell until every cell is built', () => {
    const b = new Battle(1);
    expect(b.summonsToNextCell()).toBe(C.summonsPerCell);
    expect(b.commanderLevel).toBe(1);
    b.built = C.extraCells - 1;
    expect(b.summonsToNextCell()).not.toBeNull();
    b.built = C.extraCells;
    expect(b.summonsToNextCell()).toBeNull();
    expect(b.commanderLevel).toBe(1 + C.extraCells);
  });

  it('tells the seconds played', () => {
    const b = new Battle(1);
    b.time = 3 * TICK_RATE;
    expect(b.seconds).toBe(3);
  });

  it('rerolls an offer once, and only while there is one', () => {
    const b = new Battle(1);
    expect(b.canReroll()).toBe(false);
    expect(b.apply({ type: 'noReroll' })).toBe(false);
    b.choices = ['wallRepair'];
    expect(b.canReroll()).toBe(true);
    expect(b.apply({ type: 'noReroll' })).toBe(true);
    expect(b.canReroll()).toBe(false);
    expect(b.reroll()).toBe(false);
    expect(b.choices).toEqual(['wallRepair']);
  });

  it('rerolls to other cards', () => {
    const b = new Battle(1);
    b.choices = null;
    b.gold = 1e9;
    expect(b.upgrade()).toBe(true);
    const first = [...b.choices!];
    expect(b.reroll()).toBe(true);
    // the ones it replaces only come back when there are too few others
    expect(b.choices!.some((id) => !first.includes(id))).toBe(true);
  });

  it('takes no card that is not on offer', () => {
    const b = new Battle(1);
    b.choices = ['wallRepair'];
    expect(b.choose('lightningChain')).toBe(false);
    expect(b.choices).toEqual(['wallRepair']);
    expect(b.skills.lightningChain).toBe(0);
  });

  it('repairs the wall up to its new height', () => {
    const half = new Battle(1);
    const max = half.wallMax;
    half.wall = Math.floor(max / 2);
    half.choices = ['wallRepair'];
    half.choose('wallRepair');
    const grown = times(max, 1000 + pm(S.wallMax));
    expect(half.wallMax).toBe(grown);
    expect(half.wall).toBe(Math.min(grown, Math.floor(max / 2) + times(grown, pm(S.wallRepair))));
    expect(half.wall).toBeLessThan(grown);
    const full = new Battle(1);
    full.choices = ['wallRepair'];
    full.choose('wallRepair');
    expect(full.wall).toBe(full.wallMax);
  });

  it('revives only a lost battle', () => {
    const b = new Battle(1);
    expect(b.revive()).toBe(false);
    expect(b.result).toBeNull();
  });
});
