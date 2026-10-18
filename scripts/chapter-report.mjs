// `node scripts/chapter-report.mjs [TAG ...]`: joins the shards of scripts/chapter-curve.test.ts
// (OUT_DIR, default D:/fang/ref/balance/chapters, files TAG-a-b.json) into one markdown table,
// a row a stage. Several TAGs (default: base) side by side, each after the first with its
// difference to the first in points.
import { readdirSync, readFileSync } from 'node:fs';

const DIR = process.env.OUT_DIR ?? 'D:/fang/ref/balance/chapters';
const tags = process.argv.slice(2).length ? process.argv.slice(2) : ['base'];
const files = readdirSync(DIR);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** stage -> row of one tag; a stage in two shards keeps the later file's. */
function load(tag) {
  const re = new RegExp(`^${esc(tag)}-\\d+-\\d+\\.json$`);
  const rows = new Map();
  for (const f of files.filter((f) => re.test(f)).sort()) for (const r of JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))) rows.set(r.stage, r);
  return rows;
}

const runs = tags.map(load);
const missing = tags.filter((_, i) => runs[i].size === 0);
if (missing.length) console.error(`no shards in ${DIR} for: ${missing.join(', ')}`);
const stages = [...new Set(runs.flatMap((m) => [...m.keys()]))].sort((a, b) => a - b);
/** The win rate at hp ×1 (or the first multiple of a SWEEP run), in percent. */
const win = (r) => (r ? Math.round(100 * (r.wins.find((w) => w.mult === 1) ?? r.wins[0]).win) : null);

const head = ['stage', 'ch', 'twists', 'hp', ...tags.flatMap((t, i) => (i ? [t, 'Δ'] : [t]))];
console.log(`| ${head.join(' | ')} |`);
console.log(`|${'---|'.repeat(head.length)}`);
for (const s of stages) {
  const any = runs.map((m) => m.get(s)).find(Boolean);
  const w = runs.map((m) => win(m.get(s)));
  const cells = w.flatMap((x, i) => {
    const v = x === null ? '–' : `${x}%`;
    if (!i) return [v];
    return [v, x === null || w[0] === null ? '' : `${x - w[0] > 0 ? '+' : ''}${x - w[0]}`];
  });
  console.log(`| ${s} | ${any.chapter} | ${any.twists.join('+') || '-'} | ${any.hp.toFixed(2)} | ${cells.join(' | ')} |`);
}
