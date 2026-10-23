// `npm run replays`: the players' battles played again from their replays (the collector's
// data/replays, scripts/replayShelf.mjs; server/README.md says how to fetch them) and what they
// show (src/sim/replayStats.ts): where the wall falls by stage and wave, what bites it, the merges
// made, the skill cards picked and the commander's casts. REPLAYS=<dir> (default
// telemetry/replays); DAYS=n counts only the last n days' uploads; BUILD=<prefix> only those builds.
import { it } from 'vitest';
import { readShelf } from './replayShelf.mjs';
import { formatReport } from '../src/sim/replayReport';
import { addReplay, newStats } from '../src/sim/replayStats';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

it('replays', () => {
  const dir = env.REPLAYS ?? 'telemetry/replays';
  const since = env.DAYS ? Date.now() - Number(env.DAYS) * 24 * 3600_000 : 0;
  const docs = readShelf(dir).filter((d) => d.at >= since && (!env.BUILD || d.build?.startsWith(env.BUILD)));
  const stats = newStats();
  for (const d of docs) addReplay(stats, d.replay);
  const ends = new Map<string, number>();
  for (const d of docs) ends.set(d.end, (ends.get(d.end) ?? 0) + 1);
  console.log(`${docs.length} replays from ${new Set(docs.map((d) => d.uid)).size} installs in ${dir} (sent on ${[...ends].map(([e, n]) => `${e} ${n}`).join(', ') || '-'})\n`);
  console.log(formatReport(stats));
});
