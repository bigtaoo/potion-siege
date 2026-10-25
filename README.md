# Potion Siege (药水围城)

A merge tower-defense game for CrazyGames. A wizard alchemist holds a castle wall against a
clockwork army. The heroes are living potion bottles standing in the wall's cells: summon them,
drag two matching ones together to brew a stronger one, and pick a skill each time you upgrade.
The alchemist has no attack of his own; kills charge him and you tap him to cast.
PixiJS 8 + TypeScript + Vite, in English and Chinese, portrait board with side boards on wide screens.

## The game

- **Battle**: each stage is 10 waves, with boss waves at 5 and 10. Enemies walk down the road to the wall,
  and gold from kills pays for summons and upgrades. Every upgrade offers three skill cards; one reroll
  is paid with an ad. The ultimate potion grants a bonus skill. The wall starts with a row of cells, and
  the alchemist builds six more as you summon (one every 5 summons).
- **Commander skills**: the alchemist has no plain attack. Every kill charges him (a boss kill charges
  him more). Once he is full, tap him to cast. The casts alternate: the flask bomb, then the potion brew.
  - Flask bomb: a flask lands on the thickest crowd far enough down the road to be seen (below the HUD),
    aimed where its mark will be when it comes down. With nobody that far down it goes to the enemy
    nearest the wall and bursts a little below one still coming in. It bursts for 0.6 s of the board's
    damage (at least 40), and slows what it hits for 2 s. A mark shows where it will land; the burst
    flashes every enemy caught with what it took, counts them, shakes the screen and has its own boom.
  - Potion brew: all potions shoot 30% faster for 2 seconds; each one shows +30%.
  - If he stays full for 8 seconds he casts by himself.
- **Potions**: Arcane, Fire, Frost and Storm Tonics from the start. Corrosion opens at stage 5 and Gale at
  stage 10, or earlier for crystals in the shop. Each has its own skills and its own strong matchups.
  Potions level up with crystals to Lv40.
- **Clockwork army**: Tin Soldier, Clock Mouse, Boiler Golem, Ornithopter (flies) and Winder Spider
  (rewinds its neighbours). Each one fears some potions more than others.
- **Bosses**: one per chapter, each with its own trick.
  - Steam Tank (chapter 1)
  - Clocktower Strider (chapter 2): breeds clock mice from its pendulum door
  - Bell Jar Tripod (chapter 3): a bell jar takes the hits first, then regrows
  - Anvil Hopper (chapter 4): leaps forward, slams the wall and stuns potions
  - Gear King (chapter 5): two phases; at half health the rim shatters and the weaknesses flip
- **Chapters**: 50 stages in 5 chapters of 10. Each chapter has its own field and enemy mix, and
  some stages carry a twist on top (faster, armoured, more flyers or winders, elites). The finale
  (stage 10 of a chapter) has an extra boss wave. A chapter you finish gives a one-time crystal chest.

  | Chapter | Field | Stages |
  |---|---|---|
  | 1 | Factory Outskirts | 1-10 |
  | 2 | Snowfield | 11-20 |
  | 3 | Rail Yard | 21-30 |
  | 4 | Foundry | 31-40 |
  | 5 | Clock Tower | 41-50 |

- **Endless mode**: opens once stage 10 is cleared. One battlefield whose waves never run out, until the wall
  falls. Every 10 waves it moves to the next chapter's field, enemy mix and speed (outskirts, snowfield,
  rail yard, foundry, clock tower, then round again). A boss comes every 5 waves: the Steam Tank on 5 and 10,
  then the Strider, Tripod, Hopper and Gear King in turn, and round again. It pays a little crystal per wave
  (capped per run) and more the first time you reach each milestone wave.
- **Between battles**: potion levels and workshop upgrades are bought with crystals. The menus also hold
  the codex, the shop (a free chest and ad rewards), the daily reward, daily tasks, and a daily
  challenge with modifiers and a streak.
- **Crystals**: a result screen offers an ad to double the crystals, up to 3 times a day. After a loss
  it first offers a revive, once per battle.
- **First minute**: a new player lands straight in a live first battle, with no title tap. The tutorial
  (summon, merge, upgrade, skill pick) never stops the battle: a step you leave alone for 8 seconds
  is done for you. Until the first win, stage 1 plays on a fixed seed, so every new player sees the same opening.
- **Sound**: effects and two music loops synthesized in code (`src/audio/`). They stay silent during
  ads and while the tab is hidden, and there is a music/sound toggle on the home screen.
- **Wide screens**: a landscape embed shows side boards next to the board: this run's skills with
  each potion's damage share, and the next waves with a boss countdown.
  The battle's small text grows on small embeds (`textBoost` in `src/view/viewport.ts`), so 800x450 stays legible.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Web build at http://localhost:5180 |
