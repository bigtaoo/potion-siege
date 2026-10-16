# Potion Siege (药水围城)

A merge tower-defense game for CrazyGames. A wizard alchemist holds a castle wall against a
clockwork army. The heroes are living potion bottles standing in the wall's cells: summon them,
drag two matching ones together to brew a stronger one, and pick a skill each time you upgrade.
PixiJS 8 + TypeScript + Vite, in English and Chinese, portrait board with side boards on wide screens.

## The game

- **Battle**: each stage is 10 waves, with boss waves at 5 and 10. Enemies walk down the road to the wall,
  and gold from kills pays for summons and upgrades. Every upgrade offers three skill cards; one reroll
  is paid with an ad. The ultimate potion grants a bonus skill.
- **Potions**: Arcane, Fire, Frost and Storm Tonics from the start. Corrosion opens at stage 5 and Gale at
  stage 10, or earlier for crystals in the shop. Each has its own skills and its own strong matchups.
- **Clockwork army**: Tin Soldier, Clock Mouse, Boiler Golem, Ornithopter (flies), Winder Spider
  (rewinds its neighbours) and the Steam Tank boss. Each one fears some potions more than others.
- **Between battles**: 20 stages, each tougher than the last. Potion levels and workshop upgrades are
  bought with crystals. The menus also hold the codex, the shop (a free chest and ad rewards), the daily
  reward, daily tasks, and a daily challenge with modifiers and a streak.
- **First run**: a short tutorial (summon, merge, upgrade). On a loss you can revive with an ad, and on
  any result you can double the crystals with an ad.
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
| `npm test` | Unit tests (sim, meta, audio, viewport) |
| `npm run balance` | Bot games over the stages: wins and waves reached. Run it after editing `src/sim/balance.json` |
| `npm run early` | The early-game curve report |
| `npm run check` | Typecheck, tests and the CrazyGames build |
| `npm run build:crazygames` | Output in `dist-crazygames/` (relative paths) |
| `npm run preview:crazygames` | Serves the built `dist-crazygames/` on port 4174 |

## URL switches (dev)

| Switch | What it does |
|---|---|
| `?lang=zh` or `?lang=en` | Language. By default the portal's or browser's language. |
| `?autoplay` | The bot plays. |
| `?speed=N` | Runs the game N times faster. |
| `?ads=fake` | Web build only: one-second pretend ads, so revive, ×2 and reroll can be tried. |
| `?track` | Logs the analytics events to the console. |

In dev, `window.__game` exposes the running game.

## Telemetry (retention tuning)

`src/analytics/` tracks anonymous events. The player id is random and kept in game storage; no personal data is collected.

- **Events**:
  - sessions: `session_start`, `session_end`
  - onboarding firsts: `first_tap_start`, `first_summon`, `first_merge`, `first_level_up`, `first_star3`, `first_win`
  - runs: `run_start`, `wave_start`, `skill_pick`, `run_end`, `run_quit`
  - ads: `ad_offer`, `ad_result`, `ad_midgame`
- Every event carries `day` (calendar days since the first session) and `session` (1 is the first ever).
- **Collect**: production builds (web and CrazyGames) send to `https://ps.gamestao.com/e` (`.env.production`), the collector on the VPS (`server/README.md`). Locally, run `npm run collector` (port 8787; it writes `telemetry/events.ndjson`) and build with `VITE_ANALYTICS_URL=http://localhost:8787/e` in `.env.production.local`. Dev and `?autoplay` send nothing.
- **Report**: `npm run report -- telemetry/events.ndjson` prints:
  - retention: D1, D2, D3, D7, D14 and D30
  - the first-session funnel and session length
  - the wave where runs end
  - skill pick rates and ad opt-in

## Layout

- `src/sim/`: the pure, seeded simulation: `Battle`, skills, waves, enemies, the bot, the tutorial, and `meta.ts` (save, crystals, levels, stages, shop), plus the daily challenge and daily tasks. All the numbers live in `balance.json`.
- `src/view/`: the Pixi drawing.
  - `BattleView`: the field, the wall cells, drag and merge
  - `Hud`
  - `Overlay`: skill cards and the result screen
  - `Home`
  - `Codex`
  - `SideInfo`: the side boards
  - `Tutorial`
  - `viewport.ts`: fitting the board and the menus to the screen
- `src/audio/`: the synthesized sound effects and music.
- `src/platform/`: `WebPlatform` and `CrazyGamesPlatform`, which uses SDK v3 for:
  - loading and gameplay events
  - the data store
  - rewarded revive, ×2 and reroll
  - midgame ads from the second run
  - happytime on wins
- `src/i18n/`: `en.ts` is the source of truth, and `zh.ts` must match its shape.
- `public/`: the game's images. `art/` holds their sources and prompts, and `tools/` the Python scripts that cut and flatten them.
- `docs/`: the art plan, the retention teardown and the store listing (`store-listing.md`).

## Deploying

`.github/workflows/ci.yml` runs `npm run check` on every push and pull request. A green push to `main` then deploys the telemetry collector to the VPS (`server/README.md`) and the web build to https://p.gamestao.com (Cloudflare, `wrangler/web.jsonc`). Each deploy runs only when its repo Variable (`SERVER_DEPLOY_ENABLED`, `WEB_DEPLOY_ENABLED`) is `true`; the secrets it needs are listed at the top of `ci.yml`.

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
