import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { brood } from './bosses';
import { playOut } from './bot';
import { rollDay } from './daily';
import { bookEndless, endlessOpen, endlessPay, endlessSetup, milestonesOf, nextMilestone, parseEndless } from './endless';
import { newMeta, parseMeta, Purse, stageHp } from './meta';
import { Prng } from './math/prng';
import { startWave } from './spawn';
import { BALANCE, BOSS_KINDS, HERO_KINDS, isBoss } from './types';
import { bossForStage, crowdOf, endlessBoss, endlessBossesMet, endlessChapter, endlessSpeed, endlessTheme, isBossWave, planWave, waveKinds } from './waves';

const E = BALANCE.endless;
/** Hit points a wave sends, averaged over a few rolls of its mix. */
const total = (wave: number) => {
  let hp = 0;
  for (let seed = 1; seed <= 20; seed++) hp += planWave(wave, new Prng(seed), E.stage, undefined, true).reduce((a, s) => a + s.hp, 0);
  return hp;
};

/** A save that has cleared the first chapter, every potion at `level`. */
function cleared(level = 1) {
  const m = newMeta();
  m.cleared = E.unlock;
  m.stage = E.unlock + 1;
  for (const k of HERO_KINDS) m.heroes[k] = level;
  return m;
}

describe('endless waves', () => {
  it('plans the first ten waves exactly like the endless stage', () => {
    for (let w = 1; w <= BALANCE.waves.count; w++) {
      expect(planWave(w, new Prng(w), E.stage, undefined, true)).toEqual(planWave(w, new Prng(w), E.stage));
    }
  });

  it('keeps growing past the last wave, the crowd capped', () => {
    // a boss wave sends half the crowd, so compare each wave with the same place in the next cycle
    for (let w = BALANCE.waves.count; w < 60; w++) expect(total(w + E.bossEvery)).toBeGreaterThan(total(w) * 1.1);
    for (const w of [21, 33, 59]) expect(planWave(w, new Prng(1), E.stage, undefined, true).filter((s) => s.kind !== 'winder').length).toBeLessThanOrEqual(E.maxCount);
  });

  it('tilts the mix toward brutes and flyers', () => {
    const share = (wave: number, kind: string) => {
      let n = 0;
      let all = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const plan = planWave(wave, new Prng(seed), E.stage, undefined, true);
        n += plan.filter((s) => s.kind === kind).length;
        all += plan.length;
      }
      return n / all;
    };
    expect(share(51, 'brute')).toBeGreaterThan(share(9, 'brute') * 1.5);
    expect(share(51, 'flyer')).toBeGreaterThan(share(9, 'flyer') * 1.5);
    expect(planWave(51, new Prng(1), E.stage, undefined, true).filter((s) => s.kind === 'winder').length).toBeGreaterThan(planWave(9, new Prng(1), E.stage).filter((s) => s.kind === 'winder').length);
  });

  it('sends a boss every few waves, taking turns through the bosses', () => {
    for (let w = 1; w <= 60; w++) {
      const boss = w % E.bossEvery === 0;
      expect(isBossWave(w, undefined, true)).toBe(boss);
      const plan = planWave(w, new Prng(w), E.stage, undefined, true);
      expect(plan.filter((s) => isBoss(s.kind)).map((s) => s.kind)).toEqual(boss ? [endlessBoss(w)] : []);
      expect(waveKinds(w, E.stage, undefined, true).filter(isBoss)).toEqual(boss ? [endlessBoss(w)] : []);
    }
  });

  it('meets every chapter boss in turn once past the endless stage, its own boss first', () => {
    expect(endlessBoss(5)).toBe(bossForStage(E.stage));
    expect(endlessBoss(10)).toBe(bossForStage(E.stage));
    const lap = [15, 20, 25, 30, 35].map(endlessBoss);
    expect([...lap].sort()).toEqual([...BOSS_KINDS].sort());
    expect(lap).toEqual(['clock', 'tripod', 'anvil', 'gear', 'boss']);
    expect(endlessBoss(40)).toBe('clock');
    expect(endlessBossesMet(14)).toEqual(['boss']);
    expect(endlessBossesMet(22)).toEqual(['boss', 'clock', 'tripod']);
    expect(endlessBossesMet(999)).toHaveLength(BOSS_KINDS.length);
  });

  it('scales each boss with the endless hit points: tougher every boss wave, whichever boss it is', () => {
    // hit points per point of the kind's own toughness, so the five bosses compare
    const unit = (w: number) => {
      const boss = planWave(w, new Prng(1), E.stage, undefined, true).find((s) => isBoss(s.kind))!;
      return boss.hp / BALANCE.enemies[boss.kind].hp;
    };
    for (let w = 10; w < 60; w += E.bossEvery) expect(unit(w + E.bossEvery)).toBeGreaterThan(unit(w));
  });

  it('hatches the clock mice as tough as the endless crowd, not on the stage curve', () => {
    const b = new Battle(5, endlessSetup(cleared(BALANCE.meta.heroMax)));
    startWave(b, 40);
    for (let i = 0; i < 30 && !b.enemies.some((e) => e.kind === 'clock'); i++) b.step();
    b.hatch.length = 0;
    brood(b, b.enemies.find((e) => e.kind === 'clock')!);
    const mouse = b.hatch[0].s;
    const P = BALANCE.bosses.clock;
    expect(mouse.hp).toBe(Math.round(crowdOf(40, true).hp * BALANCE.enemies.runner.hp * b.setup.enemyHp * P.hp * 1000));
    expect(crowdOf(40, true).hp * 20).toBeLessThan(crowdOf(40).hp);
  });
});

