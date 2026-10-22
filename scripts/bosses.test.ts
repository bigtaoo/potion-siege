// `npm run bosses`: each chapter boss against the steam tank on the same stages and seeds. Per
// stage of the boss's chapter it plays the bot with the starting four at the "arrive" save
// (scripts/guard/saves.ts, as npm run chapters) twice - once with the chapter's boss, once with the tank in its place - and
// reports the win rate, the wall lost in the boss waves and how long the bosses lived.
// SEEDS (default 40), BOSS=clock (default: every chapter boss), STAGES=11-20 overrides the range:
// the boss then stands in for the boss of the chapter those stages are in, so a later boss can be
// measured on stages whose curve is already tuned. BAL='{...}' overrides balance.json.
import { it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { botAct } from '../src/sim/bot';
import { TICK_RATE } from '../src/sim/math/fixed';
import { battleSetup } from '../src/sim/meta';
import { BALANCE, BOSS_KINDS, isBoss, type BossKind } from '../src/sim/types';
import { bossForStage, FIRST_STAGE } from '../src/sim/waves';
// the arrive saves the chapter curve and the guard play (7.2% more a stage past 21), bought cheapest first
import { ARRIVE, saveFor } from './guard/saves';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

function merge(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
}

interface Run {
  won: boolean;
  /** Wall lost in the boss waves, as a share of the wall's maximum. */
  bossWall: number;
  /** Seconds each boss lived, from its spawn to its death or the end. */
  lived: number[];
  /** Bosses that got to the wall. */
  reached: number;
}

function play(seed: number, stage: number): Run {
  const b = new Battle(seed, battleSetup(saveFor(ARRIVE[stage]), stage));
  const born = new Map<number, number>();
  const lived: number[] = [];
  const reached = new Set<number>();
  let bossWall = 0;
  for (let t = 0; t < 1200 * TICK_RATE && b.result === null; t++) {
    botAct(b);
    const before = b.wall;
    b.step();
    b.drain();
    const alive = new Set<number>();
    for (const e of b.enemies) {
      if (!isBoss(e.kind)) continue;
      alive.add(e.id);
      if (!born.has(e.id)) born.set(e.id, b.time);
      if (e.atWall) reached.add(e.id);
    }
    for (const [id, at] of born) if (!alive.has(id) && at >= 0) (lived.push((b.time - at) / TICK_RATE), born.set(id, -1));
    if (b.wave === 5 || b.wave === 10) bossWall += Math.max(0, before - b.wall);
  }
  for (const at of born.values()) if (at >= 0) lived.push((b.time - at) / TICK_RATE);
  return { won: b.result === 'won', bossWall: bossWall / b.wallMax, lived, reached: reached.size };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const pct = (x: number) => `${Math.round(x * 100)}%`;

it('compares each chapter boss with the steam tank', () => {
  if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
  const seeds = Number(env.SEEDS ?? 40);
  const kinds = (env.BOSS ? [env.BOSS] : BOSS_KINDS.slice(1)) as BossKind[];
  const slots = BOSS_KINDS as unknown as BossKind[];
  const lines: string[] = [];
  for (const kind of kinds) {
    const first = FIRST_STAGE[kind];
    const [lo, hi] = env.STAGES ? env.STAGES.split('-').map(Number) : [first, first + BALANCE.bosses.chapter - 1];
    const own = bossForStage(lo);
    const idx = slots.indexOf(own);
    lines.push(`\n## ${kind} vs boss (stages ${lo}-${hi}, ${seeds} seeds, arrive saves)\n`);
    lines.push('| stage | win tank | win new | boss-wave wall tank | new | boss lived s tank | new | bosses at wall tank | new |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    const sum = { wt: 0, wn: 0, ft: 0, fn: 0, lt: 0, ln: 0 };
    for (let stage = lo; stage <= hi; stage++) {
      const runs = (as: BossKind) => {
        slots[idx] = as;
        const out = Array.from({ length: seeds }, (_, i) => play(i + 1, stage));
        slots[idx] = own;
        return out;
      };
      const tank = runs('boss');
      const fresh = runs(kind);
      const row = (rs: Run[]) => ({
        win: rs.filter((r) => r.won).length / rs.length,
        wall: mean(rs.map((r) => r.bossWall)),
        lived: mean(rs.flatMap((r) => r.lived)),
        reached: mean(rs.map((r) => r.reached)),
      });
      const t = row(tank);
      const n = row(fresh);
      sum.wt += t.win; sum.wn += n.win; sum.ft += t.wall; sum.fn += n.wall; sum.lt += t.lived; sum.ln += n.lived;
      lines.push(`| ${stage} | ${pct(t.win)} | ${pct(n.win)} | ${pct(t.wall)} | ${pct(n.wall)} | ${t.lived.toFixed(1)} | ${n.lived.toFixed(1)} | ${t.reached.toFixed(2)} | ${n.reached.toFixed(2)} |`);
    }
    const k = hi - lo + 1;
    lines.push(`| **mean** | ${pct(sum.wt / k)} | ${pct(sum.wn / k)} | ${pct(sum.ft / k)} | ${pct(sum.fn / k)} | ${(sum.lt / k).toFixed(1)} | ${(sum.ln / k).toFixed(1)} | | |`);
  }
  console.log(lines.join('\n'));
}, 3_600_000);
