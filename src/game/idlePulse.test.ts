import { describe, expect, it } from 'vitest';
import { Battle } from '../sim/battle';
import { BASE_SETUP } from '../sim/meta';
import { IDLE_PULSE_AFTER, idlePulse } from './idlePulse';

const wait = (b: Battle, s: number) => {
  let on = false;
  for (let t = 0; t < s; t += 0.1) on = idlePulse(b, 0.1);
  return on;
};

describe('idlePulse', () => {
  it('swells 召唤 after standing still with gold on stages 1-3', () => {
    const b = new Battle(1, { ...BASE_SETUP, stage: 1 });
    expect(wait(b, IDLE_PULSE_AFTER - 0.5)).toBe(false);
    expect(wait(b, 0.6)).toBe(true);
    b.summon();
    expect(idlePulse(b, 0.1)).toBe(false);
  });

  it('stays still without gold, on later stages and without a battle', () => {
    const poor = new Battle(1, { ...BASE_SETUP, stage: 1 });
    poor.gold = 0;
    expect(wait(poor, 5)).toBe(false);
    expect(wait(new Battle(1, { ...BASE_SETUP, stage: 4 }), 5)).toBe(false);
    expect(wait(new Battle(1, { ...BASE_SETUP, stage: 2, endless: true }), 5)).toBe(false);
    expect(idlePulse(null, 1)).toBe(false);
  });
});
