// `npm run chapters`: the first-try win rate of every stage of the five chapters for the bot on
// the starting four, at the save the median player has on arrival (late-game.test.ts ARRIVE;
// bought out from stage 21 on). Per stage it also lists the chapter twists in play.
// SWEEP='0.8,0.9,1,1.1' plays each stage at those multiples of its enemy hit points instead, for
// tuning the curve (JSON only). STAGES=1-50 (default 9-50), SEEDS (default 60), TAG, OUT_DIR
// (default D:/fang/ref/balance/chapters), BAL='{...}' overrides balance.json. Shard by STAGES and
// run several side by side; `node scripts/chapter-report.mjs` joins the shards into one table.
import { it } from 'vitest';
import { playOut } from '../src/sim/bot';
import { chapterOf, stageTwists } from '../src/sim/chapters';
import { battleSetup, buyHero, buyWorkshop, heroCost, newMeta, workshopCost, type MetaSave, type WorkshopId } from '../src/sim/meta';
import { BALANCE } from '../src/sim/types';

function merge(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && into[k]) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
}

interface Fs {
  mkdirSync(p: string, o: { recursive: boolean }): void;
  writeFileSync(p: string, s: string): void;
}
const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined>; getBuiltinModule(id: string): unknown } }).process;
const env = proc.env;

/** Crystals spent on arrival: stages 1-20 as in late-game.test.ts; from 21 on what the median
 *  regular player (40 min a day, no ads) has spent on arriving there in `npm run economy` with
 *  heroMax 40 (25,875 at stage 21 to 207,710 at stage 51), smoothed to 7.2% more a stage. */
const ARRIVE = [0, 0, 290, 560, 865, 1195, 1555, 2330, 2830, 3550, 4755, 5545, 6665, 8250, 10095, 12700, 15380, 20305, 24385, 29600, 35500];
while (ARRIVE.length < 52) ARRIVE.push(Math.round((25875 * 1.072 ** (ARRIVE.length - 21)) / 5) * 5);

function saveFor(budget: number): MetaSave {
  const m = newMeta();
  m.crystals = budget;
  for (;;) {
    let best: { cost: number; buy: () => boolean } | null = null;
    for (const k of m.lineup) {
      const c = heroCost(m.heroes[k]);
      if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyHero(m, k) };
    }
    for (const id of ['wall', 'startGold', 'crystals'] as WorkshopId[]) {
      const c = workshopCost(id, m.workshop[id]);
      if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyWorkshop(m, id) };
    }
    if (!best || m.crystals < best.cost) break;
    best.buy();
  }
  m.crystals = 0;
  return m;
}

it('chapter curve', () => {
  if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
  const [a, b] = (env.STAGES ?? '9-50').split('-').map(Number);
  const stages = Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
  const seeds = Number(env.SEEDS ?? 60);
  const mults = (env.SWEEP ?? '1').split(',').map(Number);
  const rows = stages.map((stage) => {
    const setup = battleSetup(saveFor(ARRIVE[stage]), stage);
    const wins = mults.map((k) => {
      const s = { ...setup, enemyHp: setup.enemyHp * k };
      let won = 0;
      let wave = 0;
      for (let i = 0; i < seeds; i++) {
        const r = playOut(9000 + i, 1200, s);
        if (r.result === 'won') won++;
        wave += r.wave;
      }
      return { mult: k, win: won / seeds, wave: wave / seeds };
    });
    return { stage, chapter: chapterOf(stage), twists: stageTwists(stage), hp: setup.enemyHp, wins };
  });
  const fs = proc.getBuiltinModule('node:fs') as Fs;
  const dir = env.OUT_DIR ?? 'D:/fang/ref/balance/chapters';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/${env.TAG ?? 'base'}-${a}-${b ?? a}.json`, JSON.stringify(rows));
  for (const r of rows) console.log(`${r.stage}\tch${r.chapter}\t${r.twists.join('+') || '-'}\thp ${r.hp.toFixed(2)}\t${r.wins.map((w) => `${w.mult}:${Math.round(w.win * 100)}%`).join(' ')}`);
}, 7_200_000);
