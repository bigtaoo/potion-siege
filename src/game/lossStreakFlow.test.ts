// The help after losses in a row (sim/lossStreak.ts) as the game books it at a battle's end
// (ending.ts) and hands it to the next battle on stages 1-3.
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { ASSIST_GOLD } from '../sim/lossStreak';
import { englishPage, play, veteran, world, type World } from './testWorld';

beforeAll(englishPage);

/** Plays the chosen stage until the wall falls. */
function lose(w: World): void {
  play(w);
  const g = w.game;
  for (let i = 0; i < 200 && !g['ended']; i++) {
    g['battle']!.wall = 0;
    g['tick'](0.1);
  }
  expect(g['battle']!.result).toBe('lost');
  g['menu'].visible = true;
}

describe('losses in a row on an early stage', () => {
  it('count up and bring gold and a free summon from the second', () => {
    const m = veteran();
    m.cleared = 1;
    m.stage = 2;
    const w = world(m);
    lose(w);
    expect(w.save().lossStreak).toBe(1);
    lose(w);
    expect(w.save().lossStreak).toBe(2);
    const plain = w.game['battle']!.setup.startGold;
    play(w);
    const b = w.game['battle']!;
    expect(b.setup.startGold).toBe(plain + ASSIST_GOLD);
    expect(b.setup.freeSummons).toBe(1);
    expect(b.summonCost()).toBe(0);
  });

  it('leave a later stage alone', () => {
    const w = world();
    lose(w);
    expect(w.save().lossStreak).toBe(0);
  });
});
