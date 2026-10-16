import { describe, expect, it } from 'vitest';
import { enemyStats, RESIST, resist, resistLabel, resists } from './enemies';
import { heroUnlocked, newMeta, stageHp } from './meta';
import { Rng } from './rng';
import { BALANCE, ENEMY_KINDS, HERO_KINDS, LINEUP } from './types';
import { FIRST_STAGE, FIRST_WAVE, flyerShare, planWave, waveKinds } from './waves';

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

  it('lets only the boiler golem shrug off corrosion, and the winder fear it most', () => {
    for (const kind of ENEMY_KINDS) expect(resist(kind, 'poison')).toBe(kind === 'brute' ? 0.5 : kind === 'winder' ? 1.5 : 1);
  });

  it('lets the gale tear at the ornithopter and the winder, and the heavy ones stand in it', () => {
    expect(resist('flyer', 'wind')).toBeGreaterThan(1);
    expect(resist('winder', 'wind')).toBeGreaterThan(1);
    expect(resist('runner', 'wind')).toBe(1.25);
    expect(resist('brute', 'wind')).toBe(0.75);
    expect(resist('boss', 'wind')).toBe(0.75);
    expect(resist('grunt', 'wind')).toBe(1);
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

  it('starts each kind on a stage and wave that can actually spawn it', () => {
    const kinds = (wave: number, stage: number) => {
      const seen = new Set<string>();
      for (let seed = 1; seed < 40; seed++) for (const s of planWave(wave, new Rng(seed), stage)) seen.add(s.kind);
      return seen;
    };
    for (const kind of ENEMY_KINDS) {
      const wave = FIRST_WAVE[kind];
      const stage = FIRST_STAGE[kind];
      expect(kinds(wave, stage).has(kind)).toBe(true);
      if (wave > 1) expect(kinds(wave - 1, stage).has(kind)).toBe(false);
      if (stage > 1) for (let w = 1; w <= BALANCE.waves.count; w++) expect(kinds(w, stage - 1).has(kind)).toBe(false);
    }
  });

  it('gives a stage before it the stats of its first stage', () => {
    const s = FIRST_STAGE.winder;
    expect(enemyStats('winder', 1)).toEqual(enemyStats('winder', s));
    expect(enemyStats('winder', 1).stage).toBe(s);
    expect(enemyStats('winder', s + 1).hp).toBeGreaterThan(enemyStats('winder', s).hp);
  });
});

describe('the new kinds in the wave plan', () => {
  it('plans the stages before them exactly as it did', () => {
    for (let wave = 1; wave <= BALANCE.waves.count; wave++) {
      for (const seed of [1, 7, 42]) expect(planWave(wave, new Rng(seed), FIRST_STAGE.flyer - 1)).toEqual(planWave(wave, new Rng(seed)));
    }
  });

  it('sends more flyers on later stages, up to a cap', () => {
    expect(flyerShare(FIRST_STAGE.flyer - 1)).toBe(0);
    expect(flyerShare(FIRST_STAGE.flyer)).toBe(BALANCE.flyer.share);
    expect(flyerShare(FIRST_STAGE.flyer + 4)).toBeGreaterThan(flyerShare(FIRST_STAGE.flyer));
    expect(flyerShare(99)).toBe(BALANCE.flyer.maxShare);
  });

  it('sends one winder a wave from its stage, two later on, without moving the others', () => {
    const W = BALANCE.winder;
    const count = (stage: number) => planWave(W.wave, new Rng(3), stage).filter((s) => s.kind === 'winder').length;
    expect(count(W.stage)).toBe(1);
    expect(count(W.twoFrom)).toBe(2);
    const rest = planWave(W.wave, new Rng(3), W.stage).filter((s) => s.kind !== 'winder');
    expect(rest).toEqual(planWave(W.wave, new Rng(3), W.stage - 1));
    const plan = planWave(5, new Rng(3), W.stage);
    expect(plan.map((s) => s.at)).toEqual([...plan.map((s) => s.at)].sort((a, b) => a - b));
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

describe('wave forecast', () => {
  it('names every kind a wave brings, and nothing the waves never bring', () => {
    for (const stage of [1, 3, 6, 10, 15, 20]) {
      for (let wave = 1; wave <= BALANCE.waves.count; wave++) {
        const forecast = waveKinds(wave, stage);
        const seen = new Set<string>();
        for (let seed = 1; seed <= 40; seed++) planWave(wave, new Rng(seed), stage).forEach((s) => seen.add(s.kind));
        for (const kind of seen) expect(forecast, `stage ${stage} wave ${wave}`).toContain(kind);
        for (const kind of forecast) expect(seen.has(kind), `stage ${stage} wave ${wave} ${kind}`).toBe(true);
      }
    }
  });
});
