import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Game } from '../app';
import { t } from '../i18n';
import { Battle, WALL_ROW } from '../sim/battle';
import { TICK_RATE } from '../sim/math/fixed';
import { newMeta } from '../sim/meta';
import { HOLD_AFTER_SECONDS, mergeablePair, SLOW_PACE, Tutorial } from '../sim/tutorial';
import { BALANCE } from '../sim/types';
import type { Lesson, Rect } from '../view/Tutorial';
import { beginTutorial, endTutorial, logStep, pace } from './tutorialFlow';
import { englishPage, tap, world, type World } from './testWorld';

beforeAll(async () => {
  await englishPage();
  // the skill cards' hand listens on the page
  (globalThis as { window?: unknown }).window ??= { addEventListener() {}, removeEventListener() {} };
});

/** The bits of the Game the tutorial's flow reads. */
function game(over: Partial<Game> = {}) {
  const sent: { name: string; props: Record<string, unknown> }[] = [];
  const analytics = { sessionSeconds: 0, track: (name: string, props: Record<string, unknown>) => sent.push({ name, props }) };
  const g = { autoplay: false, tutorial: new Tutorial(), tutLog: { step: 'summon', shownT: null, shownS: null }, analytics, ...over } as unknown as Game;
  return { g, sent, analytics };
}

/** A first battle past the walk-in, where the summon step slows it. */
function waiting(): Battle {
  const b = new Battle(1);
  while (b.time < HOLD_AFTER_SECONDS * TICK_RATE) b.step();
  b.drain();
  return b;
}

