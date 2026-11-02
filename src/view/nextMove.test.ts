import { describe, expect, it } from 'vitest';
import { Battle } from '../sim/battle';
import { TICK_RATE } from '../sim/math/fixed';
import { battleSetup, newMeta } from '../sim/meta';
import { BALANCE, HERO_KINDS } from '../sim/types';
import { EARLY, IDLE_AFTER, NextMove } from './nextMove';

/** A pair of the first hero kind in the first two open cells, the rest of the grid free. */
function pairOnly(b: Battle): void {
  const [a, c] = b.slots.map((_, i) => i).filter((i) => b.isOpen(i));
  for (const [n, slot] of [a, c].entries())
    b.slots[slot] = { id: 100 + n, kind: HERO_KINDS[0], star: 1, slot, cooldown: 0 } as Battle['slots'][number];
}

/** A stage 1 battle set up by `set`, and the hand's rules on it, a first frame in. */
function fresh(early: boolean, set: (b: Battle) => void = () => {}): { b: Battle; m: NextMove } {
  const b = new Battle(1, battleSetup(newMeta(), 1));
  set(b);
  const m = new NextMove();
  m.reset(b);
  m.update(b, early, true, 0);
  return { b, m };
}

describe('the next move in the first battles', () => {
  it('points at a summon a moment after it can be made, not seconds later', () => {
    const { b, m } = fresh(true);
    expect(b.canSummon()).toBe(true);
    expect(m.update(b, true, true, EARLY.show - 0.1)).toBeNull();
    expect(m.update(b, true, true, 0.1)).toBe('summon');
  });

  it('puts 强化 before a pair, and a pair before 召唤', () => {
    const { b, m } = fresh(true, pairOnly);
    expect(m.update(b, true, true, EARLY.show)).toEqual(expect.any(Array));
    b.gold = b.upgradeCost();
    expect(m.update(b, true, true, 0.1)).toBeNull();
    expect(m.update(b, true, true, EARLY.show)).toBe('upgrade');
  });

  it('waits for a second after the player moves before pointing again', () => {
    const { b, m } = fresh(true, (b) => (b.gold = b.summonCost() * 10));
    m.update(b, true, true, EARLY.show);
    b.summon();
    expect(m.update(b, true, true, 0.1)).toBeNull();
    expect(m.update(b, true, true, EARLY.rest - 0.2)).toBeNull();
    expect(m.update(b, true, true, 0.2)).toBe('summon');
  });

  it('leaves the commander its hand for as long as a full charge waits to be cast', () => {
    const { b, m } = fresh(true);
    b.charge = BALANCE.commander.charge;
    b.chargedFor = 0;
    expect(m.update(b, true, true, EARLY.show)).toBeNull();
    // a player still aiming the spell is not sent off to 召唤 midway
    b.chargedFor = 14 * TICK_RATE;
    expect(m.update(b, true, true, 0.1)).toBeNull();
    b.charge = 0;
    expect(m.update(b, true, true, 0.1)).toBe('summon');
  });

  it('shows nothing while off or once the battle is over', () => {
    const { b, m } = fresh(true);
    expect(m.update(b, true, false, 5)).toBeNull();
    b.result = 'won';
    expect(m.update(b, true, true, 5)).toBeNull();
  });
});

describe('the next move later on', () => {
  it('waits for the player to stand still, then points at a pair before 强化', () => {
    const { b, m } = fresh(false, (b) => {
      pairOnly(b);
      b.gold = b.upgradeCost();
    });
    expect(m.update(b, false, true, IDLE_AFTER - 0.1)).toBeNull();
    expect(m.update(b, false, true, 0.1)).toEqual(expect.any(Array));
  });

  it('starts its clock only while the hand may show', () => {
    const { b, m } = fresh(false);
    expect(m.update(b, false, false, 10)).toBeNull();
    expect(m.update(b, false, true, 0.1)).toBeNull();
    expect(m.update(b, false, true, IDLE_AFTER)).toBe('summon');
  });
});
