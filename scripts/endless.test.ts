// `npm run endless`: how far endless runs get for a player at three points of the campaign -
// a stage-10 clear (endless just opened) and a maxed save (every potion and the workshop bought
// out, which the crystals of a stage-20 clear already buy, so stage 30/50 players are there too). Per save it plays the bot on the starting
// four and on each swap of corrosion or the gale tonic for a starting potion, and reports the
// wave runs end on (median, p10, p90) and the crystals one run pays (wave pay + first-time
// milestones, before the workshop bonus and the ×2 ad). BAL='{...}' overrides balance.json;
// SEEDS (default 30).
import { it } from 'vitest';
import { playOut } from '../src/sim/bot';
import { buyHero, buyWorkshop, heroCost, newMeta, workshopCost, type MetaSave, type WorkshopId } from '../src/sim/meta';
import { endlessSetup, milestonesOf } from '../src/sim/endless';
import { BALANCE, HERO_KINDS, LINEUP, type HeroKind } from '../src/sim/types';

function merge(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
}
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
const SEEDS = Number(env.SEEDS ?? 30);
const E = BALANCE.endless;

/** The cheapest buy over the fielded four and the workshop, as late-game.test.ts buys. */
function saveFor(budget: number, lineup: readonly HeroKind[]): MetaSave {
  const m = newMeta();
  m.lineup = [...lineup];
  m.unlocked = lineup.filter((k) => !LINEUP.includes(k));
  m.cleared = E.unlock;
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
    if (!best || m.crystals < best.cost || !best.buy()) break;
  }
  m.crystals = 0;
  return m;
}

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const milestoneSum = (wave: number) => E.milestones.slice(0, milestonesOf(wave)).reduce((a, s) => a + s.reward, 0);

it('endless reach', () => {
  const saves: [string, number][] = [
    ['stage 10 clear', 4755],
    ['maxed (stage 20+: the stage-20 budget already buys it all)', 1e9],
  ];
  const swaps: [string, HeroKind[]][] = [['starting four', [...LINEUP]]];
  for (const extra of HERO_KINDS.filter((k) => !LINEUP.includes(k))) {
    for (const out of LINEUP) swaps.push([`${extra} for ${out}`, LINEUP.map((k) => (k === out ? extra : k))]);
  }
  const lines = ['| save | lineup | levels | median wave | p10 | p90 | run pay (median) |', '|---|---|---|---|---|---|---|'];
  for (const [name, budget] of saves) {
    for (const [lname, lineup] of name.startsWith('stage 10') ? swaps.slice(0, 1) : swaps) {
      const m = saveFor(budget, lineup);
      const waves: number[] = [];
      for (let s = 1; s <= SEEDS; s++) waves.push(playOut(1000 + s, 3600, endlessSetup(m)).wave);
      const med = pct(waves, 0.5);
      const levels = m.lineup.map((k) => m.heroes[k]).join('/') + ` w${m.workshop.wall}`;
      lines.push(`| ${name} | ${lname} | ${levels} | ${med} | ${pct(waves, 0.1)} | ${pct(waves, 0.9)} | ${Math.min(E.runCap, E.perWave * med)} |`);
    }
  }
  lines.push('', '| wave reached | run pay | milestones first time (cumulative) |', '|---|---|---|');
  for (const w of [10, 15, 20, 25, 30, 40, 50]) lines.push(`| ${w} | ${Math.min(E.runCap, E.perWave * w)} | ${milestoneSum(w)} |`);
  console.log(lines.join('\n'));
});
