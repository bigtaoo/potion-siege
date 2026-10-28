// Where the tutorial's card sits on a wide screen, and the painted glove once it is in (Tutorial.ts).
import './layout/measure';
import { Sprite, type Container } from 'pixi.js';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { fakeArt } from './fakeArt';
import { TutorialLayer, type Lesson } from './Tutorial';

afterAll(() => vi.unstubAllGlobals());

const card = (l: TutorialLayer) => l['card'] as Container;

describe('the tutorial card on a wide screen', () => {
  it('lies over the field above the skill cards when there is little room beside the board', () => {
    const l = new TutorialLayer(() => {});
    const clear = { x: 300, y: 100, w: 1000, h: 700 };
    l.show({ step: 'pick', holes: [], from: { x: 0, y: 0 }, clear }, 1600, 900, true, 0.1);
    expect(l.visible).toBe(true);
    expect(card(l).x).toBe(800);
    expect(card(l).width).toBeGreaterThanOrEqual(880);
  });

  it('stands beside the board on the side of the heroes, narrow with skip below', () => {
    const clear = { x: 800, y: 0, w: 800, h: 1000 };
    const merge = (x: number): Lesson => ({
      step: 'merge',
      holes: [{ x, y: 500, w: 100, h: 100 }, { x: x + 120, y: 500, w: 100, h: 100 }],
      from: { x: x + 50, y: 550 },
      to: { x: x + 170, y: 550 },
      clear,
    });
    const l = new TutorialLayer(() => {});
    l.show(merge(850), 2400, 1000, true, 0.1);
    expect(card(l).x).toBe(400);
    const panelW = card(l).width;
    expect(panelW).toBeGreaterThanOrEqual(560);
    expect(panelW).toBeLessThan(700);
    l.show(merge(1300), 2400, 1000, true, 0.1);
    expect(card(l).x).toBe(2000);
  });
});

describe('the painted glove', () => {
  it('replaces the drawn hand once the art is in, its fingertip on the anchor', async () => {
    const l = new TutorialLayer(() => {});
    const lesson: Lesson = { step: 'summon', holes: [{ x: 400, y: 1500, w: 200, h: 120 }], from: { x: 500, y: 1510 }, clear: { x: 0, y: 0, w: 1080, h: 1400 } };
    l.show(lesson, 1080, 1920, false, 0.1);
    const hand = l['hand'] as Container;
    expect(hand.children[0]).not.toBeInstanceOf(Sprite);
    await fakeArt();
    l.show(lesson, 1080, 1920, false, 0.1);
    const art = hand.children[0] as Sprite;
    expect(art).toBeInstanceOf(Sprite);
    expect([art.anchor.x, art.anchor.y]).toEqual([147 / art.texture.width, 14 / art.texture.height]);
    expect(art.scale.x).toBeCloseTo(0.58 * (417 / art.texture.height));
    l.show(lesson, 1080, 1920, false, 0.1);
    expect(hand.children).toEqual([art]);
  });
});
