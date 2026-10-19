import { describe, expect, it } from 'vitest';
import { enemyStats, extremes, RESIST, resist, resistLabel, resists } from './enemies';
import { heroUnlocked, newMeta, stageHp } from './meta';
import { FP } from './math/fixed';
import { Prng } from './math/prng';
import { BALANCE, ENEMY_KINDS, HERO_KINDS, isBoss, LINEUP } from './types';
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

  it('lets only the boiler golem and the wooden clock shrug off corrosion, and the winder, the bare tripod and the iron-rimmed gear king fear it most', () => {
    for (const kind of ENEMY_KINDS) expect(resist(kind, 'poison')).toBe(kind === 'brute' ? 0.5 : kind === 'winder' || kind === 'tripod' || kind === 'gear' ? 1.5 : kind === 'clock' ? 0.75 : 1);
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

  it('picks the one element each kind fears most and the one it shrugs off most, first in hero order on a tie', () => {
    expect(extremes('grunt')).toEqual({ weak: 'lightning', strong: null });
    expect(extremes('runner')).toEqual({ weak: 'ice', strong: null });
    expect(extremes('brute')).toEqual({ weak: 'ice', strong: 'fire' });
    expect(extremes('winder')).toEqual({ weak: 'poison', strong: 'ice' });
    expect(extremes('gear')).toEqual({ weak: 'poison', strong: 'fire' });
    for (const kind of ENEMY_KINDS) {
      const { weak, strong } = extremes(kind);
      const all = HERO_KINDS.map((el) => resist(kind, el));
      expect(weak ? resist(kind, weak) : 1).toBe(Math.max(1, ...all));
      expect(strong ? resist(kind, strong) : 1).toBe(Math.min(1, ...all));
    }
  });
});

describe('enemy stats', () => {
  it('gives the hit points of the first wave a kind turns up in, scaled for the stage', () => {
    for (const stage of [1, 4]) {
      const boss = planWave(FIRST_WAVE.boss, new Prng(1)).find((s) => s.kind === 'boss');
      expect(FIRST_WAVE.boss).toBe(5);
      expect(enemyStats('boss', stage).hp).toBeCloseTo((boss!.hp / FP) * stageHp(stage), 1);
    }
  });

  it('starts each kind on a stage and wave that can actually spawn it', () => {
    const kinds = (wave: number, stage: number) => {
      const seen = new Set<string>();
      for (let seed = 1; seed < 40; seed++) for (const s of planWave(wave, new Prng(seed), stage)) seen.add(s.kind);
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
      for (const seed of [1, 7, 42]) expect(planWave(wave, new Prng(seed), FIRST_STAGE.flyer - 1)).toEqual(planWave(wave, new Prng(seed)));
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
    const count = (stage: number) => planWave(W.wave, new Prng(3), stage).filter((s) => s.kind === 'winder').length;
    expect(count(W.stage)).toBe(1);
    expect(count(W.twoFrom)).toBe(2);
    const rest = planWave(W.wave, new Prng(3), W.stage).filter((s) => s.kind !== 'winder');
    expect(rest).toEqual(planWave(W.wave, new Prng(3), W.stage - 1));
    const plan = planWave(5, new Prng(3), W.stage);
    expect(plan.map((s) => s.at)).toEqual([...plan.map((s) => s.at)].sort((a, b) => a - b));
  });
});

describe('the tougher first waves', () => {
  const W = BALANCE.waves;
  const plain = (wave: number, seed: number, stage: number) => {
    const keep = W.earlyHp;
    W.earlyHp = keep.map(() => 1);
    try {
      return planWave(wave, new Prng(seed), stage);
    } finally {
      W.earlyHp = keep;
    }
  };

  it('keeps the first wave and every roll, and raises hit points and kill gold on the first chapter', () => {
    expect(W.earlyHp[0]).toBe(1);
    for (const stage of [1, 5, W.earlyHpTo]) {
      for (let wave = 1; wave <= 5; wave++) {
        const tough = planWave(wave, new Prng(9), stage);
        const before = plain(wave, 9, stage);
        expect(tough.map((s) => [s.kind, s.at, s.elite])).toEqual(before.map((s) => [s.kind, s.at, s.elite]));
        const hp = (p: typeof tough) => p.filter((s) => !isBoss(s.kind) && s.kind !== 'winder').reduce((a, s) => a + s.hp, 0);
        const ratio = hp(tough) / hp(before);
        expect(ratio).toBeCloseTo(W.earlyHp[wave - 1], 1);
        if (W.earlyHp[wave - 1] > 1) expect(tough.some((s, i) => (s.gold ?? 1000) > (before[i].gold ?? 1000))).toBe(true);
      }
    }
  });

  it('plans the later chapters as before', () => {
    for (let wave = 1; wave <= 5; wave++) expect(planWave(wave, new Prng(9), W.earlyHpTo + 1)).toEqual(plain(wave, 9, W.earlyHpTo + 1));
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
        for (let seed = 1; seed <= 40; seed++) planWave(wave, new Prng(seed), stage).forEach((s) => seen.add(s.kind));
        for (const kind of seen) expect(forecast, `stage ${stage} wave ${wave}`).toContain(kind);
        for (const kind of forecast) expect(seen.has(kind), `stage ${stage} wave ${wave} ${kind}`).toBe(true);
      }
    }
  });
});
