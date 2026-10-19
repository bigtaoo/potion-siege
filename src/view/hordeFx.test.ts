import { describe, expect, it } from 'vitest';
import { Battle } from '../sim/battle';
import { ticks } from '../sim/math/fixed';
import { BALANCE } from '../sim/types';
import { RushWatch } from './hordeFx';

/** Steps `b` until its first wave has run `seconds`. */
function playTo(b: Battle, seconds: number, each = () => {}): void {
  while (b.wave < 1 || b.waveTime < ticks(seconds)) {
    b.step();
    each();
  }
}

describe('the horde as drawn', () => {
  it('raises dust once for each rush as it comes in', () => {
    const b = new Battle(3);
    const watch = new RushWatch();
    let dust = 0;
    playTo(b, BALANCE.waves.horde.rushes.at(-1)! + 1, () => void (watch.arrived(b) && dust++));
    expect(dust).toBe(BALANCE.waves.horde.rushes.length);
  });

  it('raises none for rushes long past when it first looks, and starts again with a new battle', () => {
    const b = new Battle(3);
    playTo(b, BALANCE.waves.horde.rushes[1] + 2);
    const watch = new RushWatch();
    expect(watch.arrived(b)).toBe(false);
    const next = new Battle(4);
    playTo(next, 0.5);
    expect(watch.arrived(next)).toBe(true);
  });
});
