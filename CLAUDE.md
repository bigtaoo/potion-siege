# Potion Siege

## File size

- No file under `src/`, `scripts/` or `server/` goes over **500 lines**, test files included.
- New code goes into a new module, split by what it does, not into whichever file is nearest.
- Files already over the limit (Home.ts, battle.ts, app.ts, BattleView.ts, kit.ts, Overlay.ts, Codex.ts, skills.test.ts, app.test.ts, battle.test.ts) must not grow. A change that touches one either moves its own code out to a new file or leaves it no longer than it was, until a dedicated refactor brings them all under 500.
- A test file splits along the modules it tests.
