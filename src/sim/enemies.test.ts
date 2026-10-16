import { describe, expect, it } from 'vitest';
import { enemyStats, RESIST, resist, resistLabel, resists } from './enemies';
import { heroUnlocked, newMeta, stageHp } from './meta';
import { Rng } from './rng';
import { ENEMY_KINDS, HERO_KINDS, LINEUP } from './types';
import { FIRST_WAVE, planWave } from './waves';

describe('enemy resistances', () => {
  it('defaults to full damage and keeps every listed value sensible', () => {
    expect(resist('grunt', 'fire')).toBe(1);
    expect(resist('brute', 'fire')).toBe(0.5);
    for (const table of Object.values(RESIST)) {
      for (const v of Object.values(table)) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(2);
      }
    }
  });

  it('shows every resistance that is not 1', () => {
    for (const kind of ENEMY_KINDS) {
      const shown = resists(kind);
      for (const [element, v] of Object.entries(RESIST[kind])) {
        if (v !== 1) expect(shown).toContainEqual({ element, value: v });
      }
    }
  });

  it('labels a multiplier as a change in damage', () => {
    expect(resistLabel(0.5)).toBe('-50%');
    expect(resistLabel(1.25)).toBe('+25%');
    expect(resistLabel(0.75)).toBe('-25%');
    expect(resistLabel(1)).toBe('—');
  });
});

describe('enemy stats', () => {
  it('gives the hit points of the first wave a kind turns up in, scaled for the stage', () => {
    for (const stage of [1, 4]) {
      const boss = planWave(FIRST_WAVE.boss, new Rng(1)).find((s) => s.kind === 'boss');
      expect(FIRST_WAVE.boss).toBe(5);
      expect(enemyStats('boss', stage).hp).toBeCloseTo(boss!.hp * stageHp(stage));
    }
  });

  it('starts each kind on a wave that can actually spawn it', () => {
    for (const kind of ENEMY_KINDS) {
      const wave = FIRST_WAVE[kind];
      const seen = new Set<string>();
      for (let seed = 1; seed < 40; seed++) for (const s of planWave(wave, new Rng(seed))) seen.add(s.kind);
      expect(seen.has(kind)).toBe(true);
      if (wave > 1) {
        const before = new Set<string>();
        for (let seed = 1; seed < 40; seed++) for (const s of planWave(wave - 1, new Rng(seed))) before.add(s.kind);
        expect(before.has(kind)).toBe(false);
      }
    }
  });
});

describe('hero unlocks', () => {
  it('locks poison on a new save and opens the whole lineup', () => {
    const m = newMeta();
    expect(heroUnlocked(m, 'poison')).toBe(false);
    for (const kind of LINEUP) expect(heroUnlocked(m, kind)).toBe(true);
    expect(HERO_KINDS.filter((k) => heroUnlocked(m, k))).toEqual([...LINEUP]);
  });
});
