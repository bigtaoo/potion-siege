// The edges of bringing enemies in (spawn.ts): the gold between waves, when a thin field calls
// the next spawn, where in its lane one lands, and what each kind is born with. Pinned by
// mutation testing (ref/mutation-sim.md).

import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { K } from './field';
import { BASE_SETUP, type BattleModifiers } from './meta';
import { ticks, toFp } from './math/fixed';
import { BRAD_FULL } from './math/trig';
import { spawn, startWave, stepWaves } from './spawn';
import { BALANCE, type EnemyKind } from './types';

const B = BALANCE;
const W = B.waves;

const MODS: BattleModifiers = { enemySpeed: 1, summonCost: 1, waveGold: 2, killGold: 1, crit: 0, bossWaves: W.bossWaves, banned: [] };

/** A battle with no enemies on the field. */
function field(modifiers?: BattleModifiers): Battle {
  const b = new Battle(1, { ...BASE_SETUP, modifiers });
  b.enemies = [];
  return b;
}

/** Brings one `kind` in at `x` (world units), mid-field. */
function letOut(b: Battle, kind: EnemyKind, x = 500, elite = false) {
  spawn(b, { at: 0, kind, hp: toFp(100), elite }, { x: toFp(x), y: toFp(600) });
  return b.enemies[b.enemies.length - 1];
}

describe('the gold between waves', () => {
  it('pays from the second wave on, times the challenge\'s own rate', () => {
    const b = field(MODS);
    const g = b.gold;
    startWave(b, 1);
    expect(b.gold).toBe(g);
    startWave(b, 2);
    expect(b.gold).toBe(g + Math.round(W.waveBonusGold * 2));
    const plain = field();
    const p = plain.gold;
    startWave(plain, 2);
    expect(plain.gold).toBe(p + W.waveBonusGold);
  });
});

describe('a thin field', () => {
  /** A field holding `n` enemies, with one runner due in 100 ticks. */
  function waiting(n: number): Battle {
    const b = field();
    for (let i = 0; i < n; i++) letOut(b, 'grunt', 100 + 100 * i);
    b.pending = [{ at: b.waveTime + 100, kind: 'runner', hp: toFp(100) }];
    return b;
  }
  const runners = (b: Battle) => b.enemies.filter((e) => e.kind === 'runner').length;

  it(`calls the next spawn at once with ${W.callAt} left, not with one more`, () => {
    const thin = waiting(W.callAt);
    stepWaves(thin);
    expect(runners(thin)).toBe(1);
    const full = waiting(W.callAt + 1);
    stepWaves(full);
    expect(runners(full)).toBe(0);
  });

  it('brings one in on the very tick it is due', () => {
    const b = waiting(W.callAt + 1);
    b.waveTime = b.pending[0].at - 1;
    stepWaves(b);
    expect(runners(b)).toBe(1);
  });
});

describe('where one lands', () => {
  it('keeps a whole body inside the field at either end of its lane', () => {
    const lo = field();
    lo.enemyRng.range = (min) => min;
    spawn(lo, { at: 0, kind: 'grunt', hp: toFp(100) });
    const l = lo.enemies[0];
    expect(l.x).toBe(K.left + l.radius);

    const hi = field();
    hi.enemyRng.range = (_min, max) => max;
    spawn(hi, { at: 0, kind: 'grunt', hp: toFp(100) });
    const r = hi.enemies[0];
    expect(r.x).toBe(K.right - r.radius);
  });

  it('pulls one let out past the left edge back in', () => {
    const e = letOut(field(), 'grunt', -1e5);
    expect(e.x).toBe(K.left + e.radius);
  });
});

describe('what each kind is born with', () => {
  it('marks an elite one, bigger, and no other', () => {
    const b = field();
    const elite = letOut(b, 'grunt', 500, true);
    const plain = letOut(b, 'grunt');
    expect(elite.elite).toBe(true);
    expect(elite.radius).toBe(toFp(B.enemies.grunt.radius * B.elite.radius));
    expect(plain.elite).toBeUndefined();
  });

  it('swings an ornithopter from a point a whole weave inside either edge, its phase set by its id', () => {
    const b = field();
    const id = b.nextId;
    const left = letOut(b, 'flyer', -1e5);
    expect(left.x0).toBe(K.left + left.radius + K.weave);
    expect(left.phase).toBe((id * K.weavePhase) % BRAD_FULL);
    const right = letOut(b, 'flyer', 1e5);
    expect(right.x0).toBe(K.right - right.radius - K.weave);
    expect(right.phase).toBe(((id + 1) * K.weavePhase) % BRAD_FULL);
    const mid = letOut(b, 'flyer', 500);
    expect(mid.x0).toBe(mid.x);
    expect(letOut(b, 'grunt').x0).toBeUndefined();
  });

  it('winds a winder, broods a clock and hops an anvil from their first timers, and nothing else', () => {
    const b = field();
    expect(letOut(b, 'winder').windTime).toBe(ticks(B.winder.every));
    expect(letOut(b, 'clock').broodTime).toBe(ticks(B.bosses.clock.first));
    const anvil = letOut(b, 'anvil');
    expect(anvil.hopTime).toBe(ticks(B.bosses.anvil.every));
    expect(anvil.leapTime).toBe(0);
    const grunt = letOut(b, 'grunt');
    expect([grunt.windTime, grunt.broodTime, grunt.hopTime, grunt.leapTime]).toEqual([undefined, undefined, undefined, undefined]);
  });
});
