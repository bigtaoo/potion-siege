# Commander spells: the player picks where they land

Section 3 of docs/onboarding-plan.md. Rules in `src/sim/commander.ts` and `src/sim/spells.ts`,
aiming in `src/view/battleView/castAim.ts`, numbers in `src/sim/balance.json` (`commander`).

## How it plays

- The badge fills on kills (charge 70). Full, it shows the next spell: bomb, frost, acid, in turn.
- **Drag** from the badge onto the road: a ring of the spell's reach follows the finger and every
  enemy it would catch is outlined white. Let go there to cast. Back on the badge or off the road
  (grey ring), nothing is cast and the charge stays.
- **Tap** the badge: thrown at the thickest crowd, as before.
- **Mouse**: a click on the badge picks the spell up, a click on the road casts it there, a second
  click on the badge throws at the crowd, anywhere else puts it down.
- Left full for 15 s it still casts itself at the thickest crowd.
- The cast command carries an FP point (`{type:'cast', x, y}`); a point off the road is pulled onto
  it. An old command with no point (old replays, the bot) goes to the thickest crowd.
- Telemetry: a `cast` event with `how` (`drag` / `tap` / `self`) and `hits`. The collector
  (`scripts/collector.mjs`) needs a redeploy before it keeps these.

## The three spells

| Spell | Reach | Effect |
|---|---|---|
| Bomb | 190 | 1.5 s of the board's damage (at least 40) to all in reach, knocked back 70; bosses not pushed |
| Frost | 240 | frozen 4 s; a boss or a flyer only slowed by half |
| Acid | 160 | a pool for 5 s: a quarter of the board's damage a second, slowed 30% |

"The board's damage" is what the potions on the wall deal a second, so the spells scale with the save.

## Tuning

`npm run spells` (scripts/spell-worth.test.ts, ~100 s). The first pass had the bomb at 2 s and the
frost at 2.5 s: the bomb saved 10–17% at stages 15–50, the frost −2–4%. Now bomb 1.5 s, frost 4 s.

**One good cast**: the bot plays without spells until the first crush of wave 2+ (8 enemies past the
middle of the road), casts there, and the wall lost over the next 30 s is compared with no cast.

| Stage | Lost, no spell | Bomb saves | Frost saves | Acid saves |
|---|---|---|---|---|
| 1–8 | 2–3% | 1.5–2.8% | ~0–1% | 1.7–2.8% |
| 10 | 9.4% | 4.5% | −0.9% | 4.7% |
| 15 | 34.8% | 13.6% | 3.4% | 12.0% |
| 20 | 19.9% | 9.4% | 5.6% | 8.2% |
| 30 | 20.4% | 8.2% | 3.6% | 6.5% |
| 40 | 22.2% | 12.1% | 6.5% | 10.9% |
| 50 | 22.0% | 8.5% | 5.2% | 7.0% |

Bomb and acid land in the 5–10% band from stage 10 on (stage 15 is a hard crush); early stages
cannot lose more than 2–3% to a crush at all. Frost is the weak one by wall saved but buys time.
The old spells at c65a899: bomb 4.2–7.6%, brew 0.5–5.3%.

The bot casting at every full charge (thickest crowd) saves 0.2–2.1% of the wall per cast (old 0.2–2.9%).

## What moved

| Check | Before (c65a899) | After |
|---|---|---|
| `npm run targeting`, bot win all stages | starting four 56%, corrosion 72%, gale 48% | 63%, 74%, 55% |
| `npm run bosses`, mean bot win | clock 58, tripod 50, anvil 51, gear 45% | 63, 57, 58, 53% |
| `npm run lazy`, bot win | b0 s1 95, s3 60, s5 23%; b500 s5 65% | 98, 65, 30%; 68% |
| `npm run endless`, median wave | stage-10 clear 15, mid 40, maxed 55 | 18, 40, 55 |

The bot's story win rate is up about 7 points. The endless guard's stage-10 clear pin moved 14 → 20
(its 15 seeds); the lazy/idle pins hold. The maxed endless run on seed 1 now lasts past 30 min, so
modeRewards.test.ts caps at 40 min.

## Not done

The cast daily task is left out on purpose (onboarding-plan.md lines 252–253, item 5 at line 313).
The tutorial hand hint partly covers the 「拖到敌群施法」 pill.
