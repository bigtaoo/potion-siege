import { describe, expect, it } from 'vitest';
import { KillFx, MILESTONES, STREAK_GAP, STREAK_SHOWN } from './killFx';

describe('the kills as drawn', () => {
  it('counts a streak while kills come close together and starts again after a gap', () => {
    const fx = new KillFx();
    const reached: number[] = [];
    for (let i = 0; i < MILESTONES[1]; i++) {
      reached.push(fx.kill(500, 400, 1));
      fx.update(STREAK_GAP / 2);
    }
    expect(reached.filter(Boolean)).toEqual(MILESTONES.slice(0, 2));
    fx.update(STREAK_GAP * 3);
    for (let i = 1; i < MILESTONES[0]; i++) expect(fx.kill(500, 400, 1)).toBe(0);
    expect(MILESTONES[0]).toBeGreaterThan(STREAK_SHOWN);
  });

  it('lands each coin on the counter once, none for a kill worth nothing', () => {
    const fx = new KillFx();
    let landed = 0;
    fx.landed = () => landed++;
    fx.kill(300, 500, 2);
    fx.kill(700, 600, 0);
    fx.kill(800, 300, 1);
    for (let i = 0; i < 60; i++) fx.update(1 / 30);
    expect(landed).toBe(2);
    fx.clear();
    fx.kill(300, 500, 1);
    fx.clear();
    fx.update(5);
    expect(landed).toBe(2);
  });
});
