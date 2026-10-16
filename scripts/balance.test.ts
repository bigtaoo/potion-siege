// `npm run balance`: plays many seeded bot battles per stage and meta-progress level and prints
// win rate, waves reached, time, each potion's share of the damage and the skills taken in won
// and lost runs, for tuning balance.json. Also written to D:\fang\ref\balance\<OUT or report.md>.
// BAL='{"waves":{"hpGrowth":1.16}}' npm run balance tries overrides without editing the file;
// SEEDS=20 STAGES=1-8 LEVELS=fresh,mid narrow the run, FORCED_SETS the forced rows,
// FORCED_SEEDS=300 steadies them (±7pp at the default 100), FORCED_LINEUP=arcane,fire,lightning,poison
// fields corrosion for them (or ...,wind the gale tonic), LINEUPS=0 skips the swapped-in lineups,
// LINEUP_EXTRA=wind swaps in only the gale tonic.
import { it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { botAct, playOut } from '../src/sim/bot';
import { battleSetup, newMeta, type MetaSave } from '../src/sim/meta';
import { SKILL_IDS, skillHeroes, type SkillId } from '../src/sim/skills';
import { BALANCE, HERO_KINDS, LINEUP, type HeroKind } from '../src/sim/types';

function merge(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
}

// the app's tsconfig has no Node types, so reach the environment through globalThis
interface Fs {
  mkdirSync(p: string, o: { recursive: boolean }): void;
  writeFileSync(p: string, s: string): void;
}
const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined>; getBuiltinModule(id: string): unknown } }).process;
const env = proc.env;

/** Meta progress a player could have: what the battle setup is built from. */
const LEVELS: Record<string, (m: MetaSave) => void> = {
  fresh: () => {},
  mid: (m) => {
    for (const k of HERO_KINDS) m.heroes[k] = 5;
    m.workshop = { wall: 3, startGold: 3, crystals: 2 };
  },
  late: (m) => {
    for (const k of HERO_KINDS) m.heroes[k] = 12;
    m.workshop = { wall: 8, startGold: 8, crystals: 6 };
  },
  // every milestone open, so the recipes (plasma, burst bolts, ...) and fireChain turn up
  max: (m) => {
    for (const k of HERO_KINDS) m.heroes[k] = BALANCE.meta.heroMax;
    m.workshop = { wall: 10, startGold: 10, crystals: 10 };
  },
};

const RECIPES: SkillId[] = SKILL_IDS.filter((id) => skillHeroes(id).with !== undefined);

