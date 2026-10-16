// `npm run early`: how hard the first stages are for a new player. Two parts, written as JSON to
// OUT_DIR (default D:/fang/ref/balance/early) so shards can run side by side:
//  EARLY_MODE=map       win rate on stages 1-8 for saves that have spent a crystal budget, bought in a
//                 fixed cheapest-first order (BUDGETS=0,300,... picks the budgets); every run
//                 also records whether one revive would have saved it.
//  EARLY_MODE=campaign  PLAYERS simulated players from a fresh save over DAYS days with RUNS runs a day:
//                 the bot plays the furthest open stage, crystals from runs, login, tasks, the
//                 free chest and (ADS=1) the shop ads, the revive and the result ×2; after every
//                 run it buys in the same order. Records crystals spent and first clears per run.
// BAL='{...}' overrides balance.json as in balance.test.ts; EARLY_HP='0.8,0.85,0.9,0.95' scales
// the enemy hit points of stages 1, 2, ... to try a softer start without touching the code.
import { it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { TICK_RATE } from '../src/sim/math/fixed';
import { botAct } from '../src/sim/bot';
import { addProgress, claimLogin, claimTask, rollDay } from '../src/sim/daily';
import { battleSetup, buyHero, buyWorkshop, claimAd, claimChest, heroCost, newMeta, Purse, workshopCost, type MetaSave, type WorkshopId } from '../src/sim/meta';
import { BALANCE, LINEUP, type HeroKind } from '../src/sim/types';

function merge(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
}

interface Fs {
  mkdirSync(p: string, o: { recursive: boolean }): void;
  writeFileSync(p: string, s: string): void;
}
const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined>; getBuiltinModule(id: string): unknown } }).process;
const env = proc.env;
const earlyHp = (env.EARLY_HP ?? '').split(',').filter(Boolean).map(Number);

/** The next thing a player buys: the cheapest hero level of the fielded four or workshop
 *  level (heroes first on a tie); null when nothing is left. */
function nextBuy(m: MetaSave): { cost: number; buy: () => boolean } | null {
  let best: { cost: number; buy: () => boolean } | null = null;
  for (const k of LINEUP) {
    const c = heroCost(m.heroes[k]);
    if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyHero(m, k as HeroKind) };
  }
  for (const id of ['wall', 'startGold', 'crystals'] as WorkshopId[]) {
    const c = workshopCost(id, m.workshop[id]);
    if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyWorkshop(m, id) };
  }
  return best;
}

/** Buys in order while the next item is affordable; returns crystals spent. */
function spend(m: MetaSave): number {
  let spent = 0;
  for (let n = nextBuy(m); n && m.crystals >= n.cost; n = nextBuy(m)) {
    n.buy();
    spent += n.cost;
  }
  return spent;
}

/** A save that has spent (up to) `budget` crystals. */
function saveFor(budget: number): MetaSave {
  const m = newMeta();
  m.crystals = budget;
  spend(m);
  m.crystals = 0;
  return m;
}

function setupFor(m: MetaSave, stage: number) {
  const s = battleSetup(m, stage);
  if (earlyHp[stage - 1] !== undefined) s.enemyHp *= earlyHp[stage - 1];
  return s;
}

interface Played {
  b: Battle;
  /** Lost before the revive. */
  lostFirst: boolean;
  revived: boolean;
  skills: number;
}

/** One bot battle; `revive` takes the one rewarded revive after a loss. Events go to `onEvents`. */
function play(seed: number, setup: ReturnType<typeof battleSetup>, revive: boolean, onEvents?: (b: Battle) => void): Played {
  const b = new Battle(seed, setup);
  let skills = 0;
  let lostFirst = false;
  let revived = false;
  for (;;) {
    for (let t = 0; t < 1200 * TICK_RATE && b.result === null; t++) {
      if (b.choices) skills++;
      botAct(b);
      b.step();
      onEvents?.(b);
      b.drain();
    }
    if (b.result === 'lost' && !revived) {
      lostFirst = true;
      if (!revive) break;
      revived = true;
      b.revive();
      continue;
    }
    break;
  }
  return { b, lostFirst, revived, skills };
}