describe('endless chapters', () => {
  it('moves on a chapter every band of waves, the outskirts first, round and round', () => {
    const at = (w: number) => BALANCE.chapters[endlessChapter(w) - 1].id;
    expect([1, 10, 11, 20, 21, 31, 41, 50, 51, 61].map(at)).toEqual(['outskirts', 'outskirts', 'snowfield', 'snowfield', 'railyard', 'foundry', 'clocktower', 'clocktower', 'outskirts', 'snowfield']);
    expect(endlessChapter(E.stage)).toBe(1);
  });

  it("plans each band with its chapter's theme", () => {
    const share = (wave: number, kind: string) => {
      let n = 0;
      let all = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const plan = planWave(wave, new Prng(seed), E.stage, undefined, true);
        n += plan.filter((s) => s.kind === kind).length;
        all += plan.length;
      }
      return n / all;
    };
    // the rail yard's crowd runs, the foundry brings one more winder, the clock tower elites
    expect(share(22, 'runner')).toBeGreaterThan(share(19, 'runner') * 1.3);
    const winders = (w: number) => planWave(w, new Prng(1), E.stage, undefined, true).filter((s) => s.kind === 'winder').length;
    // (past the cap of the stage's own, so the foundry's second lap shows it plainly)
    expect(winders(81)).toBe(winders(79) + 1);
    expect(winders(89)).toBe(winders(91) + 1);
    expect(winders(89)).toBeGreaterThan(E.winderMax);
    expect(planWave(41, new Prng(1), E.stage, undefined, true).some((s) => s.elite)).toBe(true);
    expect(planWave(39, new Prng(1), E.stage, undefined, true).some((s) => s.elite)).toBe(false);
    expect(endlessSpeed(15)).toBe(endlessTheme(15).speed);
    expect(endlessSpeed(25)).toBeGreaterThan(1);
    expect(endlessSpeed(45)).toBe(1);
  });

  it('walks the rail yard faster than the snowfield', () => {
    const speedIn = (wave: number) => {
      const b = new Battle(7, endlessSetup(cleared(BALANCE.meta.heroMax)));
      startWave(b, wave);
      for (let i = 0; i < 200 && !b.enemies.some((e) => e.kind === 'grunt'); i++) b.step();
      const g = b.enemies.filter((e) => e.kind === 'grunt');
      return g.reduce((a, e) => a + e.speed, 0) / g.length;
    };
    expect(speedIn(21)).toBeGreaterThan(speedIn(11) * 1.08);
  });
});

