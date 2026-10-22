// `npm run targeting`: what each potion's pick of target (src/sim/targetPick.ts) comes to. Per
// lineup (the starting four, corrosion for the frost and the gale tonic for the lightning) and
// stage, the bot on the median player's save on arrival (scripts/guard/saves.ts): the win rate,
// each potion's share of the damage dealt and the share of its damage wasted (Battle.wasted: past
// the last hit points, or on a target dead before the shot landed). Ends with the shares pooled
// over the stages. STAGES=1,3,5 (default 1,3,5,8,10,15,20,30,40,50), SEEDS (default 40),
// BAL='{...}' overrides balance.json.
import { it } from 'vitest';
import type { Battle } from '../src/sim/battle';
import { playOut } from '../src/sim/bot';
import { battleSetup } from '../src/sim/meta';
import { BALANCE, LINEUP, type HeroKind } from '../src/sim/types';
import { ARRIVE, saveFor, winRate } from './guard/saves';

function merge(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && into[k]) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
}

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

const swap = (out: HeroKind, into: HeroKind) => LINEUP.map((k) => (k === out ? into : k));
const LINEUPS: [string, HeroKind[]][] = [
  ['starting four', [...LINEUP]],
  ['corrosion for frost', swap('ice', 'poison')],
  ['gale for lightning', swap('lightning', 'wind')],
];

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Pooled over `runs`: each potion's share of the damage dealt and of its own damage wasted. */
function shares(runs: Battle[], kinds: readonly HeroKind[]) {
  const dealt = (k: HeroKind) => runs.reduce((s, b) => s + b.dealt[k], 0);
  const wasted = (k: HeroKind) => runs.reduce((s, b) => s + b.wasted[k], 0);
  const total = kinds.reduce((s, k) => s + dealt(k), 0) || 1;
  const all = kinds.reduce((s, k) => s + dealt(k) + wasted(k), 0) || 1;
  return {
    share: kinds.map((k) => dealt(k) / total),
    waste: kinds.map((k) => wasted(k) / (dealt(k) + wasted(k) || 1)),
    allWaste: kinds.reduce((s, k) => s + wasted(k), 0) / all,
  };
}

it('targeting', () => {
  if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
  const stages = (env.STAGES ?? '1,3,5,8,10,15,20,30,40,50').split(',').map(Number);
  const seeds = Number(env.SEEDS ?? 40);
  const out: string[] = [`# Targeting (${seeds} seeds a cell${env.BAL ? `, BAL=${env.BAL}` : ''})`];
  for (const [name, kinds] of LINEUPS) {
    out.push('', `## ${name}`, '', `| stage | win | ${kinds.join(' | ')} | wasted |`, `|---|---|${kinds.map(() => '---').join('|')}|---|`);
    const pooled: Battle[] = [];
    for (const stage of stages) {
      const setup = battleSetup(saveFor(ARRIVE[stage], kinds), stage);
      const runs = Array.from({ length: seeds }, (_, i) => playOut(1000 + i, 1200, setup));
      pooled.push(...runs);
      const s = shares(runs, kinds);
      out.push(`| ${stage} | ${pct(winRate(runs))} | ${kinds.map((_, i) => `${pct(s.share[i])} (${pct(s.waste[i])})`).join(' | ')} | ${pct(s.allWaste)} |`);
    }
    const s = shares(pooled, kinds);
    out.push(`| all | ${pct(winRate(pooled))} | ${kinds.map((_, i) => `${pct(s.share[i])} (${pct(s.waste[i])})`).join(' | ')} | ${pct(s.allWaste)} |`);
  }
  out.push('', 'Cells: share of the damage dealt (share of that potion\'s damage wasted).');
  console.log(out.join('\n'));
});
