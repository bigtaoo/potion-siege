// The commander under the wall (commander.ts): where a tap casts, and its art once loaded, leaning
// back for a bomb and spinning its thrown flasks.
import '../layout/measure';
import { Container, Graphics, type Sprite } from 'pixi.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Battle } from '../../sim/battle';
import { BALANCE } from '../../sim/types';
import { SpriteLayer } from '../art';
import { fakeArt } from '../fakeArt';
import { turnView } from '../landView';
import { badgeAt, commanderMid, CommanderArt, onCommander } from './commander';

const battle = (charge = 0) =>
  ({ charge, paused: false, nextCast: 'bomb', chargedFor: 0, summonsToNextCell: () => 2 }) as unknown as Battle;

afterEach(() => turnView(new Container(), false));

describe('a tap on the commander', () => {
  it('casts on its body or its badge, on an upright field and a turned one', () => {
    for (const land of [false, true]) {
      turnView(new Container(), land);
      const mid = commanderMid();
      const badge = badgeAt();
      expect(onCommander(mid.x, mid.y + 100)).toBe(true);
      expect(onCommander(badge.x + 50, badge.y)).toBe(true);
      expect(onCommander(mid.x + 400, mid.y - 400)).toBe(false);
    }
  });
});

describe('the commander with its art', () => {
  beforeAll(fakeArt);

  const drawAt = (c: CommanderArt, t: number) => {
    const art = new SpriteLayer();
    art.begin();
    c.draw(new Graphics(), new Graphics(), art, battle(BALANCE.commander.charge), 0, t);
    art.end();
    return art.children.filter((s) => s.visible) as Sprite[];
  };

  it('leans back as a bomb is raised, flings it forward, and stands still after', () => {
    const c = new CommanderArt();
    c.cast = { at: 10, skill: 'bomb' };
    const [back] = drawAt(c, 10.1);
    expect(back.rotation).toBeLessThan(0);
    const [fling] = drawAt(c, 10 + 0.5 * 0.7);
    expect(fling.rotation).toBeGreaterThan(0);
    const [still] = drawAt(c, 12);
    expect(still.rotation).toBe(0);
    expect(c.castTap.visible).toBe(true);
  });

  it('rises on its toes for the brew without leaning', () => {
    const c = new CommanderArt();
    c.cast = { at: 10, skill: 'brew' };
    const [s] = drawAt(c, 10.25);
    expect(s.rotation).toBe(0);
    const [still] = drawAt(c, 12);
    expect(s.y).toBeLessThan(still.y);
  });

  it('throws the fire flask as art, spinning on its way', () => {
    const c = new CommanderArt();
    c.thrown = [{ x: 500, y: 600, at: 1, flight: 1 }];
    const g = new Graphics();
    const art = new SpriteLayer();
    art.begin();
    c.drawThrown(g, 1.5, art);
    art.end();
    const shown = art.children.filter((s) => s.visible) as Sprite[];
    expect(shown).toHaveLength(1);
    expect(shown[0].rotation).toBeCloseTo(18);
    expect(g.bounds.width).toBeGreaterThan(0);
  });
});