interface Cell {
  level: string;
  stage: number;
  runs: Battle[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const quant = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** Damage share per potion, pooled over the runs. */
function shares(runs: Battle[], kinds: readonly HeroKind[]): Record<HeroKind, number> {
  const sum = Object.fromEntries(HERO_KINDS.map((k) => [k, 0])) as Record<HeroKind, number>;
  for (const b of runs) for (const k of kinds) sum[k] += b.dealt[k];
  const total = kinds.reduce((s, k) => s + sum[k], 0) || 1;
  for (const k of kinds) sum[k] /= total;
  return sum;
}

function stageTable(cells: Cell[], kinds: readonly HeroKind[]): string[] {
  const out = [`| lvl | st | win | wave μ | p10–p90 | time μ | ${kinds.map((k) => k.slice(0, 5)).join(' | ')} |`];
  out.push(`|---|---|---|---|---|---|${kinds.map(() => '---').join('|')}|`);
  for (const c of cells) {
    const waves = c.runs.map((b) => b.wave);
    const win = c.runs.filter((b) => b.result === 'won').length / c.runs.length;
    const sh = shares(c.runs, kinds);
    out.push(
      `| ${c.level} | ${c.stage} | ${pct(win)} | ${mean(waves).toFixed(1)} | ${quant(waves, 0.1)}–${quant(waves, 0.9)} | ${mean(c.runs.map((b) => b.time)).toFixed(0)}s | ${kinds.map((k) => pct(sh[k])).join(' | ')} |`,
    );
  }
  return out;
}

/** Per level: how often each skill was taken in won and lost runs of the contested stages
 *  (win rate 10–90%), and the win rate of runs that took it. Lost runs end earlier with fewer
 *  picks, so compare a skill against the others, not against 0. */
function skillTable(level: string, cells: Cell[]): string[] {
  const contested = cells.filter((c) => {
    const w = c.runs.filter((b) => b.result === 'won').length / c.runs.length;
    return c.level === level && w >= 0.1 && w <= 0.9;
  });
  const runs = contested.flatMap((c) => c.runs);
  if (runs.length === 0) return [`(${level}: no contested stage)`];
  const won = runs.filter((b) => b.result === 'won');
  const lost = runs.filter((b) => b.result !== 'won');
  const rows = SKILL_IDS.map((id) => {
    const took = runs.filter((b) => b.skills[id] > 0);
    const wr = took.filter((b) => b.result === 'won').length / Math.max(1, took.length);
    return { id, inWon: won.filter((b) => b.skills[id] > 0).length / Math.max(1, won.length), inLost: lost.filter((b) => b.skills[id] > 0).length / Math.max(1, lost.length), n: took.length, wr };
  }).filter((r) => r.n > 0);
  rows.sort((a, b) => b.wr - a.wr);
  const base = won.length / runs.length;
  const out = [`${level}: stages ${contested.map((c) => c.stage).join(',')} — ${runs.length} runs, win ${pct(base)}`, '', '| skill | in won | in lost | taken by | win when taken |', '|---|---|---|---|---|'];
  for (const r of rows) out.push(`| ${RECIPES.includes(r.id) ? '**' + r.id + '**' : r.id} | ${pct(r.inWon)} | ${pct(r.inLost)} | ${r.n} | ${pct(r.wr)} |`);
  return out;
}

function stages(): number[] {
  const [a, b] = (env.STAGES ?? `1-${BALANCE.meta.stageCount}`).split('-').map(Number);
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
}

function play(level: string, stage: number, seeds: number, lineup?: HeroKind[]): Cell {
  const m = newMeta();
  LEVELS[level](m);
  if (lineup) m.lineup = lineup;
  const setup = battleSetup(m, stage);
  return { level, stage, runs: Array.from({ length: seeds }, (_, i) => playOut(1000 + i, 1 / 30, 1200, setup)) };
}

/** Skill sets granted at the start of a battle, to judge a recipe or a line on its own: the bot
 *  takes too few cards for that to show in normal runs. */
const FORCED: SkillId[][] = [
  [],
  // one generic or class damage card, to measure the others against
  ['allDamage'],
  ['allSpeed'],
  ['arcanePower'],
  ['fireDamage'],
  ['iceDamage'],
  ['lightningDamage'],
  // the line skills and recipes, one card each
  ['arcaneMark'],
  ['arcaneMulti'],
  ['arcaneSplit'],
  ['fireBurn'],
  ['fireChain'],
  ['iceFreeze'],
  ['iceFrostbite'],
  ['iceShatter'],
  ['lightningStatic'],
  ['lightningStrike'],
  ['lightningChain'],
  ['fireArcane'],
  ['iceLightning'],
  ['arcaneIce'],
  ['lightningFire'],
  // the suspected combo
  ['lightningFire', 'fireChain'],
  ['fireBurn', 'fireChain'],
  // the ice line together, as a player who goes all in on it would have it
  ['iceFrostbite', 'iceShatter'],
  ['iceFreeze', 'iceFrostbite', 'iceShatter'],
  // the corrosion line, with FORCED_LINEUP=arcane,fire,lightning,poison (or any lineup with poison)
  ['poisonDamage'],
  ['poisonRust'],
  ['poisonSplash'],
  ['poisonMelt'],
  ['poisonLightning'],
  ['poisonSplash', 'poisonMelt'],
  // the gale line, with FORCED_LINEUP=arcane,fire,lightning,wind (windFire needs fire fielded)
  ['windDamage'],
  ['windPush'],
  ['windHaste'],
  ['windGust'],
  ['windVortex'],
  ['windFire'],
  ['windPush', 'windGust'],
];

function playForced(seed: number, setup: ReturnType<typeof battleSetup>, skills: SkillId[]): Battle {
  const b = new Battle(seed, setup);
  for (const id of skills) {
    b.choices = [id];
    b.choose(id);
  }
  for (let t = 0; t < 1200 && b.result === null; t += 1 / 30) {
    botAct(b);
    b.step(1 / 30);
    b.drain();
  }
  return b;
}

it('balance report', () => {
  if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
  const seeds = Number(env.SEEDS ?? 40);
  const levels = (env.LEVELS ?? 'fresh,mid,late,max').split(',');
  const t0 = Date.now();
  const cells: Cell[] = [];
  for (const level of levels) {
    for (const stage of stages()) {
      const c = play(level, stage, seeds);
      cells.push(c);
      // past the stage nobody wins, one more is enough to show the slope
      const prev = cells[cells.length - 2];
      if (c.runs.every((b) => b.result !== 'won') && prev?.level === level && prev.runs.every((b) => b.result !== 'won')) break;
    }
  }
  const lines = [`# Balance report${env.BAL ? ` (BAL=${env.BAL})` : ''}`, '', `${seeds} seeds per stage, bot = src/sim/bot.ts (first card, merges highest pair). Damage = Battle.dealt, pooled.`, ''];
  lines.push('## Stages', '', ...stageTable(cells, LINEUP), '');
  // across mixed lineups: every run of every level and stage, each run weighted by its damage
  const all = shares(cells.flatMap((c) => c.runs), LINEUP);
  lines.push(`Overall damage share: ${LINEUP.map((k) => `${k} ${pct(all[k])}`).join(', ')}`, '');
  lines.push('## Skills (contested stages)', '');
  for (const level of levels) lines.push(...skillTable(level, cells), '');

  if (env.FORCED !== '0') {
    // on the max save's stage closest to an even fight
    const maxCells = cells.filter((c) => c.level === 'max');
    const winOf = (c: Cell) => c.runs.filter((b) => b.result === 'won').length / c.runs.length;
    const stage = Number(env.FORCED_STAGE ?? (maxCells.length ? maxCells.reduce((a, c) => (Math.abs(winOf(c) - 0.5) < Math.abs(winOf(a) - 0.5) ? c : a)).stage : 14));
    const m = newMeta();
    LEVELS.max(m);
    const fielded = (env.FORCED_LINEUP?.split(',') as HeroKind[] | undefined) ?? [...LINEUP];
    m.lineup = fielded;
    const setup = battleSetup(m, stage);
    lines.push(`## Forced skills (max save, stage ${stage}, ${fielded.join(' ')}, granted at the start)`, '', `| skills | win | wave μ | ${fielded.map((k) => k.slice(0, 5)).join(' | ')} |`, `|---|---|---|${fielded.map(() => '---').join('|')}|`);
    // FORCED_SETS=iceFreeze,iceShatter limits the rows (a row is its skills joined by +, none = '')
    const only = env.FORCED_SETS?.split(',');
    for (const set of FORCED.filter((f) => !only || only.includes(f.join('+')))) {
      const runs = Array.from({ length: Number(env.FORCED_SEEDS ?? Math.min(seeds, 100)) }, (_, i) => playForced(5000 + i, setup, set));
      const sh = shares(runs, fielded);
      const win = runs.filter((b) => b.result === 'won').length / runs.length;
      lines.push(`| ${set.join('+') || '(none)'} | ${pct(win)} | ${mean(runs.map((b) => b.wave)).toFixed(1)} | ${fielded.map((k) => pct(sh[k])).join(' | ')} |`);
    }
    lines.push('');
  }

  if (env.LINEUPS !== '0') {
    // corrosion and the gale tonic open with the first clear of their unlock stages: from then on
    // a player picks 4 of the potions. Each one swapped in for each starting potion, on each
    // level's contested stages past its unlock.
    for (const extra of HERO_KINDS.filter((k) => !LINEUP.includes(k) && (!env.LINEUP_EXTRA || env.LINEUP_EXTRA.split(',').includes(k)))) {
      const from = (BALANCE.heroes[extra] as { unlockStage?: number }).unlockStage ?? 5;
      const lineups: HeroKind[][] = [[...LINEUP], ...LINEUP.map((out) => LINEUP.map((k) => (k === out ? extra : k)))];
      const rows = [`| lvl | st | lineup | win | wave μ | ${HERO_KINDS.map((k) => k.slice(0, 5)).join(' | ')} |`, `|---|---|---|---|---|${HERO_KINDS.map(() => '---').join('|')}|`];
      for (const level of levels) {
        const contested = cells.filter((c) => {
          const w = c.runs.filter((b) => b.result === 'won').length / c.runs.length;
          return c.level === level && c.stage > from && w >= 0.1 && w <= 0.9;
        });
        for (const c of contested) {
          for (const lineup of lineups) {
            const lc = play(level, c.stage, seeds, lineup);
            const win = lc.runs.filter((b) => b.result === 'won').length / lc.runs.length;
            const sh = shares(lc.runs, HERO_KINDS);
            const name = lineup.includes(extra) ? `−${LINEUP.find((k) => !lineup.includes(k))} +${extra}` : 'starting four';
            rows.push(`| ${level} | ${c.stage} | ${name} | ${pct(win)} | ${mean(lc.runs.map((b) => b.wave)).toFixed(1)} | ${HERO_KINDS.map((k) => pct(sh[k])).join(' | ')} |`);
          }
        }
      }
      lines.push(`## Lineups with ${extra} (from stage ${from + 1})`, '', ...rows, '');
    }
  }
  lines.push(`_${cells.length} cells in ${((Date.now() - t0) / 1000).toFixed(0)}s_`);
  const text = lines.join('\n');
  console.log(text);
  const fs = proc.getBuiltinModule('node:fs') as Fs;
  const dir = env.OUT_DIR ?? 'D:/fang/ref/balance';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/${env.OUT ?? 'report.md'}`, text + '\n');
}, 3_600_000);
