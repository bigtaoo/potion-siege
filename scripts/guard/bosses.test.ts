// Balance guard for the chapter bosses (`npm run check:balance:slow`, a CI step of its own):
// `npm run bosses` on three stages a chapter, each boss against the steam tank in its place,
// pinned to a344dc7 and re-pinned for the wave-1 horde: its rushes reroll every seed's enemies,
// so these twenty seeds play other battles, while on 480 seeds the clock held (43.0% -> 42.4%
// won, the tank in its place 43.5% -> 44.4%). Re-pinned for the boss hit points of balance-tune
// (bee9f41): each boss is meant to sit 5-10 points under the tank (40 seeds, `npm run bosses`).
// Re-pinned for each potion's own pick of target (src/sim/targetPick.ts) and the hero damage cut
// that came with it (ref/design/targeting-prefs.md), then for tripod hp 30 -> 28 and anvil
// 39 -> 34, which put them back 7-8 points under the tank on 40 seeds.
import { describe, it } from 'vitest';
import { playOut } from '../../src/sim/bot';
import { battleSetup } from '../../src/sim/meta';
import { BALANCE, BOSS_KINDS, type BossKind } from '../../src/sim/types';
import { bossForStage, FIRST_STAGE } from '../../src/sim/waves';
import { ARRIVE, expectNear, mean, saveFor, winRate } from './saves';

describe('chapter bosses', () => {
  it('keeps each boss as hard as the steam tank give or take its pin', () => {
    // bosses.test.ts: swap the tank into the boss's slot of BOSS_KINDS and back, seeds 1+
    const slots = BOSS_KINDS as unknown as BossKind[];
    const delta: Record<string, number> = {};
    for (const kind of BOSS_KINDS.slice(1) as BossKind[]) {
      const first = FIRST_STAGE[kind];
      const idx = slots.indexOf(bossForStage(first));
      const tank: number[] = [];
      const own: number[] = [];
      for (const stage of [first, first + 4, first + BALANCE.bosses.chapter - 2]) {
        const setup = battleSetup(saveFor(ARRIVE[stage]), stage);
        const wins = () => winRate(Array.from({ length: 20 }, (_, i) => playOut(i + 1, 1200, setup)));
        own.push(wins());
        slots[idx] = 'boss';
        tank.push(wins());
        slots[idx] = kind;
      }
      delta[`${kind} win %`] = 100 * mean(own);
      delta[`${kind} - tank`] = 100 * (mean(own) - mean(tank));
    }
    expectNear('boss win % and its edge over the tank (20 seeds, 3 stages)', delta, {
      'clock win %': 48.3, 'clock - tank': -5,
      'tripod win %': 53.3, 'tripod - tank': -11.7,
      'anvil win %': 48.3, 'anvil - tank': -11.7,
      'gear win %': 41.7, 'gear - tank': -10,
    }, 15);
  }, 300_000);
});
