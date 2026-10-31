import './layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { englishPage } from '../game/testWorld';
import { Battle } from '../sim/battle';
import { BASE_SETUP } from '../sim/meta';
import { BALANCE } from '../sim/types';
import { BossPreview, PREVIEW_SECONDS } from './bossPreview';

beforeAll(englishPage);

function lastWave(stage: number): Battle {
  const b = new Battle(5, { ...BASE_SETUP, stage });
  b.wave = BALANCE.waves.count - 1;
  b.pending = [];
  b.enemies = [];
  b.step();
  return b;
}

describe('BossPreview', () => {
  it('shows the boss once the free skill is picked, for a moment', () => {
    const b = lastWave(4);
    const p = new BossPreview();
    p.react(b.drain(), b);
    p.update(0.1, b);
    expect(p.visible, 'not over the cards').toBe(false);
    b.choose(b.choices![0]);
    p.update(0.1, b);
    expect(p.visible).toBe(true);
    expect(p.children.length).toBeGreaterThan(2);
    p.update(PREVIEW_SECONDS, b);
    expect(p.visible).toBe(false);
  });

  it('shows on every stage from 4 with a last boss', () => {
    for (const stage of [4, 11, 45]) {
      const b = lastWave(stage);
      const p = new BossPreview();
      p.react(b.drain(), b);
      b.choose(b.choices![0]);
      p.update(0.1, b);
      expect(p.visible, `stage ${stage}`).toBe(true);
    }
  });

  it('clears on reset and on a battle without one', () => {
    const b = lastWave(4);
    const p = new BossPreview();
    p.react(b.drain(), b);
    p.reset();
    b.choose(b.choices![0]);
    p.update(0.1, b);
    expect(p.visible).toBe(false);
    p.update(0.1, null);
    expect(p.visible).toBe(false);
  });
});
