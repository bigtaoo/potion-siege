import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { keepUpright, turnView } from './landView';

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
});