describe('tutorial flow', () => {
  it('slows the battle while a step waits, never under autoplay or with no tutorial', () => {
    const b = waiting();
    expect(pace(game().g, b)).toBe(SLOW_PACE);
    expect(pace(game({ autoplay: true }).g, b)).toBe(1);
    expect(pace(game({ tutorial: null }).g, b)).toBe(1);
  });

  it('logs a step with the real seconds the slowed battle waited for it, and no assist', () => {
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

  it('logs nothing once the log is closed', () => {
    const { g, sent } = game({ tutLog: null });
    const b = waiting();
    b.summon();
    g.tutorial!.update(b, b.drain());
    logStep(g, g.tutorial!, b);
    expect(sent).toEqual([]);
  });
});

/** A new player's first battle, the lessons layer's last lesson kept. */
function first(): { w: World; g: Game; lessons: (Lesson | null)[] } {
  const w = world(newMeta());
  const g = w.game;
  const lessons: (Lesson | null)[] = [];
  const show = g.lessons.show.bind(g.lessons);
  g.lessons.show = (l, ...rest) => (lessons.push(l), show(l, ...rest));
  return { w, g, lessons };
}

const frame = (g: Game) => g['tick'](1 / 60);
const last = <T>(a: T[]): T | undefined => a[a.length - 1];

/** Frames until the lessons layer shows `step`. */
function until(g: Game, lessons: (Lesson | null)[], step: Lesson['step']): Lesson {
  for (let i = 0; i < 3000; i++) {
    frame(g);
    const l = last(lessons);
    if (l?.step === step) return l;
  }
  throw new Error(`no ${step} lesson`);
}

/** The board's rect in page units, as the game places it now. */
function page(g: Game, r: Rect): Rect {
  // the page's scale, which the overlay is drawn at
  const s = g['overlay'].scale.x;
  const k = g.root.scale.x / s;
  return { x: g.root.x / s + r.x * k, y: g.root.y / s + r.y * k, w: r.w * k, h: r.h * k };
}

/** The same rects give or take a pixel: a pulsing button breathes a little between frames. */
function near(got: Rect[], want: Rect[]): void {
  expect(got).toHaveLength(want.length);
  got.forEach((r, i) => (['x', 'y', 'w', 'h'] as const).forEach((k) => expect(Math.abs(r[k] - want[i][k]), k).toBeLessThan(2)));
}

/** Two level-1 fire potions side by side on the front row. */
function pair(b: Battle): void {
  const w = WALL_ROW * BALANCE.grid.cols;
  b.slots[w] = { id: 901, kind: 'fire', star: 1, slot: w, cooldown: 1 };
  b.slots[w + 1] = { id: 902, kind: 'fire', star: 1, slot: w + 1, cooldown: 1 };
}

describe('beginTutorial', () => {
  it("starts with a new player's first battle, the opening hint and nudge held back", () => {
    const { g } = first();
    expect(g.tutorial?.step).toBe('summon');
    expect(g.tutLog).toEqual({ step: 'summon', shownT: null, shownS: null });
    expect([g.hud.hint, g.hud.nudge]).toEqual([false, false]);
  });

  it('waits for stage 1 on a save that has not seen it, and never runs under autoplay', () => {
    const stage = (n: number) => ({ setup: { stage: n } }) as Battle;
    const cases: [Partial<Game>, boolean][] = [
      [{ battle: stage(1) }, true],
      [{ battle: stage(2) }, false],
      [{ battle: null }, false],
      [{ battle: stage(1), autoplay: true }, false],
    ];
    for (const [over, starts] of cases) {
      const g = { autoplay: false, save: { tutorial: false }, tutorial: null, hud: { hint: true, nudge: true }, ...over } as unknown as Game;
      beginTutorial(g);
      expect(g.tutorial !== null, JSON.stringify(over)).toBe(starts);
    }
    const seen = { autoplay: false, save: { tutorial: true }, battle: stage(1), tutorial: null, hud: {} } as unknown as Game;
    beginTutorial(seen);
    expect(seen.tutorial).toBeNull();
  });
});

describe('endTutorial', () => {
  it('skipped: says at which step, never comes back, and gives the hint and nudge back', () => {
    const { w, g } = first();
    endTutorial(g, true);
    expect(w.events('tutorial_end')).toEqual([{ step: 'summon', skipped: true }]);
    expect(g.tutorial).toBeNull();
    expect([g.hud.hint, g.hud.nudge]).toEqual([true, true]);
    expect(w.save().tutorial).toBe(true);
  });

  it('keeps the merge hint off for a player who already merged', () => {
    const { w, g } = first();
    g.save.achievements.stats.merges = 1;
    endTutorial(g, false);
    expect(w.events('tutorial_end')).toEqual([{ step: 'done', skipped: false }]);
    expect([g.hud.hint, g.hud.nudge]).toEqual([false, true]);
  });

  it('does nothing with no tutorial running', () => {
    const { w, g } = first();
    endTutorial(g, true);
    endTutorial(g, true);
    expect(w.events('tutorial_end')).toHaveLength(1);
  });

  it("ends from the card's skip button", () => {
    const { w, g, lessons } = first();
    until(g, lessons, 'summon');
    tap(w.stage, `${t('tutorial.skip')} ›`);
    expect(g.tutorial).toBeNull();
    expect(w.events('tutorial_end')).toEqual([{ step: 'summon', skipped: true }]);
    frame(g);
    expect([last(lessons), g.lessons.visible]).toEqual([null, false]);
  });
});

describe('the lessons over the first battle', () => {
  it('points at 召唤 from the first frame, and pulses it', () => {
    const { g, lessons } = first();
    frame(g);
    const l = last(lessons)!;
    const r = page(g, g.hud.buttonRect('summon'));
    expect(l.step).toBe('summon');
    near(l.holes, [r]);
    near([{ ...l.from, w: 0, h: 0 }], [{ x: r.x + r.w / 2, y: r.y + 8, w: 0, h: 0 }]);
    expect(g.hud.pulse).toBe(true);
    expect(g.lessons.visible).toBe(true);
  });

  it('walks summon, more, merge, upgrade and the pick, then ends as done', () => {
    const { w, g, lessons } = first();
    until(g, lessons, 'summon');
    const b = g.battle!;
    b.summon();
    b.slots.fill(null);
    near(until(g, lessons, 'more').holes, [page(g, g.hud.buttonRect('summon'))]);
    expect(g.hud.pulse).toBe(true);

    pair(b);
    const merge = until(g, lessons, 'merge');
    const [a, c] = mergeablePair(b)!;
    expect(merge.holes).toHaveLength(2);
    expect(merge.from.x).toBeLessThan(merge.to!.x);
    expect(g.hud.pulse).toBe(false);
    b.move(a, c);

    b.gold = 1e5;
    near(until(g, lessons, 'upgrade').holes, [page(g, g.hud.buttonRect('upgrade'))]);
    b.upgrade();
    const pick = until(g, lessons, 'pick');
    expect(g['overlay'].visible, 'the pick shows over the skill cards').toBe(true);
    expect(pick.holes).toEqual([]);
    expect(pick.clear.w).toBeGreaterThan(0);

    g['pick'](b.choices![0]);
    frame(g);
    expect(g.tutorial).toBeNull();
    expect(last(lessons)).toBeNull();
    expect(w.events('tutorial_step').map((e) => e.step)).toEqual(['summon', 'merge', 'upgrade', 'pick']);
    expect(w.events('tutorial_end')).toEqual([{ step: 'done', skipped: false }]);
    expect(w.save().tutorial).toBe(true);
  });

  it('hides while the board itself is hidden', () => {
    const { g, lessons } = first();
    until(g, lessons, 'summon');
    g.root.visible = false;
    frame(g);
    expect(last(lessons)).toBeNull();
  });

  it('turns the merge cut-outs with a field on its side', () => {
    const { g, lessons } = first();
    const screen = g.app.screen as { width: number; height: number };
    [screen.width, screen.height] = [1920, 1080];
    try {
      until(g, lessons, 'summon');
      g.battle!.summon();
      pair(g.battle!);
      const merge = until(g, lessons, 'merge');
      const k = g.root.scale.x / g['overlay'].scale.x;
      expect(merge.holes[0].w).toBeCloseTo(BALANCE.grid.cellH * k);
      expect(merge.holes[0].h).toBeCloseTo(BALANCE.grid.cellW * k);
    } finally {
      [screen.width, screen.height] = [1080, 1920];
      frame(g);
    }
  });
});
