import { describe, expect, it } from 'vitest';
import { Prng } from './math/prng';
import { BALANCE, isBoss } from './types';
import { planWave, type Spawn } from './waves';

const W = BALANCE.waves;

/** The wave as it plans with `firstCrowd` at 1. */
function plain(wave: number, seed: number, stage: number, endless = false): Spawn[] {
  const keep = W.firstCrowd;
  W.firstCrowd = 1;
  try {
    return planWave(wave, new Prng(seed), stage, {}, endless);
  } finally {
    W.firstCrowd = keep;
  }
}

const crowdOf = (p: Spawn[]) => p.filter((s) => !isBoss(s.kind) && s.kind !== 'winder');
const sum = (p: Spawn[], f: (s: Spawn) => number) => crowdOf(p).reduce((a, s) => a + f(s), 0);

describe('the busier first chapter (firstCrowd)', () => {
  it('sends firstCrowd times the crowd after the horde, as heavy in hit points (firstHp of it past the early waves), gold and heft', () => {
    expect(W.firstCrowd).toBeGreaterThan(1);
    for (const stage of [1, 4, W.earlyHpTo]) {
      for (let wave = 2; wave <= W.count; wave++) {
        // the kinds roll anew with more of them, so the totals are taken over a run of seeds
        const t = { n: [0, 0], hp: [0, 0], gold: [0, 0], heft: [0, 0] };
        for (let seed = 1; seed <= 40; seed++) {
          const busy = planWave(wave, new Prng(seed), stage);
          const before = plain(wave, seed, stage);
          [busy, before].forEach((p, i) => {
            t.n[i] += crowdOf(p).length;
            t.hp[i] += sum(p, (s) => s.hp);
            t.gold[i] += sum(p, (s) => s.gold ?? 1000);
            t.heft[i] += sum(p, (s) => s.heft ?? 1000);
          });
          // the boss and the winders come as they did
          expect(busy.filter((s) => !crowdOf(busy).includes(s))).toEqual(before.filter((s) => !crowdOf(before).includes(s)));
        }
        expect(t.n[0] / t.n[1]).toBeCloseTo(W.firstCrowd, 1);
        expect(t.hp[0] / t.hp[1]).toBeCloseTo(wave > W.earlyHp.length ? W.firstHp : 1, 1);
        for (const k of ['gold', 'heft'] as const) expect(t[k][0] / t[k][1]).toBeCloseTo(1, 1);
      }
    }
  });

  it('leaves the horde, the later chapters and endless mode past its first ten waves as they were', () => {
    for (const stage of [1, W.earlyHpTo]) expect(planWave(1, new Prng(3), stage)).toEqual(plain(1, 3, stage));
    for (const wave of [2, 5, 9]) expect(planWave(wave, new Prng(3), W.earlyHpTo + 1)).toEqual(plain(wave, 3, W.earlyHpTo + 1));
    for (const wave of [W.count + 1, W.count + 5, W.count + 20]) {
      expect(planWave(wave, new Prng(3), BALANCE.endless.stage, {}, true)).toEqual(plain(wave, 3, BALANCE.endless.stage, true));
    }
  });
});
