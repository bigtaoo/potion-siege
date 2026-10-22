// `npx vitest run --config scripts/vitest.seed.config.js`: scores seeds for the new player's first
// battle (FIRST_SEED in src/sim/meta.ts) on the stage 1 base setup. SEEDS=2000 sets how many,
// ONLY=609 scores that one seed alone.
// The opening is what every new player sees the same: the first three summons (taken one at a
// time as gold allows, before any shot rolls a crit) and wave 1's spawn places. The rest of the
// battle depends on the player, so it is judged by the bot at four paces.
import { it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { botAct } from '../src/sim/bot';
import { TICK_RATE } from '../src/sim/math/fixed';
import { BASE_SETUP } from '../src/sim/meta';
import { mergeablePair } from '../src/sim/tutorial';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const N = Number(env.SEEDS ?? 2000);
/** Bot paces (ticks between actions): instant, 0.5 s, 1 s, 2 s. */
const PACES = [1, 15, 30, 60];

/** The bot acting every `every` ticks (a skill pick at once): a slower player. */
function play(seed: number, every: number): Battle {
  const b = new Battle(seed, BASE_SETUP);
  for (let t = 0; t < 1200 * TICK_RATE && b.result === null; t++) {
    if (b.choices || t % every === 0) botAct(b);
    b.step();
    b.drain();
  }
  return b;
}

const wallPct = (b: Battle) => Math.round((100 * Math.max(0, b.wall)) / b.wallMax);

it('scores first-battle seeds', () => {
  const all: { seed: number; score: number; wins: number; line: string }[] = [];
  const only = env.ONLY ? Number(env.ONLY) : 0;
  for (let seed = only || 1; seed <= (only || N); seed++) {
    const b = new Battle(seed, BASE_SETUP);
    const kinds: string[] = [];
    const slots: number[] = [];
    let pairAt = 0;
    const xs: number[] = [];
    const seen = new Set<number>();
    for (let t = 0; t < 30 * TICK_RATE; t++) {
      if (kinds.length < 3 && b.summon()) {
        const h = b.slots.find((s) => s && !slots.includes(s.slot))!;
        kinds.push(h.kind);
        slots.push(h.slot);
        if (!pairAt && mergeablePair(b)) pairAt = kinds.length;
      }
      b.step();
      b.drain();
      for (const e of b.enemies) if (b.wave === 1 && !seen.has(e.id)) (seen.add(e.id), xs.push(e.x));
    }
    // wave 1: how evenly it comes down the two halves of the field
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    const left = xs.filter((x) => x < mid).length;
    const balance = Math.min(left, xs.length - left) / Math.max(1, xs.length);
    const runs = PACES.map((every) => play(seed, every));
    const wins = runs.filter((r) => r.result === 'won').length;
    const walls = runs.map(wallPct);
    const gap = pairAt === 2 ? Math.abs(slots[0] - slots[1]) : 9;
    // a pair from the first two summons, side by side, so the merge step is one short drag
    let score = pairAt === 2 ? 3 + (gap === 1 ? 1 : 0) : pairAt === 3 ? 1 : 0;
    score += balance * 4; // up to 2
    score += wins * 1.5 + walls.reduce((a, w) => a + w, 0) / 100 / PACES.length;
    const line = `${seed}\tpair@${pairAt} gap ${gap}\t${kinds.join(',')}\tslots ${slots.join(',')}\tw1 n=${xs.length} bal=${balance.toFixed(2)}\twins ${wins}/${PACES.length} walls ${walls.join(',')}\tscore ${score.toFixed(2)}`;
    all.push({ seed, score, wins, line });
  }
  console.log(`seeds ${all.length}: won at every pace ${all.filter((r) => r.wins === PACES.length).length}, mean wins ${(all.reduce((a, r) => a + r.wins, 0) / all.length).toFixed(2)}/${PACES.length}`);
  all.sort((a, b) => b.score - a.score || a.seed - b.seed);
  for (const r of all.slice(0, 25)) console.log(r.line);
});
