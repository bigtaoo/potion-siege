// What every battle setup has to hold before a tick is played, over every setup source
// (setupCatalog.ts: each story stage, endless and the daily challenge under every modifier set
// and trial potion, on saves from brand-new to maxed, the workshop at 0 and at max): the player
// can summon at t=0, the lineup is a real one, and every number a mode multiplies by is finite
// and positive. Gold Rain once set the start gold to 0, and wave 1 went by with nothing to do.
import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { MODIFIER_IDS } from './challenge';
import { Prng } from './math/prng';
import { allSetups, type NamedSetup } from './setupCatalog';
import { SKILL_IDS } from './skills';
import { BALANCE, HERO_KINDS } from './types';
import { planWave } from './waves';

const C = BALANCE.challenge;
const setups = allSetups();
const positive = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0;

/** What is wrong with one setup, as readable lines; empty when it holds. */
function problems(n: NamedSetup): string[] {
  const s = n.setup;
  const out: string[] = [];
  const need = (ok: boolean, what: string) => ok || out.push(`${n.name}: ${what}`);
  need(positive(s.enemyHp), `enemyHp ${s.enemyHp}`);
  need(positive(s.wallHp), `wallHp ${s.wallHp}`);
  need(Number.isFinite(s.startGold) && s.startGold >= 0, `startGold ${s.startGold}`);
  for (const k of HERO_KINDS) {
    need(positive(s.heroDamage[k]), `heroDamage.${k} ${s.heroDamage[k]}`);
    need(Number.isInteger(s.heroLevels[k]) && s.heroLevels[k] >= 1, `heroLevels.${k} ${s.heroLevels[k]}`);
  }
  // the lineup: real kinds, no twice, as many as the mode promises
  const lineup = [...s.lineup];
  need(lineup.length > 0 && lineup.every((k) => HERO_KINDS.includes(k)) && new Set(lineup).size === lineup.length, `lineup [${lineup}]`);
  const c = n.challenge;
  const kinds = c?.mods.includes('solo') ? C.mods.solo.kinds : n.save.lineup.length;
  need(lineup.length === kinds, `lineup has ${lineup.length} kinds, not ${kinds}`);
  if (c?.trial) need(lineup.includes(c.trial), `lineup [${lineup}] lost the trial potion ${c.trial}`);
  // the twists on the rules
  const m = s.modifiers;
  if (m) {
    for (const k of ['enemySpeed', 'summonCost', 'waveGold', 'killGold'] as const) need(positive(m[k]), `modifiers.${k} ${m[k]}`);
    need(Number.isFinite(m.crit) && m.crit >= 0 && m.crit < 1, `modifiers.crit ${m.crit}`);
    need(m.bossWaves.every((w, i) => Number.isInteger(w) && w >= 1 && w <= BALANCE.waves.count && (i === 0 || w > m.bossWaves[i - 1])), `bossWaves [${m.bossWaves}]`);
    need(m.banned.every((id) => SKILL_IDS.includes(id)) && SKILL_IDS.length - m.banned.length >= 3, `banned [${m.banned}]`);
  }
  // the battle it starts: a summon on offer at t=0, prices and damage that make sense
  const b = new Battle(1, s);
  need(positive(b.summonCost()) && positive(b.upgradeCost()), `summon ${b.summonCost()} / upgrade ${b.upgradeCost()}`);
  need(b.canSummon(), `cannot summon at t=0: ${b.gold} gold, summon costs ${b.summonCost()}`);
  need(positive(b.wallMax), `wall ${b.wallMax}`);
  for (const k of HERO_KINDS) need(b.fixed.damage[k].every(positive), `shot damage ${k} [${b.fixed.damage[k]}]`);
  // every wave comes, with enemies that can be killed
  const waves = s.endless ? 60 : BALANCE.waves.count;
  const rng = new Prng(1);
  for (let w = 1; w <= waves; w++) {
    const plan = planWave(w, rng, s.stage, m, s.endless === true);
    const hp = plan.map((p) => Math.round(p.hp * s.enemyHp));
    need(plan.length > 0, `wave ${w} has no enemies`);
    need(hp.every(positive) && plan.every((p) => Number.isFinite(p.at) && p.at >= 0), `wave ${w} has a broken spawn`);
  }
  return out;
}

describe('every battle setup', () => {
  it('covers every mode, modifier and trial potion', () => {
    expect(new Set(setups.map((n) => n.mode))).toEqual(new Set(['story', 'endless', 'challenge']));
    const mods = new Set(setups.flatMap((n) => n.challenge?.mods ?? []));
    expect([...mods].sort()).toEqual([...MODIFIER_IDS].sort());
    expect(new Set(setups.flatMap((n) => (n.challenge?.trial ? [n.challenge.trial] : []))).size).toBe(HERO_KINDS.length);
    expect(setups.length).toBeGreaterThan(1500);
  });

  for (const mode of ['story', 'endless', 'challenge'] as const) {
    it(`holds for every ${mode} setup`, () => {
      expect(setups.filter((n) => n.mode === mode).flatMap(problems)).toEqual([]);
    });
  }
});

describe('the balance table behind them', () => {
  it('has only finite numbers', () => {
    const bad: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'number') {
        if (!Number.isFinite(v)) bad.push(path);
      } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(BALANCE, 'BALANCE');
    expect(bad).toEqual([]);
  });

  it('gives every challenge modifier positive numbers and a start gold that buys a summon', () => {
    const bad: string[] = [];
    for (const [id, mod] of Object.entries(C.mods)) for (const [k, v] of Object.entries(mod)) if (!(Array.isArray(v) ? v.every(positive) : positive(v))) bad.push(`${id}.${k} = ${v}`);
    expect(bad).toEqual([]);
    // the summon Cheap makes cheaper is the one Gold Rain's start gold has to buy at full price too
    expect(C.mods.goldRain.startGold).toBeGreaterThanOrEqual(BALANCE.summonCostBase);
  });
});
