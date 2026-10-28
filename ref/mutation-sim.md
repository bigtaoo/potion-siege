# Mutation testing of src/sim (2026-10-28)

A trial of StrykerJS 10.1.1 with the vitest runner on the battle sim. `npm run mutate` runs it
(`stryker.config.json`, tests from `scripts/vitest.mutate.config.js`); the HTML-free JSON report
lands in `reports/mutation/sim.json` (git-ignored).

## Scope

- **Mutated:** the 14 central files — battle, damage, hits, shots, kills, enemyTick, targets,
  targetPick, waves, spawn, horde, rng, math/prng, math/pick. 2166 mutants.
  `stars.ts` is left out (another session is on its tests).
- **Judged by:** the tests under `src/sim/` only, less the four seed sweeps (balance-targets,
  challengeOdds, softLock, skillFuzz): instrumented they run 10-15x slower and blow their own
  timeouts. Tests elsewhere (view, app) that happen to cover sim code do not count here.
- **Not run:** all 40 files of `src/sim` make 4951 mutants; the first full attempt projected
  3.5 h or more, so it was cut to the files above.

## Scores

Score = (killed + timeout) / (killed + timeout + survived + no coverage). Both runs at
concurrency 16 on the same 22-thread machine; "before" is today's main tests (the new
`*Edges.test.ts` files left out), "after" with them.

| file | mutants | before | after | survived + no cov. before → after |
|---|---|---|---|---|
| battle.ts | 398 | 84.9% | 87.2% | 60 → 51 |
| damage.ts | 181 | 78.5% | 85.6% | 39 → 26 |
| enemyTick.ts | 194 | 86.1% | 91.2% | 27 → 17 |
| hits.ts | 338 | 68.3% | 86.7% | 107 → 45 |
| horde.ts | 94 | 87.2% | 89.4% | 12 → 10 |
| kills.ts | 103 | 49.5% | 68.0% | 52 → 33 |
| math/pick.ts | 17 | 88.2% | 88.2% | 2 → 2 |
| math/prng.ts | 19 | 84.2% | 94.7% | 3 → 1 |
| rng.ts | 24 | 83.3% | 95.8% | 4 → 1 |
| shots.ts | 117 | 81.2% | 83.8% | 22 → 19 |
| spawn.ts | 128 | 78.9% | 80.5% | 27 → 25 |
| targetPick.ts | 142 | 83.1% | 83.8% | 24 → 23 |
| targets.ts | 47 | 72.3% | 72.3% | 13 → 13 |
| waves.ts | 364 | 90.1% | 92.0% | 36 → 29 |
| **total** | **2166** | **80.2%** | **86.4%** | **428 → 295** |

133 more mutants caught. The math/prng and pick changes are run-to-run noise (no tests were
added for them); see "Timeouts" below.

After the full "after" run, targetsEdges.test.ts was added for what was still open in
targets.ts and battle.ts's grid (the wall's front, open and buildable cells). Re-run on those
two files alone (10 min): **battle.ts 90.5%** (38 left), **targets.ts 100%** (0 left). With
those, the 14 files stand at **87.6%**: 269 left of 428, so **159 mutants killed** in all.

## What the new tests pin

Seven files, `src/sim/*Edges.test.ts`, split by module: hitsEdges, killsEdges, damageEdges,
battleEdges, enemyTickEdges, targetsEdges and simEdges (the one-liners across waves, shots,
spawn, targetPick, horde and rng). They found no bug; production code is unchanged. What they
cover that nothing did before:

- the lightning chain's length and the lightning skill's extra links, the sky strike's reach;
- damage lost on a target that is already gone, per potion;
- the gust's depth edge, the whirlwind only off the direct target, the pull's reach and step;
- wind-and-fire: which heat spreads, to whom, and who it is credited to;
- the push's weight, the top clamp, the winder's key reset;
- the arcane split count on an exact kill, the burst skipping the dead;
- fire chain, melt and shatter after a death (kills.ts was the weakest file);
- static, superconduct, the tripod's jar under a mark, shards only off a boss;
- poison, freeze and whirlwinds running out on their last tick; the anvil's slam countdown;
- reroll/noReroll, a card not on offer, the wall repair, revive only after a loss;
- the wall's front over a built column, open and buildable cells, the front/nearest edges
  (targets.ts was the one file whose tests lived only in other modules' tests);
- the forecast's own boss waves and flyers, an endless theme only in endless.

## What is left

269 mutants still survive. Roughly:

- **~90 view-only:** the payloads of `b.events.push` (event type strings, x/y/radius for the
  effects). The sim never reads them back; the view tests cover them with real battles, not
  here.
- **Equivalent or near-equivalent, a few dozen:** e.g. `d <= 0` on the push (every non-boss
  weight is > 0), `[target.id]` → `[]` on the split (nearest skips the dead target anyway),
  the stop condition of `endlessBossesMet`'s loop, `heft >= 1000` on a whole enemy's burst,
  `<=` vs `<` on ties no test layout makes, `Math.max(0, …)` clamps on timers that never go
  below 0.
- **Real but not chased:** clamps in spawn's lane maths, targetPick's tie-breaks between
  equally dangerous enemies, the arcane multishot's extra arrows, the kills.ts payouts on the
  horde's fractional heft. Worth a second pass if these files change.

## Timeouts

A mutant that makes the tests loop is counted as caught (timeout). Under load that count is
unreliable: the first run (concurrency 20) took 77 min 40 s and recorded 792 timeouts for a
90.0% score; at concurrency 16 the same tests gave 244 timeouts and 80.2%. A mutant that only
slows the tests down was being scored as a kill. The tables above are both at 16; compare
like with like.

## Run time

| run | files | concurrency | time |
|---|---|---|---|
| first try | 14 | 20 | 77 min 40 s (inflated by timeouts) |
| before | 14 | 16 | 90 min 1 s |
| after | 14 | 16 | 87 min 31 s |
| one file (hits.ts) | 1 | 16 | ~2 min |
| battle.ts + targets.ts | 2 | 16 | 10 min 4 s |
| full src/sim | 40 | 20 | projected 3.5 h+ (stopped) |

The dry run (all sim tests, instrumented) takes about 70 s; the rest is the mutants.

## Verdict

Keep Stryker, as an opt-in `npm run mutate`, not part of `npm run check` or CI: 1.5 h for the
central files is far too long for every change. It earned its place here: 99.75% line coverage
hid 428 surviving mutants (159 now killed), and the weakest files (kills 49.5%, hits 68.3%) had whole skill
rules (melt spread, shatter on chill, wind-and-fire credit, split count) that no test checked.
The useful way to run it is one file at a time while working on it:

```
npx stryker run --mutate src/sim/hits.ts
```

which takes 2-10 minutes. Rerun the full set before a big balance or skill change, and read
"Survived" mutants outside `events.push` first.
