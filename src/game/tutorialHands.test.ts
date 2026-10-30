// The first battle as a new player meets it on a tall screen, on FIRST_SEED: the hand on 召唤 and
// 强化 and the card above it never cover a potion already summoned (tutorialFlow.ts, Tutorial.ts).
import '../view/layout/measure';
import type { Container } from 'pixi.js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Game } from '../app';
import { FIRST_SEED, newMeta } from '../sim/meta';
import type { Lesson, Rect } from '../view/Tutorial';
import { englishPage, world } from './testWorld';

beforeAll(async () => {
  await englishPage();
  // the skill cards' hand listens on the page
  (globalThis as { window?: unknown }).window ??= { addEventListener() {}, removeEventListener() {} };
});

const frame = (g: Game) => g['tick'](1 / 60);

/** A new player's first battle at its own speed, and the lessons it shows, the latest last. */
function first(): { g: Game; lessons: (Lesson | null)[] } {
  const g = world(newMeta(), () => {}, '').game;
  const lessons: (Lesson | null)[] = [];
  const show = g.lessons.show.bind(g.lessons);
  g.lessons.show = (l, ...rest) => (lessons.push(l), show(l, ...rest));
  return { g, lessons };
}

/** Frames until the lessons layer shows `step`. */
function until(g: Game, lessons: (Lesson | null)[], step: Lesson['step']): Lesson {
  for (let i = 0; i < 6000; i++) {
    frame(g);
    const l = lessons[lessons.length - 1];
    if (l?.step === step) return l;
  }
  throw new Error(`no ${step} lesson`);
}

/** A rect in the lessons' page units, in screen pixels. */
function screen(g: Game, r: Rect): Rect {
  const a = g.lessons.toGlobal({ x: r.x, y: r.y });
  const b = g.lessons.toGlobal({ x: r.x + r.w, y: r.y + r.h });
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

function overlap(a: Rect, b: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  return a.x < b.maxX && b.minX < a.x + a.w && a.y < b.maxY && b.minY < a.y + a.h;
}

/** Over a second of frames, the cells the hand or the card touched. */
function covered(g: Game, l: Lesson): Rect[] {
  const hand = g.lessons['hand'] as Container;
  const card = g.lessons['card'] as Container;
  const hit = new Set<Rect>();
  for (let i = 0; i < 60; i++) {
    frame(g);
    for (const cell of l.keep ?? []) if ([hand, card].some((c) => overlap(screen(g, cell), c.getBounds()))) hit.add(cell);
  }
  return [...hit];
}

describe('the first battle on a tall screen', () => {
  it('runs on FIRST_SEED', () => {
    expect(first().g.battle!.seed).toBe(FIRST_SEED);
  });

  it('never covers a summoned potion with the hand on 召唤 or 强化, or with the card over it', () => {
    const { g, lessons } = first();
    expect([g.app.screen.width, g.app.screen.height]).toEqual([1080, 1920]);
    const b = g.battle!;
    until(g, lessons, 'summon');
    b.summon();
    const seen: Lesson['step'][] = [];
    const check = (step: Lesson['step']) => {
      const l = until(g, lessons, step);
      expect(l.keep!.length, step).toBeGreaterThan(0);
      expect(covered(g, l), step).toEqual([]);
      seen.push(step);
    };
    check('more');
    b.summon();
    const [from, to] = b.slots.flatMap((h, i) => (h ? [i] : []));
    until(g, lessons, 'merge');
    b.move(from, to);
    for (let i = 0; i < 2; i++) {
      check('again');
      b.summon();
    }
    check('upgrade');
    expect(seen).toEqual(['more', 'again', 'again', 'upgrade']);
  });
});
