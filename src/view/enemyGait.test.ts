import { describe, expect, it } from 'vitest';
import { BALANCE, ENEMY_KINDS, type Enemy } from '../sim/types';
import { BASH_EVERY, BASH_IMPACT, bash, bashPhase, stepPhase, strideRate, walk } from './enemyGait';

const enemy = (over: Partial<Enemy>): Enemy => ({ id: 0, kind: 'grunt', x: 0, y: 0, ...over }) as Enemy;

describe('enemyGait', () => {
  it('steps quicker kinds faster a second but longer a step', () => {
    const perSecond = (k: 'grunt' | 'runner' | 'brute') => strideRate(k) * BALANCE.enemies[k].speed;
    expect(perSecond('grunt')).toBeCloseTo(9);
    expect(perSecond('runner')).toBeGreaterThan(perSecond('grunt'));
    expect(perSecond('brute')).toBeLessThan(perSecond('grunt'));
    expect(strideRate('runner')).toBeLessThan(strideRate('grunt'));
  });

  it('takes its step from how far down the field it is, out of step by id', () => {
    expect(stepPhase(enemy({ y: 100 }))).toBeCloseTo(100 * strideRate('grunt'));
    expect(stepPhase(enemy({ y: 100, id: 2 }))).toBeCloseTo(100 * strideRate('grunt') + 3.4);
  });

  it('gives each walker its own gait, the grunt the waddle', () => {
    const s = 0.8;
    const kinds = ['grunt', 'runner', 'brute', 'boss', 'clock', 'tripod'] as const;
    const steps = kinds.map((k) => JSON.stringify(walk(k, s)));
    expect(new Set(steps).size).toBe(kinds.length);
    expect(walk('winder', s)).toEqual(walk('grunt', s));
    expect(walk('grunt', 0)).toEqual({ up: 0, rot: 0.07, sx: 1, sy: 0.96 });
    expect(walk('boss', 1).rot).toBe(0);
  });

  it('beats each kind on the wall at its pace, wrapping round', () => {
    for (const k of ENEMY_KINDS) expect(BASH_EVERY[k], k).toBeGreaterThan(0);
    const e = enemy({});
    expect(bashPhase(e, 0)).toBe(0);
    expect(bashPhase(e, BASH_EVERY.grunt * 0.25)).toBeCloseTo(0.25);
    expect(bashPhase(e, BASH_EVERY.grunt * 3.25)).toBeCloseTo(0.25);
    expect(bashPhase(enemy({ id: 1 }), 0)).toBeCloseTo(0.37);
  });

  it('rears back, lunges into the wall at the impact and settles, without a jump between parts', () => {
    expect(bash(0)).toEqual({ fwd: -0, up: 0, sy: 1 });
    const eps = 1e-9;
    for (const c of [0.55, BASH_IMPACT]) {
      const a = bash(c - eps);
      const b = bash(c);
      expect(b.fwd).toBeCloseTo(a.fwd, 5);
      expect(b.up).toBeCloseTo(a.up, 5);
      expect(b.sy).toBeCloseTo(a.sy, 5);
    }
    expect(bash(BASH_IMPACT).fwd).toBe(18);
    expect(bash(0.55).fwd).toBeCloseTo(-10);
    expect(bash(1 - eps).fwd).toBeCloseTo(0, 5);
    expect(bash(1 - eps).sy).toBeCloseTo(1, 5);
  });
});
