// `npm run economy`: how fast each player profile earns and spends crystals. Runs the shards of
// scripts/economy.test.ts side by side (casual / regular / heavy, without and with ads, one
// process per player), then turns their JSON into markdown: ref/balance/economy/<TAG>.md.
// `npm run economy -- report TAG...` only rewrites the report of shards already played.
// Env passes through to the shards (BAL, STAGES, ENDLESS, ENDLESS_FROM, CHAPTER_CHEST); PLAYERS
// (default 3) per profile, DAYS_CASUAL / DAYS_REGULAR / DAYS_HEAVY (180 / 120 / 60), TAG,
// PROFILES=heavy,regular to play only some, OUT_DIR.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = process.env.OUT_DIR ?? 'ref/balance/economy';
const PROFILES = (process.env.PROFILES ?? 'casual,regular,heavy').split(',');
const DAYS = { casual: Number(process.env.DAYS_CASUAL ?? 180), regular: Number(process.env.DAYS_REGULAR ?? 120), heavy: Number(process.env.DAYS_HEAVY ?? 60) };
const PLAYERS = Number(process.env.PLAYERS ?? 3);
const SOURCES = ['runs', 'double', 'login', 'tasks', 'chest', 'ads', 'challenge', 'achievements', 'chapter', 'endless', 'welcome'];
const SOURCE_NAMES = { runs: '战斗', double: '×2', login: '登录', tasks: '任务', chest: '宝箱', ads: '广告', challenge: '挑战', achievements: '成就', chapter: '章节', endless: '无尽', welcome: '欢迎' };

function runShard(env) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vitest', 'run', '--config', 'scripts/vitest.economy.config.js'], { env: { ...process.env, ...env }, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stdout.on('data', () => {});
    child.stderr.on('data', (d) => (err += d));
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`shard ${JSON.stringify(env)} failed:\n${err}`))));
  });
}