| `npm run dev:crazygames` | Same game with the CrazyGames SDK, port 5181 (local test ads) |
| `npm test` | Unit tests (sim, meta, audio, viewport, analytics) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Typecheck, the file length check, tests, the quick half of the balance guard and the CrazyGames and iOS builds |
| `npm run check:filelength` | Fails on any file under `src/`, `scripts/` or `server/` over 500 lines, tests included (`scripts/checkFileLength.mjs`) |
| `npm run check:balance` | The balance guard (`scripts/guard/`): the main curves of the balance tools below on fewer seeds, each pinned to a band; about 30 s. `:quick` (idle wall, endless; in `check`) and `:slow` (early, chapter and boss curves; a CI step of its own) run its halves |
| `npm run build` | Typecheck, then the web build in `dist/` |
| `npm run build:crazygames` | Typecheck, then the CrazyGames build in `dist-crazygames/` (relative paths) |
| `npm run preview:crazygames` | Serves the built `dist-crazygames/` on port 4174 |
| `npm run collector` | The local telemetry collector on port 8787 (see Telemetry) |
| `npm run report` | Retention and funnel report from collector events (see Telemetry) |

Balance tools. They play seeded bot battles and print a report; most also write it under `ref/balance/`.
Run `balance` after editing `src/sim/balance.json`. Env vars such as `SEEDS`, `STAGES` and `BAL='{...}'`
(a balance override without editing the file) are described at the top of each script.
CI fails when `check:balance` finds a curve outside its pin: run it after a balance change, and if the
move was meant, copy the numbers it prints over the pins in `scripts/guard/*.test.ts` in the same commit.

| Command | What it does |
|---|---|
| `npm run balance` | Bot games over the stages and meta levels: win rate, waves reached, each potion's damage share, skills taken |
| `npm run early` | The early-game curve: win rate on stages 1-8 for saves with a given crystal budget, and a day-by-day campaign for new players |
| `npm run late` | Stages 10-20 for a player whose save is what the early curve predicts, with potion swaps, carries and skill cards |
| `npm run chapters` | First-try win rate of every stage of the five chapters for the median player's save, with each stage's twists |
| `npm run bosses` | Each chapter boss against the Steam Tank on the same stages and seeds: win rate, wall lost, how long the boss lived |
| `npm run endless` | How far endless runs get at three points of the campaign (stage 10 cleared, mid-game, maxed), and what a run pays |
| `npm run economy` | Simulates casual, regular and heavy players day by day, with and without ads, and reports how fast crystals are earned and spent |

## URL switches (dev builds only)

A release build (web, CrazyGames, iOS) reads only `?lang`; the rest are dropped (`src/game/switches.ts`). `?autoplay` never writes the save.

| Switch | What it does |
|---|---|
| `?lang=zh` or `?lang=en` | Language. By default the portal's or browser's language. |
| `?autoplay` | The bot plays. |
| `?speed=N` | Runs the game N times faster. |
| `?ads=fake` | Web build only: one-second pretend ads, so revive, ×2 and reroll can be tried. |
| `?notify=fake` | Dev build only: the iOS reminders in a browser. The card after the third battle and the settings switch work; the permission sheet says yes after 0.4 s and bookings go to the console. |
| `?track` | Logs the analytics events to the console. |
| `?ota=fake` or `?ota=fail` | A pretend hot update on the home screen, whose download finishes (and reloads) or fails at 60% (docs/ios.md "Hot updates"). |

In dev, `window.__game` exposes the running game.

## Telemetry (retention tuning)

`src/analytics/` tracks anonymous events. The player id is random and kept in game storage; no personal data is collected.

- **Events**:
  - sessions: `session_start`, `session_end`, `viewport`
  - onboarding firsts: `first_input`, `first_summon`, `first_merge`, `first_star3`, `first_upgrade`, `first_win`, and the `tutorial_step` (with `waitS`, the real seconds the held battle waited) and `tutorial_end` events; `tutorial_assist` only comes from builds before the tutorial held the battle
  - runs: `run_start`, `wave_start`, `skill_pick`, `run_end`, `run_quit`, `endless_start`, `endless_end`, `challenge_start`, `challenge_end`
  - menus and economy: `home_view`, `dialog`, `battle_start_tap`, `result_shown`, `result_action`, `crystals`, `meta_buy`, `lineup`, `daily_claim`
  - ads: `ad_offer`, `ad_result`, `ad_midgame`, `ad_paced` (a midgame held back by the 3-minute pacing), `ad_shop`, `ad_challenge`
  - client health: `perf` (one small event per run) and `anomaly` (an uncaught error, a lost WebGL context or a stalled frame; on iOS also a launch that never finished, `boot_fail`, and a hot update rolled back, `ota_fail`; capped per session)
