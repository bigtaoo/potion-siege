// `npm run late`: how stages 10-20 (STAGES=1-20 for all) play for a player whose save is what
// the early-curve campaign says it is when they get there. Per stage it plays the bot on:
//  - the starting four at two saves: "arrive" (crystals spent when the median player first tries
//    the stage) and "clear" (spent when they first clear it);
//  - every swap of corrosion and the gale tonic for a starting potion, once they are unlocked;
//  - each potion as the carry: its levels bought at half price, so it runs ~5 levels ahead, in
//    the starting four or in the best swap for an unlocked potion.
// It reports the win rate, the wave runs end on, each potion's damage share, the wall left, which
// enemies do the wall damage and how much one skill card granted at the start moves the win rate.
// Written to D:/fang/ref/balance/late/<TAG>.md (OUT_DIR overrides) and a JSON summary beside it.
// BAL='{...}' overrides balance.json as in balance.test.ts; SEEDS (default 60), STAGES=10-20,
// SKILLS=0 skips the card section, SKILL_STAGES=12,16,19 and SKILL_SEEDS set it up; CURVE_ONLY=1
// plays only the starting four (arrive and clear), for quick tuning passes.
import { it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { TICK_RATE } from '../src/sim/math/fixed';
import { botAct } from '../src/sim/bot';
import { battleSetup, buyHero, buyWorkshop, heroCost, newMeta, workshopCost, type BattleSetup, type MetaSave, type WorkshopId } from '../src/sim/meta';
import { MILESTONES, SKILL_IDS, skillHeroes, type SkillId } from '../src/sim/skills';
import { BALANCE, ENEMY_KINDS, HERO_KINDS, LINEUP, type EnemyKind, type HeroKind } from '../src/sim/types';

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
const proc = (
  globalThis as unknown as {
    process: {
      env: Record<string, string | undefined>;
      getBuiltinModule(id: string): unknown;
    };
  }
).process;
const env = proc.env;

/** Crystals the median player has spent when they first try each stage: `npm run early`,
 *  campaign without ads at 5 runs a day (tag "enemies", heroCost 60/1.15, firstClear 30).
 *  19 and 20 are extrapolated (+20% a stage, as 16-18 grow); "clear" for stage s is arrive[s+1]. */
const ARRIVE = [0, 0, 290, 560, 865, 1195, 1555, 2330, 2830, 3550, 4755, 5545, 6665, 8250, 10095, 12700, 15380, 20305, 24385, 29600, 35500, 42500];

/** The next buy, cheapest first over the fielded four and the workshop; the carry's levels
 *  count at half their price, so it is bought about five levels ahead of the others. */
function nextBuy(m: MetaSave, carry?: HeroKind): { cost: number; buy: () => boolean } | null {
  let best: { cost: number; weight: number; buy: () => boolean } | null = null;
  for (const k of m.lineup) {
    const c = heroCost(m.heroes[k]);
    const w = c === null ? 0 : k === carry ? c / 2 : c;
    if (c !== null && (!best || w < best.weight)) best = { cost: c, weight: w, buy: () => buyHero(m, k) };
  }
  for (const id of ['wall', 'startGold', 'crystals'] as WorkshopId[]) {
    const c = workshopCost(id, m.workshop[id]);
    if (c !== null && (!best || c < best.weight)) best = { cost: c, weight: c, buy: () => buyWorkshop(m, id) };
  }
  return best;
}

function saveFor(budget: number, lineup: readonly HeroKind[], carry?: HeroKind): MetaSave {
  const m = newMeta();
  m.lineup = [...lineup];
  m.unlocked = lineup.filter((k) => !LINEUP.includes(k));
  m.crystals = budget;
  for (let n = nextBuy(m, carry); n && m.crystals >= n.cost; n = nextBuy(m, carry)) n.buy();
  m.crystals = 0;
  return m;
}

interface Run {
  won: boolean;
  wave: number;
  /** Wall left at the end, as a share of its maximum. */
  wall: number;
  dealt: Record<HeroKind, number>;
  /** Wall damage by the kind of enemy that did it. */
  wallBy: Record<EnemyKind, number>;
  spawned: Record<EnemyKind, number>;
  /** Enemies of each kind that got to the wall. */
  reached: Record<EnemyKind, number>;
}

const zero = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

function play(seed: number, setup: BattleSetup, skill?: SkillId): Run {
  const b = new Battle(seed, setup);
  if (skill) {
    b.choices = [skill];
    b.choose(skill);
  }
  const wallBy = zero(ENEMY_KINDS);
  const spawned = zero(ENEMY_KINDS);
  const reached = zero(ENEMY_KINDS);
  const seen = new Set<number>();
  const atWall = new Set<number>();
  for (let t = 0; t < 1200 * TICK_RATE && b.result === null; t++) {
    botAct(b);
    const before = b.wall;
    b.step();
    b.drain();
    let weight = 0;
    for (const e of b.enemies) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        spawned[e.kind]++;
      }
      if (e.atWall && !atWall.has(e.id)) {
        atWall.add(e.id);
        reached[e.kind]++;
      }
      if (e.atWall && e.freezeTime <= 0) weight += BALANCE.enemies[e.kind].wallDps;
    }
    const lost = before - b.wall;
    if (lost > 0 && weight > 0) for (const e of b.enemies) if (e.atWall && e.freezeTime <= 0) wallBy[e.kind] += (lost * BALANCE.enemies[e.kind].wallDps) / weight;
  }
  return {
    won: b.result === 'won',
    wave: b.wave,
    wall: Math.max(0, b.wall) / b.wallMax,
    dealt: { ...b.dealt },
    wallBy,
    spawned,
    reached,
  };
}

