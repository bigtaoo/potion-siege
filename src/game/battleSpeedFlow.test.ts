// The battle's 1.5x (battleSpeed.ts, view/speedButton.ts) as the player meets it: a button under
// the pause button on a stage won before, that runs the battle's steps half again as fast, and
// each new battle back at 1x. The real game over a stand-in Pixi app (testWorld.ts).
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { t } from '../i18n';
import type { MetaSave } from '../sim/meta';
import { playChallenge, playEndless } from './modes';
import { englishPage, flush, play, playToEnd, tap, texts, veteran, world, type World } from './testWorld';
// after the game: sim/stars.ts loaded ahead of sim/meta.ts trips over their import cycle
import { FAST } from './battleSpeed';

beforeAll(englishPage);

/** A veteran (cleared 19) on `stage`, who has never merged, so the merge hint would show. */
function on(stage: number): MetaSave {
  const m = veteran();
  m.stage = stage;
  m.achievements.stats.merges = 0;
  return m;
}

const button = (w: World) => w.stage.getChildByLabel('speed', true) as Container;

/** What the speed button reads, or null while it is not on screen. */
function reads(w: World): string | null {
  w.game['tick'](0);
  const b = button(w);
  if (!b.visible || w.game['menu'].visible) return null;
  return texts(b).join();
}

/** Battle steps taken over `frames` frames of 0.1 s. */
function steps(w: World, frames: number): number {
  const b = w.game['battle']!;
  let n = 0;
  const step = b.step.bind(b);
  b.step = () => {
    n++;
    step();
  };
  for (let i = 0; i < frames; i++) w.game['tick'](0.1);
  return n;
}

describe('the speed button', () => {
  it('shows at ×1 on a stage won before, with the merge hint off', () => {
    const w = world(on(19));
    play(w);
    expect(reads(w)).toBe('×1');
    expect(w.game.hud.fast).toBe(false);
    expect(w.game.hud.hint).toBe(false);
  });

  it('does not show on a new stage, where the merge hint stays on', () => {
    const w = world(on(20));
    play(w);
    expect(reads(w)).toBeNull();
    expect(w.game.hud.hint).toBe(true);
  });

  it('does not show in endless mode', () => {
    const w = world(on(19));
    playEndless(w.game);
    expect(reads(w)).toBeNull();
  });

  it('does not show in the daily challenge, even on a stage won before', () => {
    const m = on(19);
    m.cleared = 60;
    const w = world(m);
    playChallenge(w.game, false);
    expect(w.game['challenge']).not.toBeNull();
    expect(w.game['battle']!.setup.stage).toBeLessThanOrEqual(w.save().cleared);
    expect(reads(w)).toBeNull();
  });

  it('is not offered to the idle battle under the home screen', () => {
    const w = world(on(19));
    expect(w.game['menu'].visible).toBe(true);
    expect(w.game['run']).toBeNull();
    expect(w.game.hud['hurry']).toBe(false);
  });

  it('runs the same frames at 1.5x the battle steps once tapped, and back at 1x tapped again', () => {
    const w = world(on(19), () => {}, 'speed=1');
    play(w);
    const slow = steps(w, 10);
    tap(w.stage, '×1');
    expect(reads(w)).toBe('×1.5');
    const fast = steps(w, 10);
    expect(fast / slow).toBeCloseTo(FAST, 1);
    tap(w.stage, '×1.5');
    expect(reads(w)).toBe('×1');
    expect(steps(w, 10)).toBe(slow);
  });

  it('hides once the battle has its result', () => {
    const w = world(on(19));
    play(w);
    tap(w.stage, '×1');
    playToEnd(w);
    expect(button(w).visible).toBe(false);
  });
});

describe('a new battle', () => {
  it('starts at ×1 again when played again from home', async () => {
    const w = world(on(19));
    play(w);
    tap(w.stage, '×1');
    playToEnd(w);
    tap(w.stage, t('continue'));
    await flush();
    play(w);
    expect(w.game.hud.fast).toBe(false);
    expect(reads(w)).toBe('×1');
  });

  it('starts at ×1 again on the next stage, and without the button if that one is new', () => {
    const w = world(on(18));
    play(w);
    tap(w.stage, '×1');
    w.game.newBattle('next');
    expect(w.game.hud.fast).toBe(false);
    expect(reads(w)).toBe('×1');
    w.game.save.stage = 20;
    w.game.newBattle('next');
    expect(reads(w)).toBeNull();
  });

  it('turns a speed-up from an earlier battle off in an endless run', () => {
    const w = world(on(19));
    play(w);
    tap(w.stage, '×1');
    playEndless(w.game);
    expect(w.game.hud.fast).toBe(false);
  });
});
