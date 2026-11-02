// The commander's hints (cmdHints.ts): the cell by the count, the first-time line, the glow and
// the hand at a full charge.
import '../layout/measure';
import { Container, Graphics } from 'pixi.js';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import type { Battle } from '../../sim/battle';
import { FP } from '../../sim/math/fixed';
import { BALANCE } from '../../sim/types';
import { SpriteLayer } from '../art';
import { turnView } from '../landView';
import { badgeAt, CommanderArt } from './commander';
import { CommanderHints, DRAG, drawCellIcon, drawFullGlow, handOff, resetCellTip, TIP_SECONDS } from './cmdHints';

const battle = (charge = 0, left: number | null = 2, paused = false, enemies: object[] = []) =>
  ({ charge, paused, nextCast: 'bomb', chargedFor: 0, enemies, wallFront: () => 2000 * FP, summonsToNextCell: () => left }) as unknown as Battle;

/** An enemy far enough down the road to be the crowd the hand drags to. */
const foe = (x: number, y: number) => ({ id: 1, hp: 10, x: x * FP, y: y * FP, radius: 30 * FP, speed: 0, slowTime: 0, freezeTime: 0 });

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
    // beside the count, not over it on the wall's numbers
    expect(h.tip.y).toBe(1700);
    expect(h.tip.x).toBeLessThan(500 - 80);
    // wrapped to the room left of it, so a phone's edge cuts no word
    expect([h.tip.style.wordWrap, h.tip.style.wordWrapWidth]).toEqual([true, h.tip.x - 12]);
    h.showTip(3, { x: 500, y: 1700 }, 1, TIP_SECONDS);
    h.showTip(3, { x: 500, y: 1700 }, 1, 0.1);
    expect(h.tip.visible).toBe(false);
    // a new battle, a new view: still gone
    const again = new CommanderHints();
    again.showTip(2, { x: 500, y: 1700 }, 1, 0.1);
    expect(again.tip.visible).toBe(false);
  });

  it('goes under the commander on a turned field, wrapped to the narrow board', () => {
    turnView(new Container(), true);
    try {
      const h = new CommanderHints();
      h.showTip(3, { x: 500, y: 1700 }, 1, 0.1);
      // 250 down the screen, which on the lying view is 250 along its x
      expect(h.tip.x).toBe(750);
      expect(h.tip.y).toBe(1700);
      expect(h.tip.anchor.x).toBe(0.5);
      expect(h.tip.style.wordWrap).toBe(true);
    } finally {
      turnView(new Container(), false);
    }
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

  it('with nobody on the road, points up at the badge from below; gone in a pause or when not full', () => {
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

  it('drags from the badge onto the crowd and shows the ring there, then starts over', () => {
    const c = new CommanderArt();
    const full = battle(BALANCE.commander.charge, 2, false, [foe(500, 900)]);
    const hand = c.hints.hand;
    const from = { ...badgeAt() };
    draw(c, full, 0.01);
    expect(hand.visible).toBe(true);
    expect(Math.hypot(hand.x - from.x, hand.y - from.y)).toBeLessThan(5);
    expect(c.hints.trail.getLocalBounds().width).toBe(0);
    // resting on the crowd, the bomb's reach drawn round it
    draw(c, full, DRAG.cycle * (DRAG.slide + 0.05));
    expect([hand.x, hand.y]).toEqual([500, 900]);
    const ring = c.hints.trail.getLocalBounds();
    expect(ring.maxX).toBeCloseTo(500 + BALANCE.commander.bomb.radius + 3, 0);
    // the next drag starts at the badge again
    draw(c, full, DRAG.cycle * (1 - DRAG.slide - 0.05) + 0.01);
    expect(Math.hypot(hand.x - from.x, hand.y - from.y)).toBeLessThan(5);
  });

  it('steps aside while the player aims the spell', () => {
    const c = new CommanderArt();
    c.aiming = true;
    draw(c, battle(BALANCE.commander.charge, 2, false, [foe(500, 900)]));
    expect(c.hints.hand.visible).toBe(false);
    expect(c.castTap.visible).toBe(true);
    c.aiming = false;
    draw(c, battle(BALANCE.commander.charge, 2, false, [foe(500, 900)]));
    expect(c.hints.hand.visible).toBe(true);
  });

  it("waits while the board's own hand points at a pair, the glow still there", () => {
    const c = new CommanderArt();
    handOff.board = true;
    const over = draw(c, battle(BALANCE.commander.charge));
    expect(c.hints.hand.visible).toBe(false);
    expect(c.castTap.visible).toBe(true);
    expect(over.getLocalBounds().width).toBeGreaterThan(0);
    handOff.board = false;
    draw(c, battle(BALANCE.commander.charge));
    expect(c.hints.hand.visible).toBe(true);
  });
});