interface Cell {
  group: string;
  stage: number;
  name: string;
  lineup: HeroKind[];
  carry?: HeroKind;
  save: MetaSave;
  runs: Run[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const win = (c: Cell) => c.runs.filter((r) => r.won).length / c.runs.length;
const short = (k: string) => k.slice(0, 4);

function shares(runs: Run[], kinds: readonly HeroKind[]): Record<HeroKind, number> {
  const s = zero(HERO_KINDS);
  for (const r of runs) for (const k of kinds) s[k] += r.dealt[k];
  const total = kinds.reduce((a, k) => a + s[k], 0) || 1;
  for (const k of kinds) s[k] /= total;
  return s;
}

function stageRange(): number[] {
  const [a, b] = (env.STAGES ?? '10-20').split('-').map(Number);
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
}

/** Losses by the wave they ended on: the boss waves and the rest. */
function lossWaves(runs: Run[]): string {
  const lost = runs.filter((r) => !r.won);
  if (lost.length === 0) return '–';
  const at = (w: number) => lost.filter((r) => r.wave === w).length / lost.length;
  const bossWaves = BALANCE.waves.bossWaves;
  const other = 1 - bossWaves.reduce((s, w) => s + at(w), 0);
  return `${mean(lost.map((r) => r.wave)).toFixed(1)} (${bossWaves.map((w) => `w${w} ${pct(at(w))}`).join(', ')}, other ${pct(other)})`;
}

const wallLeft = (runs: Run[]) => {
  const won = runs.filter((r) => r.won);
  return won.length ? pct(mean(won.map((r) => r.wall))) : '–';
};

it('late game', () => {
  if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
  const seeds = Number(env.SEEDS ?? 60);
  const tag = env.TAG ?? 'base';
  const curveOnly = env.CURVE_ONLY === '1';
  const t0 = Date.now();
  const cells: Cell[] = [];
  const cell = (group: string, stage: number, name: string, lineup: HeroKind[], budget: number, carry?: HeroKind): Cell => {
    const save = saveFor(budget, lineup, carry);
    const setup = battleSetup(save, stage);
    const c: Cell = {
      group,
      stage,
      name,
      lineup,
      carry,
      save,
      runs: Array.from({ length: seeds }, (_, i) => play(9000 + i, setup)),
    };
    cells.push(c);
    return c;
  };
  const extras = HERO_KINDS.filter((k) => !LINEUP.includes(k));
  const unlock = (k: HeroKind) => (BALANCE.heroes[k] as { unlockStage?: number }).unlockStage ?? 0;
  const swapName = (extra: HeroKind, out: HeroKind) => `−${short(out)} +${short(extra)}`;

  for (const stage of stageRange()) {
    const arrive = ARRIVE[stage];
    cell('start', stage, 'arrive', [...LINEUP], arrive);
    cell('start', stage, 'clear', [...LINEUP], ARRIVE[stage + 1]);
    if (curveOnly) continue;
    for (const extra of extras) {
      if (stage <= unlock(extra)) continue;
      for (const out of LINEUP)
        cell(
          'swap',
          stage,
          swapName(extra, out),
          LINEUP.map((k) => (k === out ? extra : k)),
          arrive,
        );
    }
  }
  // the best swap for each unlocked potion, over every stage it was played on
  const bestSwap = {} as Record<HeroKind, HeroKind[]>;
  for (const extra of extras) {
    const options = LINEUP.map((out) => ({
      out,
      w: mean(cells.filter((c) => c.name === swapName(extra, out)).map(win)),
    }));
    const out = options.reduce((a, o) => (o.w > a.w ? o : a)).out;
    bestSwap[extra] = LINEUP.map((k) => (k === out ? extra : k));
  }
  for (const stage of curveOnly ? [] : stageRange()) {
    for (const k of HERO_KINDS) {
      if (!LINEUP.includes(k) && stage <= unlock(k)) continue;
      cell('carry', stage, `carry ${k}`, LINEUP.includes(k) ? [...LINEUP] : bestSwap[k], ARRIVE[stage], k);
    }
  }

  const lines = [`# Late game (${tag})${env.BAL ? ` BAL=${env.BAL}` : ''}`, '', `${seeds} seeds per cell; saves bought cheapest first from the crystals the early campaign has spent on arrival.`, ''];

  // 1. the curve for the starting four
  lines.push('## Stage curve, starting four', '');
  lines.push('| st | spent arrive / clear | heroes a f i l (arrive) | wall gold cry | win arrive | win clear | losses end on wave μ (arrive) | wall left in wins | arc | fire | ice | ligh |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const stage of stageRange()) {
    const a = cells.find((c) => c.group === 'start' && c.stage === stage && c.name === 'arrive')!;
    const cl = cells.find((c) => c.group === 'start' && c.stage === stage && c.name === 'clear')!;
    const sh = shares(a.runs, LINEUP);
    lines.push(
      `| ${stage} | ${ARRIVE[stage]} / ${ARRIVE[stage + 1]} | ${LINEUP.map((k) => a.save.heroes[k]).join(' ')} | ${a.save.workshop.wall} ${a.save.workshop.startGold} ${a.save.workshop.crystals} | ${pct(win(a))} | ${pct(win(cl))} | ${lossWaves(a.runs)} | ${wallLeft(a.runs)} | ${LINEUP.map((k) => pct(sh[k])).join(' | ')} |`,
    );
  }
  lines.push('');

  // 2. swaps
  for (const extra of curveOnly ? [] : extras) {
    const names = LINEUP.map((out) => swapName(extra, out));
    const stages = stageRange().filter((s) => s > unlock(extra));
    if (stages.length === 0) continue;
    lines.push(`## ${extra} swapped in (arrive save; best: ${bestSwap[extra].join(' ')})`, '');
    lines.push(`| st | four | ${names.join(' | ')} | ${extra} share in each |`, `|---|---|${names.map(() => '---').join('|')}|---|`);
    for (const stage of stages) {
      const four = cells.find((c) => c.group === 'start' && c.stage === stage && c.name === 'arrive')!;
      const row = names.map((n) => cells.find((c) => c.group === 'swap' && c.stage === stage && c.name === n)!);
      lines.push(`| ${stage} | ${pct(win(four))} | ${row.map((c) => pct(win(c))).join(' | ')} | ${row.map((c) => pct(shares(c.runs, c.lineup)[extra])).join(' ')} |`);
    }
    lines.push('');
  }

  // 3. carries
  if (!curveOnly) {
    lines.push('## Each potion as the carry (arrive save, its levels ~5 ahead)', '');
    lines.push(`| st | ${HERO_KINDS.map((k) => `${short(k)} win | share`).join(' | ')} |`, `|---|${HERO_KINDS.map(() => '---|---').join('|')}|`);
    for (const stage of stageRange()) {
      const row = HERO_KINDS.map((k) => {
        const c = cells.find((x) => x.group === 'carry' && x.stage === stage && x.carry === k);
        return c ? `${pct(win(c))} | ${pct(shares(c.runs, c.lineup)[k])}` : '– | –';
      });
      lines.push(`| ${stage} | ${row.join(' | ')} |`);
    }
    lines.push('', `Carry lineups: poison ${bestSwap.poison?.join(' ')}, wind ${bestSwap.wind?.join(' ')}; the rest the starting four.`, '');
    const carryAvg = HERO_KINDS.map((k) => {
      const cs = cells.filter((c) => c.group === 'carry' && c.carry === k);
      const lost = cs.flatMap((c) => c.runs).filter((r) => !r.won);
      return `| ${k} | ${pct(mean(cs.map(win)))} | ${cs.length} | ${pct(mean(cs.map((c) => shares(c.runs, c.lineup)[k])))} | ${lost.length ? mean(lost.map((r) => r.wave)).toFixed(1) : '–'} | ${wallLeft(cs.flatMap((c) => c.runs))} |`;
    });
    lines.push('| carry | win μ over stages | stages | its damage share | loss wave μ | wall left in wins |', '|---|---|---|---|---|---|', ...carryAvg, '');
  }

  // 4. enemies: who does the wall damage, per lineup family
  const families: [string, Cell[]][] = [
    ['starting four (arrive)', cells.filter((c) => c.group === 'start' && c.name === 'arrive')],
    ...HERO_KINDS.map((k): [string, Cell[]] => [`carry ${k}`, cells.filter((c) => c.group === 'carry' && c.carry === k)]),
  ];
  lines.push('## Enemies: share of the wall damage, and of each kind spawned, how many reached the wall', '');
  lines.push(`| lineup | ${ENEMY_KINDS.join(' | ')} |`, `|---|${ENEMY_KINDS.map(() => '---').join('|')}|`);
  for (const [name, cs] of families) {
    const runs = cs.flatMap((c) => c.runs);
    const total = ENEMY_KINDS.reduce((s, k) => s + runs.reduce((a, r) => a + r.wallBy[k], 0), 0) || 1;
    const row = ENEMY_KINDS.map((k) => {
      const dmg = runs.reduce((a, r) => a + r.wallBy[k], 0) / total;
      const sp = runs.reduce((a, r) => a + r.spawned[k], 0);
      const re = runs.reduce((a, r) => a + r.reached[k], 0);
      return sp ? `${pct(dmg)} · ${pct(re / sp)}` : '–';
    });
    lines.push(`| ${name} | ${row.join(' | ')} |`);
  }
  lines.push('');

  if (env.SKILLS !== '0' && !curveOnly) {
    // 5. skills: one card granted at the start (the bot gets only a card or two a battle, too few to
    // judge them by), against no card, on the same lineup and save. Starting-four and generic cards
    // on the starting four, corrosion and gale cards on their best swap.
    const skillStages = (env.SKILL_STAGES ?? '12,16,19').split(',').map(Number);
    const skillSeeds = Number(env.SKILL_SEEDS ?? seeds);
    const lineupFor = (id: SkillId): HeroKind[] => {
      const { hero, with: partner } = skillHeroes(id);
      const k = [hero, partner].find((h) => h && !LINEUP.includes(h));
      return k ? bestSwap[k] : [...LINEUP];
    };
    const needs = (id: SkillId) => {
      const hero = skillHeroes(id).hero;
      const m = hero && MILESTONES[hero].find((s) => 'skill' in s && s.skill === id);
      return m ? m.level : 1;
    };
    const forcedWin = (stage: number, lineup: HeroKind[], id?: SkillId) => {
      const setup = battleSetup(saveFor(ARRIVE[stage], lineup), stage);
      const runs = Array.from({ length: skillSeeds }, (_, i) => play(7000 + i, setup, id));
      return { win: runs.filter((r) => r.won).length / runs.length, runs };
    };
    const baseOf = new Map<string, ReturnType<typeof forcedWin>>();
    lines.push(`## One skill card granted at the start (arrive save; Δ against no card, ${skillSeeds} seeds, ±9pp noise)`, '');
    lines.push(`| skill | lineup | Lv needed | ${skillStages.map((s) => `st${s} Δ`).join(' | ')} | Δ μ | its potion's share (no card → card), st${skillStages[0]} |`);
    lines.push(`|---|---|---|${skillStages.map(() => '---').join('|')}|---|---|`);
    for (const id of SKILL_IDS) {
      const lineup = lineupFor(id);
      const key = lineup.join(',');
      const ds: number[] = [];
      let shareTxt = '';
      for (const stage of skillStages) {
        if (!baseOf.has(`${key}@${stage}`)) baseOf.set(`${key}@${stage}`, forcedWin(stage, lineup));
        const f = forcedWin(stage, lineup, id);
        const base = baseOf.get(`${key}@${stage}`)!;
        ds.push(f.win - base.win);
        const hero = skillHeroes(id).hero;
        if (stage === skillStages[0] && hero) {
          shareTxt = `${pct(shares(base.runs, lineup)[hero])} → ${pct(shares(f.runs, lineup)[hero])}`;
        }
      }
      const d = mean(ds);
      const sign = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}`;
      lines.push(`| ${id} | ${lineup.includes('poison') ? '+pois' : lineup.includes('wind') ? '+wind' : 'four'} | ${needs(id)} | ${ds.map(sign).join(' | ')} | **${sign(d)}** | ${shareTxt} |`);
    }
    lines.push('', `Baselines (no card): ${[...baseOf.entries()].map(([k, w]) => `${k.replace(/,/g, ' ')} ${pct(w.win)}`).join('; ')}`, '');
  }
  lines.push('', `_${cells.length} cells, ${cells.length * seeds} battles in ${((Date.now() - t0) / 1000).toFixed(0)}s_`);

  const text = lines.join('\n');
  console.log(text);
  const fs = proc.getBuiltinModule('node:fs') as Fs;
  const dir = env.OUT_DIR ?? 'D:/fang/ref/balance/late';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/${tag}.md`, text + '\n');
  const summary = cells.map((c) => ({
    group: c.group,
    stage: c.stage,
    name: c.name,
    win: win(c),
    wave: mean(c.runs.map((r) => r.wave)),
    share: shares(c.runs, c.lineup),
  }));
  fs.writeFileSync(`${dir}/${tag}.json`, JSON.stringify(summary));
}, 7_200_000);