- Every event carries `day` (calendar days since the first session), `session` (1 is the first ever) and `build`.
- **Build stamp**: `scripts/buildId.mjs` builds the id, `version+commit` (for example `0.0.1+61b33eb`, with `-dirty` when tracked files had uncommitted changes). Vite injects it as `__PS_BUILD__`; every event and beacon carries it, so the report can tell releases apart.
- **Beacons**: two anonymous counts with no player id, sent to `GET /b` on the collector. They are skipped on `localhost` and under `?autoplay`.
  - `open_touch` or `open_desktop`: an inline script in the CrazyGames page, before the SDK and anything else downloads.
  - `loaded_touch` or `loaded_desktop`: sent two frames after the first live battle is on screen, with the load time in ms.

  The gap between the two is the players lost while loading.
- **Collect**: production builds (web and CrazyGames) send to `https://ps.gamestao.com/e` (`.env.production`), the collector on the VPS (`server/README.md`). Locally, run `npm run collector` (port 8787; it writes `telemetry/events.ndjson`) and build with `VITE_ANALYTICS_URL=http://localhost:8787/e` in `.env.production.local`. Dev and `?autoplay` send nothing.
- **Report**: `npm run report -- telemetry/events.ndjson` prints:
  - retention: D1, D2, D3, D7, D14 and D30
  - the first-session funnel, the first three battles and session length
  - the wave where runs end
  - skill pick rates and ad opt-in
  - client performance

## Layout

- `src/sim/`: the pure, seeded simulation: `Battle` (`battle.ts`, with its waves, spawning, enemy ticks, bosses, shots, hits, damage, kills, the commander and targeting in their own modules), skills, the opening horde (`horde.ts`), the bot, the tutorial, chapters (`chapters.ts`), endless mode (`endless.ts`), and `meta.ts` (save, crystals, levels, stages, shop), plus the daily challenge and daily tasks. All the numbers live in `balance.json`.
- `src/view/`: the Pixi drawing.
  - `BattleView`: drag and merge; its layers (field, wall, enemies, shots, effects, figures, the commander) are in `battleView/`, the horde's banner and dust in `hordeFx.ts`
  - `Hud`
  - `Overlay`: skill cards and the result screen, with their parts in `overlay/`
  - `Home`: the five tabs, with each tab, panel, the top bar and the nav in `home/`
  - `codex/`: the potions, enemies and achievements pages
  - `kit/`: the palette, text fitting, panels, buttons and icons every screen uses
  - `SideInfo`: the side boards
  - `Tutorial`
  - `viewport.ts`: fitting the board and the menus to the screen
- `src/game/`: what `app.ts` drives: boot, the tutorial flow, a battle's end, the result and home screens and their taps, the modes.
- `src/audio/`: the synthesized sound effects and music.
- `src/analytics/`: the events, the run tracker, and the perf meter.
- `src/platform/`: `WebPlatform` and `CrazyGamesPlatform`, which uses SDK v3 for:
  - loading and gameplay events
  - the data store
  - rewarded revive, ×2 and reroll
  - midgame ads from the second run
  - happytime on wins
- `src/i18n/`: `en.ts` is the source of truth, and `zh.ts` must match its shape.
- `scripts/`: the balance tools, the telemetry collector and report.
- `server/`: the collector's container and its deploy script.
- `public/`: the game's images. `art/` holds their sources and prompts, and `tools/` the Python scripts that cut and flatten them.

## Design docs

The notes are in Chinese.

- `docs/art-plan.md`: the art plan (living potions, the clockwork enemies).
- `docs/retention-teardown.md`: a teardown of another game's retention and monetization.
- `docs/store-listing.md`: the CrazyGames texts, tags, controls and covers.
- `ref/design/crystal-economy.md`: the crystal economy: potions to Lv40, the daily ×2 cap and `npm run economy`.
- `ref/design/live-data-2026-10.md`: the first live data and the late-game balance.
- `ref/design/crazygames-launch-check.md`: the pre-launch check against the CrazyGames docs.
- `ref/design/next-content.md`: content proposals from before chapters, bosses and endless mode.

## Deploying

`.github/workflows/ci.yml` runs `npm run check` on every push and pull request. A green push to `main` then deploys the telemetry collector to the VPS, https://ps.gamestao.com (`server/README.md`), and after it the web build to https://p.gamestao.com (Cloudflare, `wrangler/web.jsonc`). A push that leaves the collector unchanged restarts nothing. Each deploy runs only when its repo Variable (`SERVER_DEPLOY_ENABLED`, `WEB_DEPLOY_ENABLED`) is `true`; the secrets it needs are listed at the top of `ci.yml`. CI also keeps the CrazyGames zip as a run artifact.

## Uploading to CrazyGames

1. Run `npm run check`; it must be green. Or take the `potion-siege-crazygames` zip from a green CI run's artifacts and skip step 2.
2. Zip the **contents** of `dist-crazygames/`, with `index.html` at the root of the zip.
3. Upload the zip in the CrazyGames developer portal, with the texts and covers from `docs/store-listing.md`.
4. Test it in the portal's QA tool:
   - 800x450 and full screen
   - rewarded revive, ×2 crystals and the reroll ad
   - a midgame ad on the second run
   - progress kept after a reload
   - no page scroll
