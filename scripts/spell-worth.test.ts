// `npm run spells`: what the commander's spells are worth. Each stage of STAGES is played by the
// bot (botAct: casts at the thickest crowd as soon as it is charged) on the save the median player
// arrives with, once as it is and once with the charge kept empty (no spell, not even the
// self-cast). Per stage it prints the win rate and the mean wall % left at the end (a lost run
// counts 0) for both, the spells cast, and the wall each cast saved: the gap over the casts.
// That average holds every cast thrown at a quiet moment too, so next, for one good cast: the same
// run with no spells up to its first crush (CROWD (8) enemies on the lower half of the road from
// wave 2 on), there either nothing or one spell at the thickest crowd, and nothing after; the wall
// each spell saved over the next WINDOW (30) s, as a share of the full wall.
// SEEDS (40) runs each; BAL='{...}' overrides balance.json.
import { it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { botAct } from '../src/sim/bot';
import { FP, TICK_RATE } from '../src/sim/math/fixed';
import { battleSetup } from '../src/sim/meta';
import { arrive, spentSave } from '../src/sim/setupCatalog';
import { BALANCE } from '../src/sim/types';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

function merge(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
}

/** One battle to its end: whether it was won, the wall share left, and the spells cast. */
function play(seed: number, setup: ReturnType<typeof battleSetup>, spells: boolean) {
  const b = new Battle(seed, setup);
  for (let t = 0; t < 1200 * TICK_RATE && b.result === null; t++) {
    if (!spells) b.charge = 0;
    botAct(b);
    b.step();
    b.drain();
  }
  return { won: b.result === 'won', wall: b.result === 'won' ? Math.max(0, b.wall) / b.wallMax : 0, casts: b.casts };
}

const CROWD = Number(env.CROWD ?? 8);
const WINDOW = Number(env.WINDOW ?? 30);

/** The wall lost (as a share of the full wall) in the WINDOW after the run's first crush, with
 *  spell number `spell` (an index into the commander's turn) cast there or, at -1, none; null
 *  where the run never got crushed. */
function crush(seed: number, setup: ReturnType<typeof battleSetup>, spell: number): number | null {
  const b = new Battle(seed, setup);
  const half = (BALANCE.field.top * FP + b.wallFront(BALANCE.field.left * FP)) / 2;
  let from = -1;
  let wall = 0;
  for (let t = 0; t < 1200 * TICK_RATE && b.result === null; t++) {
    b.charge = 0;
    if (from < 0 && b.wave >= 2 && b.enemies.filter((e) => e.hp > 0 && e.y > half).length >= CROWD) {
      from = t;
      wall = b.wall;
      if (spell >= 0) {
        b.casts = spell;
        b.charge = BALANCE.commander.charge;
        b.cast();
      }
    }
    if (from >= 0 && t - from >= WINDOW * TICK_RATE) break;
    botAct(b);
    b.step();
    b.drain();
  }
  return from < 0 ? null : (wall - Math.max(0, b.wall)) / b.wallMax;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`.padStart(6);

it('spell worth', () => {
  if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
  const seeds = Number(env.SEEDS ?? 40);
  const stages = (env.STAGES ?? '1,3,5,8,10,15,20,30,40,50').split(',').map(Number);
  console.log(`spell worth: bot with spells vs none, ${seeds} seeds; wall % left at the end (lost = 0)`);
  console.log('stage   win  none   wall  none  casts  per cast');
  for (const s of stages) {
    const setup = battleSetup(spentSave(s - 1, arrive(s)), s);
    let [win, winNone, wall, wallNone, casts] = [0, 0, 0, 0, 0];
    for (let seed = 1; seed <= seeds; seed++) {
      const a = play(seed, setup, true);
      const n = play(seed, setup, false);
      [win, winNone, wall, wallNone, casts] = [win + +a.won, winNone + +n.won, wall + a.wall, wallNone + n.wall, casts + a.casts];
    }
    const per = casts ? (wall - wallNone) / casts : 0;
    console.log(`${String(s).padStart(5)} ${pct(win / seeds)} ${pct(winNone / seeds)} ${pct(wall / seeds)} ${pct(wallNone / seeds)} ${(casts / seeds).toFixed(1).padStart(6)} ${pct(per)}`);
  }
  const spells = [...new Set([0, 1, 2].map((k) => {
    const b = new Battle(1);
    b.casts = k;
    return b.nextCast;
  }))];
  console.log(`one cast at the first crush (${CROWD} on the lower half): wall % saved over ${WINDOW} s`);
  console.log(`stage crushed  lost  ${spells.map((k) => k.padStart(6)).join(' ')}`);
  for (const s of stages) {
    const setup = battleSetup(spentSave(s - 1, arrive(s)), s);
    const saved = spells.map(() => 0);
    let [n, lost] = [0, 0];
    for (let seed = 1; seed <= seeds; seed++) {
      const none = crush(seed, setup, -1);
      if (none === null) continue;
      n++;
      lost += none;
      spells.forEach((_, k) => (saved[k] += none - (crush(seed, setup, k) ?? none)));
    }
    console.log(`${String(s).padStart(5)} ${String(n).padStart(7)} ${pct(n ? lost / n : 0)} ${saved.map((v) => pct(n ? v / n : 0)).join(' ')}`);
  }
});
