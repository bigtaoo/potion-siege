// `npm run sweep`: the bot through every way to play, as markdown tables for
// ref/design/mode-sweep-2026-10.md. Story stages on the median player's save for each stage,
// endless on three saves, the daily challenge on four saves under no modifier, each one alone and
// every pair (and every triple on the fresh save), and the revive. Per row: win rate, the wave
// runs end on, the challenge tiers reached, when the first potion is on the wall and how many runs
// hit the time cap. SEEDS (default 20); ONLY=story,endless,challenge,triples,revive picks parts.
import { it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { botAct } from '../src/sim/bot';
import { challengeSetup, tierOf, type ModifierId } from '../src/sim/challenge';
import { TICK_RATE } from '../src/sim/math/fixed';
import { battleSetup, type BattleSetup, type MetaSave } from '../src/sim/meta';
import { endlessSetup } from '../src/sim/endless';
import { arrive, challengeFor, modifierSets, SAVES, spentSave, type SaveId } from '../src/sim/setupCatalog';
import { BALANCE } from '../src/sim/types';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const SEEDS = Number(env.SEEDS ?? 20);
const ONLY = (env.ONLY ?? 'story,endless,challenge,triples,revive').split(',');

interface Run {
  won: boolean;
  wave: number;
  seconds: number;
  /** Seconds until a potion first stood on the wall, or Infinity. */
  first: number;
  /** The run was still going at the cap. */
  capped: boolean;
  /** Ticks it sat paused on nothing to choose (a dead end). */
  stuck: number;
}

function run(seed: number, setup: BattleSetup, cap: number, revive = false): Run & { revived?: Run } {
  const b = new Battle(seed, setup);
  let first = Infinity;
  let stuck = 0;
  const go = () => {
    for (let t = 0; t < cap * TICK_RATE && b.result === null; t++) {
      botAct(b);
      if (b.paused && b.result === null && !b.choices?.length) stuck++;
      b.step();
      b.drain();
      if (first === Infinity && b.slots.some((h) => h)) first = b.seconds;
    }
  };
  // a function, so the revived battle's result is read afresh (not narrowed to 'lost')
  const sum = (): Run => ({ won: b.result === 'won', wave: b.wave, seconds: b.seconds, first, capped: b.result === null, stuck });
  go();
  const out = sum();
  if (!revive || b.result !== 'lost') return out;
  b.revive();
  go();
  return { ...out, revived: sum() };
}

function runs(setup: (seed: number) => BattleSetup, cap: number, revive = false) {
  return Array.from({ length: SEEDS }, (_, i) => run(i + 1, setup(i + 1), cap, revive));
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const share = (rs: Run[], f: (r: Run) => boolean) => rs.filter(f).length / Math.max(1, rs.length);
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '∞');
const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const flags = (rs: Run[]) => [rs.some((r) => r.capped) && 'cap', rs.some((r) => r.stuck > 0) && 'stuck', rs.some((r) => r.first > 10) && 'slow start'].filter(Boolean).join(', ') || '';

it('story stages', () => {
  if (!ONLY.includes('story')) return;
  const rows = [];
  for (let stage = 1; stage <= BALANCE.meta.stageCount; stage++) {
    const m = spentSave(stage - 1, arrive(stage));
    const rs = runs(() => battleSetup(m, stage), 1200);
    rows.push([stage, pct(share(rs, (r) => r.won)), q(rs.map((r) => r.wave), 0.5), Math.round(mean(rs.map((r) => r.seconds))), f1(Math.max(...rs.map((r) => r.first))), flags(rs)]);
  }
  console.log(`\n### story (SEEDS=${SEEDS}, save: median arrival)\n${table(['stage', 'win', 'median wave', 'mean s', 'first potion (max s)', 'flags'], rows)}`);
});

it('endless', () => {
  if (!ONLY.includes('endless')) return;
  const saves: [string, MetaSave][] = [['stage 10 clear', spentSave(10, arrive(11))], ['stage 30 clear', spentSave(30, arrive(31))], ['maxed', SAVES.maxed()]];
  const rows = saves.map(([name, m]) => {
    const rs = runs(() => endlessSetup(m), 7200);
    const w = rs.map((r) => r.wave);
    return [name, q(w, 0.1), q(w, 0.5), q(w, 0.9), Math.round(mean(rs.map((r) => r.seconds))), f1(Math.max(...rs.map((r) => r.first))), flags(rs)];
  });
  console.log(`\n### endless (SEEDS=${SEEDS}, cap 7200 s)\n${table(['save', 'p10 wave', 'median wave', 'p90 wave', 'mean s', 'first potion (max s)', 'flags'], rows)}`);
});

function challengeTable(save: SaveId, sets: ModifierId[][]): string {
  const m = SAVES[save]();
  const plain = runs((seed) => challengeSetup(m, challengeFor(m, [], seed)), 1200);
  const base = share(plain, (r) => r.won);
  const rows = [[], ...sets].map((mods) => {
    const rs = mods.length ? runs((seed) => challengeSetup(m, challengeFor(m, mods, seed)), 1200) : plain;
    const win = share(rs, (r) => r.won);
    const tiers = [1, 2, 3].map((t) => pct(share(rs, (r) => tierOf(r.wave) >= t)));
    const low = mods.length && (win === 0 || win < base * 0.5) ? '**low**' : '';
    return [mods.join(' + ') || 'plain', pct(win), q(rs.map((r) => r.wave), 0.5), ...tiers, f1(Math.max(...rs.map((r) => r.first))), [low, flags(rs)].filter(Boolean).join(', ')];
  });
  const stage = challengeFor(m, [], 1).stage;
  return `\n### challenge, ${save} save (stage ${stage}, SEEDS=${SEEDS})\n${table(['modifiers', 'win', 'median wave', 'tier 1 (w3)', 'tier 2 (w6)', 'tier 3 (w10)', 'first potion (max s)', 'flags'], rows)}`;
}

it('challenge: plain, singles and pairs', () => {
  if (!ONLY.includes('challenge')) return;
  for (const save of ['new', 'fresh', 'mid', 'late'] as SaveId[]) console.log(challengeTable(save, [...modifierSets(1), ...modifierSets(2)]));
});

it('challenge: triples', () => {
  if (!ONLY.includes('triples')) return;
  console.log(challengeTable('fresh', modifierSets(3)));
});

it('revive', () => {
  if (!ONLY.includes('revive')) return;
  const rows = [];
  for (const stage of [3, 10, 15, 20, 30, 40, 50]) {
    const m = spentSave(stage - 1, arrive(stage));
    const rs = runs(() => battleSetup(m, stage), 1200, true);
    const lost = rs.filter((r) => 'revived' in r && r.revived);
    const after = lost.map((r) => r.revived!);
    rows.push([`stage ${stage}`, `${lost.length}/${rs.length}`, pct(share(after, (r) => r.won)), lost.length ? f1(mean(after.map((r, i) => r.wave - lost[i].wave))) : '-', flags(after)]);
  }
  const m = spentSave(10, arrive(11));
  const rs = runs(() => endlessSetup(m), 7200, true);
  const lost = rs.filter((r) => r.revived);
  const after = lost.map((r) => r.revived!);
  rows.push(['endless (stage 10 clear)', `${lost.length}/${rs.length}`, '-', f1(mean(after.map((r, i) => r.wave - lost[i].wave))), flags(after)]);
  console.log(`\n### revive (SEEDS=${SEEDS})\n${table(['battle', 'lost', 'won after revive', 'waves gained', 'flags'], rows)}`);
});