describe('endless battle', () => {
  it('never runs out of waves: it goes past the last wave and only ends when the wall falls', () => {
    const b = playOut(11, 1500, endlessSetup(cleared(BALANCE.meta.heroMax)));
    expect(b.wave).toBeGreaterThan(BALANCE.waves.count);
    expect(b.result).not.toBe('won');
  });

  it("takes the finale's extra hit points off the endless stage", () => {
    expect(endlessSetup(cleared()).enemyHp).toBeCloseTo(stageHp(E.stage) * E.hpScale, 9);
    expect(E.hpScale).toBeLessThan(1);
  });

  it('a stage battle still ends after its last wave', () => {
    const b = new Battle(3, { ...endlessSetup(cleared()), endless: false });
    expect(b.setup.endless).toBe(false);
  });
});

describe('endless save', () => {
  it('opens once the first chapter is cleared', () => {
    const m = newMeta();
    expect(endlessOpen(m)).toBe(false);
    m.cleared = E.unlock - 1;
    expect(endlessOpen(m)).toBe(false);
    m.cleared = E.unlock;
    expect(endlessOpen(m)).toBe(true);
  });

  it('reads an old save as no endless runs, and clamps a broken one', () => {
    expect(parseMeta(JSON.stringify({ cleared: 12 })).endless).toEqual({ best: 0, paid: 0, runs: 0 });
    expect(parseEndless({ best: -3, paid: 99, runs: 'x' })).toEqual({ best: 0, paid: E.milestones.length, runs: 0 });
    const m = cleared();
    bookEndless(m, 23);
    expect(parseMeta(JSON.stringify(m)).endless).toEqual(m.endless);
  });

  it('pays each milestone once, the first time it is reached', () => {
    const m = cleared();
    const first = bookEndless(m, 17);
    expect(first.milestones).toBe(E.milestones[0].reward + E.milestones[1].reward);
    expect(first.record).toBe(true);
    expect(m.crystals).toBe(first.milestones);
    // a worse run, and the same run booked again after a revive, pay no milestone twice
    expect(bookEndless(m, 12)).toMatchObject({ milestones: 0, record: false, before: 17 });
    expect(bookEndless(m, 17).milestones).toBe(0);
    const better = bookEndless(m, 21);
    expect(better.milestones).toBe(E.milestones[2].reward);
    expect(nextMilestone(m)?.wave).toBe(E.milestones[3].wave);
    expect(milestonesOf(1000)).toBe(E.milestones.length);
    bookEndless(m, 1000);
    expect(nextMilestone(m)).toBeNull();
  });

  it('pays a little per wave, capped, so a long run is no farm', () => {
    const m = cleared();
    expect(endlessPay(m, 10)).toBe(E.perWave * 10);
    expect(endlessPay(m, 500)).toBe(E.runCap);
    // through the purse: a revived run ending again pays only the rest, and the ×2 once
    const purse = new Purse();
    const r = (wave: number) => ({ stage: E.stage, won: false, wave, kills: 0 });
    expect(purse.settle(m, r(12), { crystals: endlessPay(m, 12), firstClear: false, unlocked: [] }).crystals).toBe(120);
    expect(purse.settle(m, r(15), { crystals: endlessPay(m, 15), firstClear: false, unlocked: [] }).crystals).toBe(30);
    expect(m.cleared).toBe(E.unlock);
  });

  it('only rolls the endless daily task once endless mode is open', () => {
    let locked = 0;
    let open = 0;
    for (let d = 1; d <= 200; d++) {
      const day = `2027-${String(1 + Math.floor((d - 1) / 28)).padStart(2, '0')}-${String(1 + ((d - 1) % 28)).padStart(2, '0')}`;
      const a = newMeta();
      rollDay(a, day);
      locked += a.daily.tasks.filter((t) => t.id === 'endless').length;
      const b = cleared();
      rollDay(b, day);
      open += b.daily.tasks.filter((t) => t.id === 'endless').length;
    }
    expect(locked).toBe(0);
    expect(open).toBeGreaterThan(20);
  });
});
