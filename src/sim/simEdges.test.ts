// Small edges across the sim, one or two per module: the waves' forecast and endless bosses, a
// hero waiting for the first enemy, the shot count, where a let-out enemy lands, the wind's pick,
// a whole enemy's burst, and the ranged dice. Pinned by mutation testing (ref/mutation-sim.md).

import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { K } from './field';
import { Shares } from './horde';
import { toFp } from './math/fixed';
import { Rng } from './rng';
import { fire, stepHeroes } from './shots';
import { spawn } from './spawn';
import { TargetPick } from './targetPick';
import { BALANCE, BOSS_KINDS, type Enemy, type EnemyKind, type Hero } from './types';
import { bossForStage, crowdOf, endlessBossesMet, FIRST_WAVE, onStage, waveKinds } from './waves';

const B = BALANCE;

/** An enemy at (x, y), world units. */
function enemy(b: Battle, x: number, y: number, kind: EnemyKind = 'grunt'): Enemy {
  [x, y] = [toFp(x), toFp(y)];
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind, x, y, px: x, py: y, hp: toFp(100), maxHp: toFp(100), speed: toFp(1), radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
    markTime: 0, chill: 0, chillTime: 0, brittleTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000, heft: 1000,
  };
  b.enemies.push(e);
  return e;
}

function field(): Battle {
  const b = new Battle(1);
  b.enemies = [];
  return b;
}

/** A hero of `kind` standing in slot 0. */
function hero(b: Battle, kind: Hero['kind'], id = 3): Hero {
  const h: Hero = { id, kind, star: 1, slot: 0, cooldown: 0 };
  b.slots[0] = h;
  return h;
}

describe('waves forecast', () => {
  it('has met the first endless boss on its wave', () => {
    expect(endlessBossesMet(B.endless.bossEvery)).toHaveLength(1);
  });

  it('keeps an endless crowd under the cap as it is', () => {
    const wave = B.waves.count + 1;
    const count = B.waves.baseCount + B.waves.countStep * (wave - 1);
    expect(count).toBeLessThan(B.endless.maxCount);
    expect(crowdOf(wave, true).count).toBe(count);
  });

  it('forecasts a challenge\'s own boss waves and flyers', () => {
    expect(B.waves.bossWaves).not.toContain(3);
    expect(waveKinds(3, 1, { bossWaves: [3] })).toContain(bossForStage(1));
    expect(waveKinds(FIRST_WAVE.flyer, 1)).not.toContain('flyer');
    expect(waveKinds(FIRST_WAVE.flyer, 1, { flyers: 0.2 })).toContain('flyer');
  });

  it('lays an endless chapter\'s theme over the forecast, and only there', () => {
    let w = Math.max(FIRST_WAVE.flyer, B.waves.count + 1);
    while (!waveKinds(w, 1, {}, true).includes('flyer')) w++;
    expect(waveKinds(w, 1)).not.toContain('flyer');
  });

  it('puts only the stage\'s own boss on it', () => {
    const own = bossForStage(1);
    expect(onStage(own, 1)).toBe(true);
    expect(onStage(BOSS_KINDS.find((k) => k !== own)!, 1)).toBe(false);
  });
});

describe('shots and spawns', () => {
  it('staggers the heroes waiting for the first enemy', () => {
    const b = field();
    const h = hero(b, 'fire');
    stepHeroes(b);
    expect(h.cooldown).toBe(3 * K.idleCooldown);
  });

  it('counts a hero\'s shots towards the sky strike', () => {
    const b = field();
    (b.mods as { thunder: boolean }).thunder = true;
    const h = hero(b, 'lightning');
    fire(b, h, enemy(b, 500, 600));
    expect(b.shotCount.get(h.id)).toBe(1);
  });

  it('lets an elite out a size bigger, inside the field', () => {
    const b = field();
    expect(B.elite.radius).not.toBe(1);
    spawn(b, { at: 0, kind: 'grunt', hp: toFp(100), elite: true }, { x: toFp(1e5), y: toFp(600) });
    const e = b.enemies[0];
    expect(e.radius).toBe(toFp(B.enemies.grunt.radius * B.elite.radius));
    expect(e.x).toBe(K.right - e.radius);
  });

  it('sends the wind at a winder behind the front', () => {
    const b = field();
    enemy(b, 500, 800);
    const winder = enemy(b, 300, 700, 'winder');
    expect(new TargetPick(b).pick('wind')).toBe(winder);
  });

  it('sets a whole enemy\'s burst off without owing towards the next', () => {
    const s = new Shares();
    expect(s.proc('split', 1500)).toBe(true);
    expect(s.proc('split', 600)).toBe(false);
  });

  it('rolls a range between its ends', () => {
    const rng = new Rng(5);
    const rolls = Array.from({ length: 200 }, () => rng.range(10, 20));
    for (const r of rolls) {
      expect(r).toBeGreaterThanOrEqual(10);
      expect(r).toBeLessThan(20);
    }
    expect(Math.max(...rolls)).toBeGreaterThan(15);
  });
});
