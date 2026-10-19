// Fails if any file under src/, scripts/ or server/ is over MAX_LINES, test files included
// (CLAUDE.md "File size"). Split long files by what they do instead of raising the limit.
// Same check as D:\standing's build/checkFileLength.mjs, plus a baseline for the files that were
// already over the limit when the rule came in: each may shrink but never grow, and its number
// here goes down with every change that shortens it, so the room it gave up cannot be refilled.
// A file that gets to MAX_LINES or under leaves the list.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LINES = 500;
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['src', 'scripts', 'server'];
const EXTS = ['.ts', '.mts', '.mjs', '.js', '.py', '.sh', '.css', '.html'];

// line counts on 2026-10-19 (782f2fe); only ever lowered, until the refactor empties it
const BASELINE = {
  'src/view/Home.ts': 1084,
  'src/sim/battle.ts': 1277,
  'src/app.ts': 1143,
  'src/view/BattleView.ts': 1024,
  'src/view/kit.ts': 778,
  'src/sim/skills.test.ts': 777,
  'src/view/Overlay.ts': 693,
  'src/view/Codex.ts': 570,
  'src/app.test.ts': 511,
  'src/sim/battle.test.ts': 507,
};

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXTS.some((e) => name.endsWith(e))) yield p;
  }
}

// as an editor numbers them: a final newline does not start another line
const countLines = (text) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);

const errors = [];
const seen = new Set();
for (const d of DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const path = relative(ROOT, file).split(sep).join('/');
    const lines = countLines(readFileSync(file, 'utf8'));
    const cap = BASELINE[path];
    if (cap === undefined) {
      if (lines > MAX_LINES) errors.push(`${path}: ${lines} lines, over ${MAX_LINES}`);
      continue;
    }
    seen.add(path);
    if (lines > cap) errors.push(`${path}: ${lines} lines, grew past its ${cap}; move the new code to its own file`);
    else if (lines <= MAX_LINES) errors.push(`${path}: down to ${lines} lines; take it out of BASELINE in scripts/checkFileLength.mjs`);
    else if (lines < cap) errors.push(`${path}: down to ${lines} lines; lower its BASELINE entry in scripts/checkFileLength.mjs from ${cap} to ${lines}`);
  }
}
for (const path of Object.keys(BASELINE)) {
  if (!seen.has(path)) errors.push(`${path}: gone; take it out of BASELINE in scripts/checkFileLength.mjs`);
}

if (errors.length) {
  console.error(`File length (max ${MAX_LINES} lines, CLAUDE.md "File size"):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
const left = Object.keys(BASELINE).length;
console.log(`file length ok (<= ${MAX_LINES} lines${left ? `; ${left} older files held at their baseline` : ''})`);
