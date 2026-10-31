import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { PREP_FROM, weakFielded } from './bossPrep';
import { resist } from './enemies';
import { BASE_SETUP, type BattleSetup } from './meta';
import { BALANCE, isBoss } from './types';

/** A battle with wave 9 just cleared, stepped until the last wave sets out. */
function lastWave(setup: BattleSetup = { ...BASE_SETUP, stage: 4 }): Battle {
  const b = new Battle(5, setup);
  b.gold = 1e6;
  for (let i = 0; i < 4; i++) b.summon();
  b.wave = BALANCE.waves.count - 1;
  b.pending = [];
  b.enemies = [];
  b.drain();
  b.step();
  return b;
}

describe('bossPrep', () => {
  it('offers a free skill, and no extra charge, as the last boss wave sets out', () => {
    const b = lastWave();
    expect(b.wave).toBe(BALANCE.waves.count);
    expect(b.choices).toHaveLength(3);
    expect(b.choiceReason).toBe('boss');
    expect(b.charge).toBe(0);
    expect(b.drain()).toContainEqual({ type: 'offer', reason: 'boss' });
    expect(b.pending.some((s) => isBoss(s.kind))).toBe(true);
  });

  it('costs nothing and comes once; the wave walks in after the pick', () => {
    const b = lastWave();
    const gold = b.gold;
    const upgrades = b.upgrades;
    expect(b.choose(b.choices![0])).toBe(true);
    expect(b.gold).toBe(gold);
    expect(b.upgrades).toBe(upgrades);
    for (let i = 0; i < 300; i++) b.step();
    expect(b.choices).toBeNull();
    expect(b.enemies.length).toBeGreaterThan(0);
  });

  it('leaves endless mode, stages 1-3 and the earlier waves alone', () => {
    expect(lastWave({ ...BASE_SETUP, stage: 4, endless: true }).choices).toBeNull();
    expect(lastWave({ ...BASE_SETUP, stage: PREP_FROM - 1 }).choices).toBeNull();
    const b = new Battle(5, { ...BASE_SETUP, stage: 4 });
    for (let i = 0; i < 600 && b.wave < 3; i++) b.step();
    expect(b.choices).toBeNull();
  });

  it('leans the cards to a fielded potion the boss is weak to', () => {
    const b = lastWave();
    const boss = b.pending.find((s) => isBoss(s.kind))!.kind;
    const k = weakFielded(b);
    if (k) expect(resist(boss, k)).toBeGreaterThan(1);
    b.pending = [];
    expect(weakFielded(b)).toBeUndefined();
  });
});
