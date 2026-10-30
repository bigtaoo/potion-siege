// Where the tutorial's card goes in the rarer layouts, and the merge hand's drag cycle (Tutorial.ts).
import './layout/measure';
import type { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { TutorialLayer, type Lesson, type Rect } from './Tutorial';

const card = (l: TutorialLayer) => l['card'] as Container;
const hand = (l: TutorialLayer) => l['hand'] as Container;

/** The merge lesson over two heroes side by side, the left one at (x, y). */
const merge = (x: number, y: number, clear: Rect): Lesson => ({
  step: 'merge',
  holes: [{ x, y, w: 100, h: 100 }, { x: x + 120, y, w: 100, h: 100 }],
  from: { x: x + 50, y: y + 50 },
  to: { x: x + 170, y: y + 50 },
  clear,
});

describe('the tutorial card in rarer layouts', () => {
  it('lies over a turned field to the left of heroes on its right half', () => {
    const l = new TutorialLayer(() => {});
    l.show(merge(1100, 400, { x: 300, y: 0, w: 1000, h: 900 }), 1600, 900, true, 0.1);
    // its right edge one gap short of the cut-out (1100 - 14), its tail past that
    expect(card(l).x).toBeCloseTo(1086 - 90 - 380);
  });

  it('stands on the roomier right of the board for the pick, mid-height', () => {
    const l = new TutorialLayer(() => {});
    l.show({ step: 'pick', holes: [], from: { x: 0, y: 0 }, clear: { x: 500, y: 0, w: 800, h: 1000 } }, 2400, 1000, true, 0.1);
    expect([card(l).x, card(l).y]).toEqual([(1300 + 2400) / 2, 500]);
  });

  it('takes the roomier left for heroes on the right, in smaller words when it is tight', () => {
    const l = new TutorialLayer(() => {});
    l.show(merge(1300, 500, { x: 520, y: 0, w: 1000, h: 1000 }), 2000, 1000, true, 0.1);
    expect(card(l).x).toBe(260);
    expect(card(l).width).toBeLessThan(560);
  });

  it('goes below heroes high on a tall screen, its tail pointing up', () => {
    const l = new TutorialLayer(() => {});
    l.show(merge(400, 300, { x: 0, y: 0, w: 1080, h: 1400 }), 1080, 1920, false, 0.1);
    expect(card(l).y).toBeGreaterThan(400);
    const tail = card(l).children[0];
    expect(tail.getBounds().minY).toBeLessThan(card(l).children[1].getBounds().minY);
  });
});

describe('the card over 召唤 on a tall screen', () => {
  const summon = (keep?: Rect[]): Lesson => ({
    step: 'more',
    holes: [{ x: 400, y: 1700, w: 280, h: 120 }],
    from: { x: 540, y: 1708 },
    clear: { x: 0, y: 0, w: 1080, h: 1920 },
    keep,
  });
  const bottom = (l: TutorialLayer) => card(l).y + card(l).children[1].height / 2;

  it('stands clear of the potions already summoned', () => {
    const l = new TutorialLayer(() => {});
    l.show(summon(), 1080, 1920, false, 0.1);
    const near = bottom(l);
    expect(near).toBeGreaterThan(1300);
    l.show(summon([{ x: 300, y: 1300, w: 150, h: 150 }]), 1080, 1920, false, 0.1);
    // the panel's drawn height takes in its shadow
    expect(bottom(l)).toBeLessThan(1300 - 45);
  });

  it('keeps its place beside the board on a wide screen', () => {
    const l = new TutorialLayer(() => {});
    const wide = { ...summon([{ x: 300, y: 1300, w: 150, h: 150 }]), holes: [{ x: 400, y: 900, w: 280, h: 120 }] };
    l.show({ ...wide, keep: undefined }, 1920, 1080, true, 0.1);
    const y = card(l).y;
    l.show(wide, 1920, 1080, true, 0.1);
    expect(card(l).y).toBe(y);
  });
});

describe('the merge hand', () => {
  it('drags at full size mid-cycle and fades out at the end of it', () => {
    const l = new TutorialLayer(() => {});
    const lesson = merge(400, 1000, { x: 0, y: 0, w: 1080, h: 1400 });
    l.show(lesson, 1080, 1920, false, 0.5);
    expect([hand(l).alpha, hand(l).scale.x]).toEqual([1, 1]);
    l.show(lesson, 1080, 1920, false, 1.2);
    expect(hand(l).alpha).toBeLessThan(1);
    expect(hand(l).alpha).toBeGreaterThan(0);
  });
});
