import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { Enemy } from '../sim/types';
import { aside, drawUpright, keepUpright, turnView } from './landView';
import { artBarTop, enemyBarBox } from './shapes';

const QUARTER = Math.PI / 2;

function view() {
  const v = new Container();
  const field = new Sprite();
  const wall = new Graphics();
  const layer = new Container();
  const figure = new Sprite();
  const drawn = new Graphics();
  const words = new Text({ text: '1000 / 1000' });
  layer.addChild(figure, drawn);
  v.addChild(field, wall, layer, words);
  return { v, field, wall, layer, figure, drawn, words };
}

describe('landView', () => {
  it('lands a sim point at (1920 - y, x)', () => {
    const { v } = view();
    turnView(v, true);
    const p = v.toGlobal({ x: 100, y: 300 });
    expect(p.x).toBeCloseTo(1620);
    expect(p.y).toBeCloseTo(100);
  });

  it('stands the figures and words up, leaving the field, the layers and the drawn parts turned', () => {
    const { v, field, wall, layer, figure, drawn, words } = view();
    turnView(v, true);
    keepUpright(v, wall);
    expect([figure.rotation, words.rotation]).toEqual([-QUARTER, -QUARTER]);
    expect([field.rotation, layer.rotation, drawn.rotation]).toEqual([0, 0, 0]);
  });

  it('turns back only once a frame, and keeps a rotation the view sets again', () => {
    const { v, wall, figure } = view();
    turnView(v, true);
    keepUpright(v, wall);
    keepUpright(v, wall);
    expect(figure.rotation).toBeCloseTo(-QUARTER);
    figure.rotation = 0.2;
    keepUpright(v, wall);
    expect(figure.rotation).toBeCloseTo(0.2 - QUARTER);
  });

  it('lets the figures lie with the view again once it is upright', () => {
    const { v, wall, figure, words } = view();
    turnView(v, true);
    keepUpright(v, wall);
    turnView(v, false);
    keepUpright(v, wall);
    expect([figure.rotation, words.rotation, v.pivot.y]).toEqual([0, 0, 0]);
  });

  it('puts a screen offset beside a figure: as given upright, turned with a lying field', () => {
    const { v } = view();
    turnView(v, false);
    expect({ ...aside(100, 300, 10, -40) }).toEqual({ x: 110, y: 260 });
    turnView(v, true);
    const p = aside(100, 300, 10, -40);
    // on the screen: 10 right of and 40 above where (100, 300) lands
    const from = v.toGlobal({ x: 100, y: 300 });
    const to = v.toGlobal({ x: p.x, y: p.y });
    expect(to.x - from.x).toBeCloseTo(10);
    expect(to.y - from.y).toBeCloseTo(-40);
    turnView(v, false);
  });

  it('keeps the bars of a tall boss on the screen on the top lane of a lying field', () => {
    const { v } = view();
    const boss = { x: 90, y: 600, radius: 80, hp: 50, maxHp: 100, shieldMax: 40, shield: 40 } as Enemy;
    turnView(v, true);
    const box = enemyBarBox(boss, artBarTop(boss));
    // the jar bar, 14 over the HP bar, starts under the title bar on the screen's top edge
    // (screen y = view x)
    expect(aside(boss.x, boss.y, 0, box.top - 14 - boss.y).x).toBeGreaterThanOrEqual(104);
    // one low on the field keeps its bars where they were
    const low = { ...boss, x: 900 };
    expect(enemyBarBox(low, artBarTop(low)).top).toBe(artBarTop(low));
    turnView(v, false);
    expect(enemyBarBox(boss, artBarTop(boss)).top).toBe(Math.max(104, artBarTop(boss)));
  });

  it('draws upright about a point: in place upright, about the origin turned back on a lying field', () => {
    const { v } = view();
    const g = new Graphics();
    const origins: number[][] = [];
    turnView(v, false);
    drawUpright(g, 100, 300, (ox, oy) => origins.push([ox, oy]));
    turnView(v, true);
    drawUpright(g, 100, 300, (ox, oy) => {
      origins.push([ox, oy]);
      g.rect(ox, oy - 40, 10, 40).fill(0xffffff);
    });
    turnView(v, false);
    expect(origins).toEqual([[100, 300], [0, 0]]);
    // the bar 40 tall drawn upward lies along the view's x, toward the left of the field
    const b = g.bounds;
    expect([b.minX, b.maxX, b.minY, b.maxY].map(Math.round)).toEqual([60, 100, 290, 300]);
  });
});
