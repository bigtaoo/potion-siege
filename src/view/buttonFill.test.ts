import { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { Battle, GIFT_EVERY } from '../sim/battle';
import { BASE_SETUP } from '../sim/meta';
import { buttonFill, drawFill } from './buttonFill';

describe('buttonFill', () => {
  it('fills toward 强化 with the gold in the first battles only', () => {
    const b = new Battle(1, BASE_SETUP);
    b.gold = b.upgradeCost() / 4;
    expect(buttonFill(b, 'upgrade', true)).toBe(0.25);
    expect(buttonFill(b, 'upgrade', false)).toBeNull();
    b.gold = b.upgradeCost();
    expect(buttonFill(b, 'upgrade', true)).toBeNull();
  });

  it('fills toward a paid summon on a grid with room, in the first battles only', () => {
    const b = new Battle(1, BASE_SETUP);
    b.gold = b.summonCost() / 2;
    expect(buttonFill(b, 'summon', true)).toBe(0.5);
    expect(buttonFill(b, 'summon', false)).toBeNull();
    b.freeSlots = () => [];
    expect(buttonFill(b, 'summon', true)).toBeNull();
  });

  it('counts down to the next gift in every battle that has one, and shows nothing once it is over', () => {
    const b = new Battle(1, BASE_SETUP);
    b.giftLeft = () => GIFT_EVERY / 3;
    expect(buttonFill(b, 'summon', false)).toBeCloseTo(2 / 3);
    b.result = 'won';
    expect(buttonFill(b, 'summon', false)).toBeNull();
  });
});

describe('drawFill', () => {
  it('draws a track and a bar at least round, or nothing', () => {
    const g = new Graphics();
    drawFill(g, 0.5, 320, 150);
    expect(g.context.instructions).toHaveLength(2);
    drawFill(g, 0, 320, 150);
    expect(g.context.instructions).toHaveLength(1);
    drawFill(g, null, 320, 150);
    expect(g.context.instructions).toHaveLength(0);
  });
});
