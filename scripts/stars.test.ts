// `npm run stars`: how the bot's wins spread over one, two and three stars, on a normal stage at
// the save the median player first tries it with, and on its hard stage with the save of a player
// six and ten stages further on (hard mode opens only after the chapter, so they come back later).
// SEEDS (default 12) battles each.

import { it } from 'vitest';
import { botAct } from '../src/sim/bot';
import { battleSetup } from '../src/sim/meta';
import { hardSetup, runStars } from '../src/sim/stars';
import { ARRIVE, play, saveFor } from './guard/saves';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

it('stars', () => {
  const seeds = Number(env.SEEDS ?? 12);
  const rows = ['| 关 | 模式 | 存档 | 胜 | 2★+ | 3★ |', '|---|---|---|---|---|---|'];
  for (const s of [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]) {
    for (const [hard, ahead] of [[false, 0], [true, 6], [true, 10]] as const) {
      const m = saveFor(ARRIVE[Math.min(51, s + ahead)]);
      const count = [0, 0, 0, 0];
      for (let k = 0; k < seeds; k++) {
        const setup = battleSetup(m, s);
        const { b } = play(9000 + k * 17 + s, hard ? hardSetup(setup) : setup, botAct);
        count[runStars(b.result === 'won', false, Math.max(0, b.wall) / b.wallMax)]++;
      }
      const won = seeds - count[0];
      rows.push(`| ${s} | ${hard ? '困难' : '普通'} | +${ahead} | ${won}/${seeds} | ${count[2] + count[3]} | ${count[3]} |`);
    }
  }
  console.log(rows.join('\n'));
}, 3_600_000);
