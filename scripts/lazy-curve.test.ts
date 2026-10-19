// `npm run lazy`: how much slack the first waves leave a player who does next to nothing. The lazy
// player summons until LAZY (3) potions stand on the grid, then only takes the first skill of an
// offer: no merges, no upgrades (the commander casts by itself). Next to it the bot (botAct) and
// the bot acting every 2 s. For stages STAGES (1-5) and crystal BUDGETS (0,500,1500) it prints per
// wave the mean wall % left and enemies alive as the next wave starts, the share of runs lost by
// then, and the win rate. SEEDS (40) runs each; BAL='{...}' overrides balance.json.
import { it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { botAct } from '../src/sim/bot';
import { TICK_RATE } from '../src/sim/math/fixed';
import { battleSetup, buyHero, buyWorkshop, heroCost, newMeta, workshopCost, type MetaSave, type WorkshopId } from '../src/sim/meta';
import { BALANCE, LINEUP, type HeroKind } from '../src/sim/types';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

function merge(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
}

/** A save that has spent (up to) `budget` crystals, cheapest first, as in early-curve.test.ts. */
function saveFor(budget: number): MetaSave {
  const m = newMeta();
  m.crystals = budget;
  for (;;) {
    let best: { cost: number; buy: () => boolean } | null = null;
    for (const k of LINEUP) {
      const c = heroCost(m.heroes[k]);
      if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyHero(m, k as HeroKind) };
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

const LAZY = Number(env.LAZY ?? 3);

function lazyAct(b: Battle): void {
  if (b.choices) {
    b.choose(b.choices[0]);
    return;
  }
  if (b.slots.filter(Boolean).length < LAZY) b.summon();
}

const WAVES = 10;

/** One battle; per wave w (1-based) the wall share and enemies alive as wave w+1 starts (or at
 *  the end), and the wave it ended in. */
function run(seed: number, setup: ReturnType<typeof battleSetup>, act: (b: Battle) => void) {
  const b = new Battle(seed, setup);
  const wall: number[] = [];
  const alive: number[] = [];
  let wave = b.wave;
  for (let t = 0; t < 1200 * TICK_RATE && b.result === null; t++) {
    act(b);
    b.step();
    b.drain();
    if (b.wave !== wave || b.result !== null) {
      wall[wave - 1] = Math.max(0, b.wall) / b.wallMax;
      alive[wave - 1] = b.enemies.length;
      wave = b.wave;
    }
  }
  return { b, wall, alive };
}

it('lazy curve', () => {
  if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
  const seeds = Number(env.SEEDS ?? 40);
  const stages = (env.STAGES ?? '1,2,3,4,5').split(',').map(Number);
  const budgets = (env.BUDGETS ?? '0,500,1500').split(',').map(Number);
  const policies: [string, (b: Battle) => void][] = [
    ['lazy', lazyAct],
    ['bot', botAct],
    // the bot acting every 2 s (a skill pick at once): a slow but active player
    ['slow', (b: Battle) => {
      if (b.choices || b.time % (2 * TICK_RATE) === 0) botAct(b);
    }],
  ];
  const lines: string[] = [];
  for (const budget of budgets) {
    const m = saveFor(budget);
    for (const stage of stages) {
      for (const [name, act] of policies) {
        const runs = Array.from({ length: seeds }, (_, i) => run(1000 + i, battleSetup(m, stage), act));
        const cells: string[] = [];
        for (let w = 0; w < (name === 'lazy' ? 6 : WAVES); w++) {
          // a lost run counts 0 % wall from then on
          const wl = runs.map((r) => r.wall[w] ?? (r.b.result === 'lost' ? 0 : 1));
          const al = runs.filter((r) => r.alive[w] !== undefined).map((r) => r.alive[w]);
          const lost = runs.filter((r) => r.b.result === 'lost' && r.b.wave <= w + 1).length / seeds;
          const mw = (100 * wl.reduce((a, x) => a + x, 0)) / seeds;
          const ma = al.length ? al.reduce((a, x) => a + x, 0) / al.length : 0;
          cells.push(`${mw.toFixed(0).padStart(3)}%/${ma.toFixed(0).padStart(2)}${lost ? ` L${(lost * 100).toFixed(0)}` : ''}`);
        }
        const win = runs.filter((r) => r.b.result === 'won').length / seeds;
        lines.push(`b${String(budget).padEnd(5)} s${stage} ${name.padEnd(4)} win ${(win * 100).toFixed(0).padStart(3)}%  ${cells.join('  ')}`);
      }
    }
  }
  console.log(`${env.TAG ?? 'base'}: wall %/alive at the end of each wave (L = share lost by then), ${seeds} seeds\n${lines.join('\n')}`);
}, 3_600_000);
