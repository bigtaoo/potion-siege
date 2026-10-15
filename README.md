# Potion Siege (药水围城)

Portrait merge-defense prototype for CrazyGames: summon heroes onto a 5x3 grid, drag two equal
heroes together to merge into a stronger one, pick a skill on each level-up, hold the wall for
20 waves (bosses at 10 and 20). PixiJS 8 + TypeScript + Vite, placeholder shapes, no audio yet.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Web build at http://localhost:5180 |
| `npm run dev:crazygames` | Same game with the CrazyGames SDK, port 5181 |
| `npm test` | Unit tests (sim + viewport) |
| `npm run balance` | 40 bot games, prints wins / waves reached — use after editing `src/sim/balance.json` |
| `npm run check` | Typecheck + tests + CrazyGames build |
| `npm run build:crazygames` | Output in `dist-crazygames/` (relative paths) |

## URL switches (dev)

`?lang=zh|en` · `?autoplay` (bot plays) · `?speed=N` · `?ads=fake` (1 s pretend ads, shows revive).
In dev, `window.__game` exposes the running game.

## Telemetry (retention tuning)

`src/analytics/` tracks anonymous events (random player id in game storage, no personal data):
`session_start/end`, onboarding firsts (`first_tap_start`, `first_summon`, `first_merge`,
`first_level_up`, `first_star3`, `first_win`), `run_start`, `wave_start`, `skill_pick`,
`run_end` / `run_quit` (left mid-run), `ad_offer` / `ad_result` / `ad_midgame`.
Every event carries `day` (calendar days since first session) and `session` (1 = first ever).

- Dev: add `?track` to log events in the console.
- Collect: `npm run collector` (port 8787, writes `telemetry/events.ndjson`), then build with
  `VITE_ANALYTICS_URL=https://your-host/e` (e.g. in `.env.production.local`). Without it nothing is sent.
- Report: `npm run report -- telemetry/events.ndjson` → D1/D2/D3/D7/D14/D30, first-session funnel,
  session length, wave where runs end, skill pick rates, ad opt-in.

## Layout

- `src/sim/` — pure, seeded simulation (`Battle`), skills, waves, bot. All numbers in `balance.json`.
- `src/view/` — Pixi drawing: `BattleView` (field, grid, drag/merge), `Hud`, `Overlay` (title, skills, end).
- `src/platform/` — `WebPlatform` and `CrazyGamesPlatform` (SDK v3: loading/gameplay events, data store, rewarded revive, midgame ads from the second run).
- `src/i18n/` — `en.ts` is the source of truth, `zh.ts` must match its shape.

## Uploading to CrazyGames

1. `npm run check`
2. Zip the **contents** of `dist-crazygames/` (index.html at the zip root).
3. Upload in the CrazyGames developer portal, test in its QA tool (800x450 legibility, ads, no scroll).
