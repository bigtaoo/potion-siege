// `npm run gaps`: how long the field stands empty in a battle. The bot (botAct) plays stages
// STAGES (1-10) on the save the median player has when they first try each (ARRIVE), SEEDS (40)
// seeds each, and stage 1 once more on FIRST_SEED with a fresh save, the new player's first battle.
// Each tick counts the enemies on the field (any part of them below its top edge); per stage it
// prints the empty seconds a run (mean, worst), the longest empty stretch, how many stretches,
// the seconds with one or two left ("thin"), the win rate, the mean battle length and the waves
// the empty time falls in.
// BAL='{...}' overrides balance.json as in balance.test.ts.
import { it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { botAct } from '../src/sim/bot';
import { K } from '../src/sim/field';
import { TICK_RATE } from '../src/sim/math/fixed';
import { battleSetup, FIRST_SEED, newMeta } from '../src/sim/meta';
import { BALANCE } from '../src/sim/types';
import { ARRIVE, mean, saveFor } from './guard/saves';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

function merge(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
}

/** Enemies with some of their body on the field. */
const onField = (b: Battle) => b.enemies.filter((e) => e.y + e.radius > K.top).length;

/** One battle: empty and thin ticks, the empty stretches (in ticks) and the empty ticks by wave. */
function run(seed: number, setup: ReturnType<typeof battleSetup>) {
  const b = new Battle(seed, setup);
  let empty = 0;
  let thin = 0;
  let stretch = 0;
  const stretches: number[] = [];
  const byWave: number[] = [];
  for (let t = 0; t < 1200 * TICK_RATE && b.result === null; t++) {
    botAct(b);
    b.step();
    b.drain();
    if (b.result !== null) break;
    const n = onField(b);
    if (n === 0) {
      empty++;
      stretch++;
      byWave[b.wave - 1] = (byWave[b.wave - 1] ?? 0) + 1;
    } else if (stretch > 0) {
      stretches.push(stretch);
      stretch = 0;
    }
    if (n > 0 && n <= 2) thin++;
  }
  if (stretch > 0) stretches.push(stretch);
  return { b, empty, thin, stretches, byWave };
}

const s = (ticks: number) => (ticks / TICK_RATE).toFixed(1);

function report(label: string, runs: ReturnType<typeof run>[]): void {
  const empties = runs.map((r) => r.empty);
  const longest = Math.max(0, ...runs.flatMap((r) => r.stretches));
  const count = mean(runs.map((r) => r.stretches.length));
  const waves = Array.from({ length: BALANCE.waves.count }, (_, w) => s(mean(runs.map((r) => r.byWave[w] ?? 0)))).join(' ');
  const won = runs.filter((r) => r.b.result === 'won').length / runs.length;
  console.log(
    `${label.padEnd(12)} empty ${s(mean(empties)).padStart(5)} s (worst ${s(Math.max(...empties)).padStart(5)})  longest ${s(longest).padStart(5)}  stretches ${count.toFixed(1).padStart(4)}  thin ${s(mean(runs.map((r) => r.thin))).padStart(5)}  won ${Math.round(won * 100)}%  length ${s(mean(runs.map((r) => r.b.time))).padStart(5)} s  by wave ${waves}`,
  );
}

it('empty field', () => {
  if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
  const seeds = Number(env.SEEDS ?? 40);
  const stages = (env.STAGES ?? '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
  report('first 1764', [run(FIRST_SEED, battleSetup(newMeta(), 1))]);
  for (const stage of stages) {
    const setup = battleSetup(saveFor(ARRIVE[stage - 1]), stage);
    report(`stage ${stage}`, Array.from({ length: seeds }, (_, i) => run(1000 + i, setup)));
  }
}, 1_200_000);
