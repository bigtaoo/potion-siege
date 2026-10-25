import { describe, expect, it } from 'vitest';
import type { Game } from '../app';
import { Battle } from '../sim/battle';
import { TICK_RATE } from '../sim/math/fixed';
import { HOLD_AFTER_SECONDS, Tutorial } from '../sim/tutorial';
import { held, logStep } from './tutorialFlow';

/** The bits of the Game the tutorial's flow reads. */
function game(over: Partial<Game> = {}) {
  const sent: { name: string; props: Record<string, unknown> }[] = [];
  const analytics = { sessionSeconds: 0, track: (name: string, props: Record<string, unknown>) => sent.push({ name, props }) };
  const g = { autoplay: false, tutorial: new Tutorial(), tutLog: { step: 'summon', shownT: null, shownS: null }, analytics, ...over } as unknown as Game;
  return { g, sent, analytics };
}

/** A first battle past the walk-in, where the summon step holds it. */
function waiting(): Battle {
  const b = new Battle(1);
  while (b.time < HOLD_AFTER_SECONDS * TICK_RATE) b.step();
  b.drain();
  return b;
}

describe('tutorial flow', () => {
  it('holds the battle while a step waits, never under autoplay or with no tutorial', () => {
    const b = waiting();
    expect(held(game().g, b)).toBe(true);
    expect(held(game({ autoplay: true }).g, b)).toBe(false);
    expect(held(game({ tutorial: null }).g, b)).toBe(false);
  });

  it('logs a step with the real seconds the held battle waited for it, and no assist', () => {
    const { g, sent, analytics } = game();
    const b = waiting();
    analytics.sessionSeconds = 4;
    logStep(g, g.tutorial!, b);
    expect(sent).toEqual([]);
    analytics.sessionSeconds = 31;
    b.summon();
    g.tutorial!.update(b, b.drain());
    logStep(g, g.tutorial!, b);
    expect(sent).toEqual([{ name: 'tutorial_step', props: { step: 'summon', shownT: HOLD_AFTER_SECONDS, doneT: HOLD_AFTER_SECONDS, waitS: 27 } }]);
    expect(g.tutLog).toEqual({ step: 'merge', shownT: null, shownS: null });
  });
});