async function play(tag) {
  const t0 = Date.now();
  const jobs = [];
  for (const profile of PROFILES) for (const ads of ['0', '1']) for (let p = 0; p < PLAYERS; p++) jobs.push({ PROFILE: profile, ADS: ads, PLAYERS: '1', PLAYER0: String(p), DAYS: String(DAYS[profile]), TAG: tag, OUT_DIR: DIR });
  await Promise.all(jobs.map(runShard));
  console.error(`${jobs.length} shards in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

/** The middle value, a missing one (never reached) counting as the largest. */
const median = (xs) => {
  if (!xs.length) return null;
  const v = xs.map((x) => x ?? Infinity).sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];
  return v === Infinity ? null : v;
};
const fmtDay = (d, cap) => (d === null || d === undefined || d === Infinity ? `>${cap}` : String(d));
const k = (n) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const pct = (x) => `${Math.round(x * 100)}%`;

function load(tag) {
  const files = readdirSync(DIR).filter((f) => f.startsWith(`${tag}-`) && f.endsWith('.json'));
  const groups = new Map();
  for (const f of files) {
    const j = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'));
    const key = `${j.profile}-${j.ads ? 'ads' : 'noads'}`;
    if (!groups.has(key)) groups.set(key, { profile: j.profile, ads: j.ads, minutes: j.minutes, players: [] });
    groups.get(key).players.push(...j.out.map((o) => o.days));
  }
  return groups;
}

/** The numbers of one player's run. */
function stats(days) {
  const first = (f) => days.find(f)?.day ?? null;
  const total = days.reduce((s, d) => s + SOURCES.reduce((a, x) => a + d.earned[x], 0), 0);
  const cap = days.length;
  const stageCount = Math.max(...days.map((d) => d.cleared));
  const maxedDay = first((d) => d.maxed);
  const upTo = maxedDay ?? cap;
  // the longest run of days with no new first clear, while stages were left and nothing maxed
  let stall = 0;
  let run = 0;
  let prev = 0;
  let allClearedDay = null;
  for (const d of days) {
    if (d.maxed) break;
    if (allClearedDay === null && d.cleared >= (stats.stageCount ?? 20)) allClearedDay = d.day;
    if (d.cleared > prev || d.cleared >= (stats.stageCount ?? 20)) run = 0;
    else stall = Math.max(stall, ++run);
    prev = d.cleared;
  }
  const before = days.filter((d) => d.day <= upTo && !d.maxed);
  const income = (from, to) => {
    const ds = days.filter((d) => d.day >= from && d.day <= to);
    return ds.length ? ds.reduce((s, d) => s + SOURCES.reduce((a, x) => a + d.earned[x], 0), 0) / ds.length : null;
  };
  const shares = {};
  const d30 = days.filter((d) => d.day <= 30);
  const t30 = d30.reduce((s, d) => s + SOURCES.reduce((a, x) => a + d.earned[x], 0), 0) || 1;
  for (const x of SOURCES) shares[x] = d30.reduce((s, d) => s + d.earned[x], 0) / t30;
  const at = (n) => days.find((d) => d.day === n) ?? days[days.length - 1];
  return {
    cap,
    total,
    stageCount,
    maxedDay,
    allClearedDay,
    stall,
    stageDay: (s) => first((d) => d.cleared >= s),
    noBuy: before.length ? before.filter((d) => d.buys === 0).length / before.length : 0,
    income,
    shares,
    at,
    spentBy: (n) => days.filter((d) => d.day <= n).reduce((s, d) => s + d.spent, 0),
    battles: days.length ? days.reduce((s, d) => s + d.battles, 0) / days.length : 0,
  };
}

function section(tag, stageCount) {
  stats.stageCount = stageCount;
  const groups = load(tag);
  const order = ['casual', 'regular', 'heavy'].flatMap((p) => [`${p}-noads`, `${p}-ads`]).filter((g) => groups.has(g));
  const marks = [5, 10, 15, 20, 30, 40, 50].filter((s) => s <= stageCount);
  const lines = [`## ${tag}`, ''];
  lines.push(`| 档位 | 分钟/天 | 场/天 | ${marks.map((s) => `通关${s}`).join(' | ')} | 全满级 | 最长卡关天数 | 满级前无可买的天 | D7 已花 | D30 已花 |`);
  lines.push(`|---|---|---|${marks.map(() => '---').join('|')}|---|---|---|---|---|`);
  const all = {};
  for (const g of order) {
    const G = groups.get(g);
    const ss = G.players.map(stats);
    all[g] = ss;
    const cap = ss[0].cap;
    const dayCol = (f) => fmtDay(median(ss.map(f)), Math.max(...ss.map((s) => s.cap)));
    lines.push(
      `| ${G.profile}${G.ads ? ' +广告' : ''} | ${G.minutes} | ${(ss.reduce((a, s) => a + s.battles, 0) / ss.length).toFixed(1)} | ${marks.map((s) => dayCol((x) => x.stageDay(s))).join(' | ')} | **${dayCol((x) => x.maxedDay)}** | ${median(ss.map((x) => x.stall))} | ${pct(median(ss.map((x) => x.noBuy)))} | ${k(median(ss.map((x) => x.spentBy(7))))} | ${k(median(ss.map((x) => x.spentBy(30))))} |`,
    );
    void cap;
  }
  lines.push('', '日收入（水晶/天，各天平均，中位玩家）:', '');
  const spans = [
    [1, 1],
    [2, 3],
    [4, 7],
    [8, 14],
    [15, 30],
    [31, 60],
  ];
  lines.push(`| 档位 | ${spans.map(([a, b]) => (a === b ? `D${a}` : `D${a}-${b}`)).join(' | ')} |`, `|---|${spans.map(() => '---').join('|')}|`);
  for (const g of order) {
    const ss = all[g];
    lines.push(`| ${g} | ${spans.map(([a, b]) => {
      const v = median(ss.map((s) => s.income(a, b)));
      return v === null ? '–' : k(v);
    }).join(' | ')} |`);
  }
  lines.push('', '前 30 天收入来源占比:', '');
  lines.push(`| 档位 | ${SOURCES.map((s) => SOURCE_NAMES[s]).join(' | ')} |`, `|---|${SOURCES.map(() => '---').join('|')}|`);
  for (const g of order) {
    const ss = all[g];
    lines.push(`| ${g} | ${SOURCES.map((x) => pct(ss.reduce((a, s) => a + s.shares[x], 0) / ss.length)).join(' | ')} |`);
  }
  lines.push('', 'D7 / D30 存档（中位玩家：已通关，四瓶等级，工坊 墙/金/晶）:', '');
  lines.push('| 档位 | D7 | D30 |', '|---|---|---|');
  for (const g of order) {
    const ss = all[g];
    const mid = [...ss].sort((a, b) => a.at(7).cleared - b.at(7).cleared)[Math.floor((ss.length - 1) / 2)];
    const snap = (d) => `关${d.cleared} · ${d.heroes.slice(0, 4).join('/')} (毒${d.heroes[4]} 风${d.heroes[5]}) · ${d.workshop.join('/')}`;
    lines.push(`| ${g} | ${snap(mid.at(7))} | ${snap(mid.at(30))} |`);
  }
  lines.push('');
  return lines.join('\n');
}

const args = process.argv.slice(2);
const stageCount = Number(process.env.STAGES ?? 20);
mkdirSync(DIR, { recursive: true });
if (args[0] === 'report') {
  const text = args.slice(1).map((t) => section(t, stageCount)).join('\n');
  console.log(text);
} else {
  const tag = process.env.TAG ?? 'base';
  await play(tag);
  const text = `# 水晶经济 (${tag})${process.env.BAL ? ` BAL=${process.env.BAL}` : ''}${process.env.STAGES ? ` STAGES=${process.env.STAGES}` : ''}${process.env.ENDLESS ? ` ENDLESS=${process.env.ENDLESS}` : ''}\n\n${section(tag, stageCount)}`;
  writeFileSync(`${DIR}/${tag}.md`, text + '\n');
  console.log(text);
}
