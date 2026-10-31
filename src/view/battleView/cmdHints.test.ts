// The commander's hints (cmdHints.ts): the cell by the count, the first-time line, the glow and
// the hand at a full charge.
import '../layout/measure';
import { Graphics } from 'pixi.js';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import type { Battle } from '../../sim/battle';
import { BALANCE } from '../../sim/types';
import { SpriteLayer } from '../art';
import { badgeAt, CommanderArt } from './commander';
import { CommanderHints, drawCellIcon, drawFullGlow, resetCellTip, TIP_SECONDS } from './cmdHints';

const battle = (charge = 0, left: number | null = 2, paused = false) =>
  ({ charge, paused, nextCast: 'bomb', chargedFor: 0, summonsToNextCell: () => left }) as unknown as Battle;

const draw = (c: CommanderArt, b: Battle, dt = 0.1, over = new Graphics()) => {
  const art = new SpriteLayer();
  art.begin();
  c.draw(new Graphics(), over, art, b, dt, 1);
  art.end();
  return over;
};

afterEach(resetCellTip);

describe('the cell by the count', () => {
  it('is a small square centred where it is asked', () => {
    const g = new Graphics();
    drawCellIcon(g, 200, 300, 1);
    const b = g.getLocalBounds();
    expect((b.minX + b.maxX) / 2).toBeCloseTo(200, 0);
    expect((b.minY + b.maxY) / 2).toBeCloseTo(300, 0);
    expect(b.width).toBeLessThan(40);
  });

  it('stands left of the count pill', () => {
    const c = new CommanderArt();
    const over = draw(c, battle());
    expect(over.getLocalBounds().minX).toBeLessThan(c.count.x - 56 - 10);
  });
});

describe('the first-time line', () => {
  it('says what the count builds, then goes for the rest of the page load', () => {
    const h = new CommanderHints();
    h.showTip(3, { x: 500, y: 1700 }, 1, 0.1);
    expect(h.tip.visible).toBe(true);
    expect(h.tip.text).toBe(t('cellTip', { n: 3 }));
    expect(h.tip.y).toBeLessThan(1700);
    h.showTip(3, { x: 500, y: 1700 }, 1, TIP_SECONDS);
    h.showTip(3, { x: 500, y: 1700 }, 1, 0.1);
    expect(h.tip.visible).toBe(false);
    // a new battle, a new view: still gone
    const again = new CommanderHints();
    again.showTip(2, { x: 500, y: 1700 }, 1, 0.1);
    expect(again.tip.visible).toBe(false);
  });

  it('waits while there is no count, and stands still in a pause', () => {
    const c = new CommanderArt();
    draw(c, battle(0, null), 1);
    expect(c.hints.tip.visible).toBe(false);
    draw(c, battle(0, 2, true), TIP_SECONDS + 1);
    draw(c, battle(0, 2), 0.1);
    expect(c.hints.tip.visible).toBe(true);
  });
});

describe('a full charge', () => {
  it('glows around the whole ring', () => {
    const g = new Graphics();
    drawFullGlow(g, 100, 100, 34, 0);
    expect(g.getLocalBounds().width).toBeGreaterThan(2 * (34 + 14));
  });

  it('brings a hand pointing up at the badge from below, gone in a pause or when not full', () => {
    const c = new CommanderArt();
    draw(c, battle(BALANCE.commander.charge));
    const hand = c.hints.hand;
    expect(hand.visible).toBe(true);
    expect(hand.y).toBeGreaterThan(badgeAt().y);
    expect(Math.abs(hand.rotation)).toBeLessThan(Math.PI / 2);
    draw(c, battle(BALANCE.commander.charge, 2, true));
    expect(hand.visible).toBe(false);
    draw(c, battle(0));
    expect(hand.visible).toBe(false);
  });
});
