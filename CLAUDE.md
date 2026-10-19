# Potion Siege

## File size

- No file under `src/`, `scripts/` or `server/` goes over **500 lines**, test files included.
- New code goes into a new module, split by what it does, not into whichever file is nearest.
- A test file splits along the modules it tests.
- CI enforces this: `npm run check:filelength` (scripts/checkFileLength.mjs, part of `npm run check`). Every file is at 500 or under, so its BASELINE is empty.
