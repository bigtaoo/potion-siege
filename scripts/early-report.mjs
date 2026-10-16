// `node scripts/early-report.mjs [TAG ...]`: turns the JSON of scripts/early-curve.test.ts
// (D:/fang/ref/balance/early) into markdown tables, one section per TAG (default: base).
import { readdirSync, readFileSync } from 'node:fs';

const DIR = process.env.OUT_DIR ?? 'D:/fang/ref/balance/early';
const tags = process.argv.slice(2).length ? process.argv.slice(2) : ['base'];
const files = readdirSync(DIR);
const load = (prefix) => files.filter((f) => f.startsWith(prefix)).flatMap((f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')));
const pct = (x) => `${Math.round(x * 100)}%`;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN;
};

function section(tag) {
  const out = [`## ${tag}`, ''];
  // a variant that only changes rewards plays like the base save for the same crystals spent
  let map = load(`map-${tag}-`);
  const ownMap = map.length > 0;
  if (!ownMap) map = load('map-base-');
  const budgets = [...new Set(map.map((r) => r.budget))].sort((a, b) => a - b);
  const cell = (b, s) => map.find((r) => r.budget === b && r.stage === s);
  /** Win rate at `spent` crystals, linear between the measured budgets; a missing stage past
   *  the last measured one counts as 0. */
  const winAt = (spent, s, key = 'win') => {
    const at = (b) => cell(b, s)?.[key] ?? 0;
    if (spent <= budgets[0]) return at(budgets[0]);
    for (let i = 1; i < budgets.length; i++) {
      if (spent <= budgets[i]) {
        const f = (spent - budgets[i - 1]) / (budgets[i] - budgets[i - 1]);
        return at(budgets[i - 1]) * (1 - f) + at(budgets[i]) * f;
      }
    }
    return at(budgets[budgets.length - 1]);
  };
  /** The fewest crystals spent at which stage `s` reaches 50%, interpolated. */
  const b50 = (s, key = 'win') => {
    for (let spent = 0; spent <= budgets[budgets.length - 1]; spent += 10) if (winAt(spent, s, key) >= 0.5) return spent;
    return null;
  };

  out.push(`### Win rate by crystals spent (no revive / with one revive)${ownMap ? '' : ' — same as base'}`, '');
  out.push('| spent | heroes (a f i l) | workshop (wall gold cry) | ' + [1, 2, 3, 4, 5, 6, 7, 8].map((s) => `st ${s}`).join(' | ') + ' |');
  out.push('|---|---|---|' + '---|'.repeat(8));
  for (const b of budgets) {
    const any = map.find((r) => r.budget === b);
    out.push(`| ${b} | ${any.levels.join(' ')} | ${any.workshop.join(' ')} | ` + [1, 2, 3, 4, 5, 6, 7, 8].map((s) => (cell(b, s) ? `${pct(cell(b, s).win)} / ${pct(cell(b, s).winRevive)}` : '0%')).join(' | ') + ' |');
  }
  out.push('', `Crystals spent for 50% (no revive): ${[1, 2, 3, 4, 5, 6, 7, 8].map((s) => `st${s} ${b50(s) ?? '>' + budgets[budgets.length - 1]}`).join(', ')}`, '');

  const profiles = [
    ['noads-r5', 'no ads, 5 runs a day'],
    ['noads-r3', 'no ads, 3 runs a day'],
    ['ads-r5', 'all ads (3 shop ads, revive, ×2), 5 runs a day'],
  ];
  for (const [key, name] of profiles) {
    const players = load(`campaign-${tag}-${key}-`);
    if (!players.length) continue;
    const runsPerDay = Number(key.split('-r')[1]);
    out.push(`### Campaign: ${name} (${players.length} players)`, '');
    // the save at progression points: crystals spent, then the win rate it gives on stages 1-8
    const points = [
      ['fresh', () => 0],
      ['after run 1', (l) => l[0].spent],
      ['end of day 1', (l) => l[runsPerDay - 1].spent],
      ['end of day 3', (l) => l[3 * runsPerDay - 1].spent],
      ['end of day 7', (l) => l[7 * runsPerDay - 1].spent],
    ];
    out.push('| point | spent (median) | cleared (median) | ' + [1, 2, 3, 4, 5, 6, 7, 8].map((s) => `st ${s}`).join(' | ') + ' |');
    out.push('|---|---|---|' + '---|'.repeat(8));
    for (const [label, f] of points) {
      const spent = median(players.map((p) => f(p.log)));
      const runIdx = { fresh: -1, 'after run 1': 0, 'end of day 1': runsPerDay - 1, 'end of day 3': 3 * runsPerDay - 1, 'end of day 7': 7 * runsPerDay - 1 }[label];
      const cleared = runIdx < 0 ? 0 : median(players.map((p) => p.log[runIdx].cleared));
      const key2 = key.startsWith('ads') ? 'winRevive' : 'win';
      out.push(`| ${label} | ${spent} | ${cleared} | ` + [1, 2, 3, 4, 5, 6, 7, 8].map((s) => pct(winAt(spent, s, key2))).join(' | ') + ' |');
    }
    out.push('');
    out.push('| stage | first try won | first clear: run (median) | day | losses before it (mean) | runs until the save is at 50% | day |');
    out.push('|---|---|---|---|---|---|---|');
    for (let s = 1; s <= 20; s++) {
      const tries = players.map((p) => p.log.find((r) => r.stage === s)).filter(Boolean);
      if (!tries.length) break;
      const clears = players.map((p) => p.log.find((r) => r.stage === s && r.won)).filter(Boolean);
      const losses = players.map((p) => p.log.filter((r) => r.stage === s && !r.won).length);
      const need = b50(s, key.startsWith('ads') ? 'winRevive' : 'win');
      const reach = need === null ? [] : players.map((p) => p.log.find((r) => r.spent >= need)).filter(Boolean);
      const reachRun = need === 0 ? 0 : reach.length === players.length ? median(reach.map((r) => r.run)) : null;
      const reachDay = need === 0 ? 1 : reach.length === players.length ? median(reach.map((r) => r.day)) : null;
      out.push(`| ${s} | ${tries.length < players.length ? `${tries.filter((r) => r.won).length}/${tries.length}` : pct(tries.filter((r) => r.won).length / tries.length)} | ${clears.length === players.length ? median(clears.map((r) => r.run)) : `${clears.length}/${players.length} cleared`} | ${clears.length === players.length ? median(clears.map((r) => r.day)) : '–'} | ${(losses.reduce((a, b) => a + b, 0) / players.length).toFixed(1)} | ${s > 8 ? '–' : (reachRun ?? '–')} | ${s > 8 ? '–' : (reachDay ?? '–')} |`);
    }
    const firstLoss = players.map((p) => p.log.find((r) => !r.won)).filter(Boolean);
    out.push('', `First loss: stage ${median(firstLoss.map((r) => r.stage))}, day ${median(firstLoss.map((r) => r.day))}, run ${median(firstLoss.map((r) => r.run))} (median of ${firstLoss.length}/${players.length} players who lost at all).`);
    const last = players.map((p) => p.log[p.log.length - 1]);
    out.push('', `After ${last[0].day} days: cleared median ${median(last.map((r) => r.cleared))}, spent median ${median(last.map((r) => r.spent))}.`, '');
  }
  return out.join('\n');
}

console.log(tags.map(section).join('\n\n'));
