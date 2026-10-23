// replayStats.ts as the text `npm run replays` prints.

import type { ReplayStats, StageStats } from './replayStats';

const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : '-');
const pad = (v: string | number, w: number) => String(v).padStart(w);
const sorted = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]);

/** Stages in play order: 1, 1h, 2 … then endless. */
function stageOrder(a: string, b: string): number {
  const n = (k: string) => (k === 'endless' ? Infinity : parseInt(k, 10) + (k.endsWith('h') ? 0.5 : 0));
  return n(a) - n(b);
}

const waves = (m: Map<number, number>) =>
  [...m]
    .sort((a, b) => a[0] - b[0])
    .map(([w, n]) => `w${w}×${n}`)
    .join(' ') || '-';

function stageLine(key: string, st: StageStats): string {
  return `${pad(key, 7)} ${pad(st.battles, 5)} ${pad(pct(st.won, st.battles), 5)} ${pad(st.lost, 5)} ${pad(st.left, 5)}   falls ${waves(st.falls)}   lost ${waves(st.losses)}`;
}

function table(title: string, m: Map<string, number>, total: number, digits = 0): string[] {
  if (m.size === 0) return [title, '  (none)'];
  return [title, ...sorted(m).map(([k, n]) => `  ${k.padEnd(18)} ${pad(n.toFixed(digits), 10)} ${pad(pct(n, total), 5)}`)];
}

export function formatReport(s: ReplayStats): string {
  const out = [`replays played ${s.played}, other version ${s.oldVersion}, desynced ${s.desynced}`, ''];
  out.push('  stage  runs   won  lost  left');
  for (const key of [...s.stages.keys()].sort(stageOrder)) out.push(stageLine(key, s.stages.get(key)!));
  const wallTotal = [...s.wall.values()].reduce((a, b) => a + b, 0);
  out.push('', ...table(`wall damage by source (${Math.round(wallTotal)} hp)`, s.wall, wallTotal));
  const mergeTotal = [...s.merges.values()].reduce((a, b) => a + b, 0);
  out.push('', ...table(`merges (${mergeTotal}, ${s.summons} summons)`, s.merges, mergeTotal));
  const picks = [...s.picked.values()].reduce((a, b) => a + b, 0);
  out.push('', `skill offers: ${picks} picks, ${s.rerolls} rerolls, ${s.revives} revives`);
  out.push('  skill               offered  picked  pick rate');
  for (const [id, n] of sorted(s.offered)) out.push(`  ${id.padEnd(18)} ${pad(n, 8)} ${pad(s.picked.get(id) ?? 0, 7)} ${pad(pct(s.picked.get(id) ?? 0, n), 10)}`);
  const casts = [...s.casts.values()].reduce((a, b) => a + b, 0);
  out.push('', ...table(`commander casts (${casts})`, s.casts, casts));
  return out.join('\n');
}