function write(name: string, data: unknown): void {
  const fs = proc.getBuiltinModule('node:fs') as Fs;
  const dir = env.OUT_DIR ?? 'D:/fang/ref/balance/early';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/${name}`, JSON.stringify(data));
}

function dayName(d: number): string {
  const t = new Date(Date.UTC(2026, 0, 1 + d));
  return t.toISOString().slice(0, 10);
}

it('early curve', () => {
  if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
  const tag = env.TAG ?? 'base';
  if ((env.EARLY_MODE ?? 'map') === 'map') {
    const budgets = (env.BUDGETS ?? '0,150,300,500,750,1000,1500,2000,3000,4500').split(',').map(Number);
    const seeds = Number(env.SEEDS ?? 60);
    const rows: { budget: number; stage: number; win: number; winRevive: number; wave: number; levels: number[]; workshop: number[] }[] = [];
    for (const budget of budgets) {
      const m = saveFor(budget);
      let zeros = 0;
      for (let stage = 1; stage <= 8; stage++) {
        const runs = Array.from({ length: seeds }, (_, i) => play(1000 + i, setupFor(m, stage), true));
        const win = runs.filter((r) => !r.lostFirst).length / seeds;
        const winRevive = runs.filter((r) => r.b.result === 'won').length / seeds;
        rows.push({ budget, stage, win, winRevive, wave: runs.reduce((s, r) => s + r.b.wave, 0) / seeds, levels: LINEUP.map((k) => m.heroes[k]), workshop: [m.workshop.wall, m.workshop.startGold, m.workshop.crystals] });
        zeros = winRevive === 0 ? zeros + 1 : 0;
        if (zeros >= 2) break;
      }
    }
    write(`map-${tag}-${budgets.join('_')}.json`, rows);
    return;
  }
  // campaign
  const players = Number(env.PLAYERS ?? 8);
  const first = Number(env.PLAYER0 ?? 0);
  const days = Number(env.DAYS ?? 10);
  const runsPerDay = Number(env.RUNS ?? 5);
  const ads = env.ADS === '1';
  const out: { player: number; log: { day: number; run: number; stage: number; won: boolean; wave: number; earned: number; spent: number; cleared: number }[] }[] = [];
  for (let p = first; p < first + players; p++) {
    const m = newMeta();
    let spent = 0;
    let run = 0;
    const log: (typeof out)[number]['log'] = [];
    for (let d = 0; d < days; d++) {
      const today = dayName(d);
      rollDay(m, today);
      claimLogin(m, today);
      claimChest(m, today);
      if (ads) for (let i = 0; i < 3; i++) claimAd(m, today);
      spent += spend(m);
      for (let r = 0; r < runsPerDay; r++) {
        const stage = m.stage;
        const before = m.crystals;
        const purse = new Purse();
        const pl = play(70000 + p * 1000 + run, setupFor(m, stage), ads, (b) => {
          for (const ev of b.drain()) {
            if (ev.type === 'summon') addProgress(m, 'summon');
            else if (ev.type === 'merge') {
              addProgress(m, 'merge');
              if (ev.star === BALANCE.maxStar) addProgress(m, 'ultimate');
            } else if (ev.type === 'kill') {
              addProgress(m, 'kill');
              if (ev.boss) addProgress(m, 'boss');
            }
          }
        });
        addProgress(m, 'play');
        addProgress(m, 'skill', pl.skills);
        const b = pl.b;
        if (b.result === 'won') addProgress(m, 'win');
        purse.settle(m, { stage, won: b.result === 'won', wave: b.wave, kills: b.kills });
        if (ads) purse.double(m, true);
        for (let i = 0; i < m.daily.tasks.length; i++) claimTask(m, i);
        const earned = m.crystals - before;
        spent += spend(m);
        log.push({ day: d + 1, run: ++run, stage, won: b.result === 'won', wave: b.wave, earned, spent, cleared: m.cleared });
      }
    }
    out.push({ player: p, log });
  }
  write(`campaign-${tag}-${ads ? 'ads' : 'noads'}-r${runsPerDay}-p${first}.json`, out);
}, 7_200_000);
