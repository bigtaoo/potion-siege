// `npm run balance`: plays many bot battles and prints how far they get, for tuning balance.json.
// BAL='{"waves":{"hpGrowth":1.16}}' npm run balance tries overrides without editing the file.
import { it } from 'vitest';
import { playOut } from '../src/sim/bot';
import { BALANCE } from '../src/sim/types';

function merge(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
}

// the app's tsconfig has no Node types, so reach the environment through globalThis
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

it('balance report', () => {
  if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
  const runs = Array.from({ length: 60 }, (_, i) => playOut(1000 + i));
  const n = runs.length;
  const waves = runs.map((b) => b.wave).sort((a, b) => a - b);
  const wins = runs.filter((b) => b.result === 'won').length;
  const avg = (f: (b: (typeof runs)[number]) => number) => (runs.reduce((s, b) => s + f(b), 0) / n).toFixed(1);
  console.log(`wins ${wins}/${n}  waves min ${waves[0]} median ${waves[n >> 1]} max ${waves[n - 1]}  avg ${avg((b) => b.time)}s`);
  console.log(`avg upgrades ${avg((b) => b.upgrades)}  summons ${avg((b) => b.summons)}  commander ${avg((b) => b.commanderLevel)}`);
  // where the lost runs ended
  const lost = new Map<number, number>();
  for (const b of runs) if (b.result === 'lost') lost.set(b.wave, (lost.get(b.wave) ?? 0) + 1);
  console.log('lost at  ' + [...lost].sort((a, b) => a[0] - b[0]).map(([w, c]) => `w${w}:${c}`).join(' '));
});
