import { Container, Graphics, Text } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAmount } from '../i18n';
import { flyCrystals } from './fly';

const BURST = 0.22;
const FLIGHT = 0.55;
const STAGGER = 0.06;

function claim(before: number, after: number) {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const layer = new Container();
  const purse = new Container();
  purse.position.set(900, 60);
  const count = new Text({ text: '' });
  layer.addChild(purse);
  flyCrystals(layer, { x: 500, y: 1200 }, purse, count, before, after);
  const fx = layer.children[1] as Container;
  /** Runs a frame `t` seconds after the claim. */
  const at = (t: number) => {
    now = t * 1000;
    fx.onRender?.(null as never);
  };
  const shown = () => fx.children.filter((g) => g.visible).length;
  return { layer, purse, count, fx, at, shown };
}

afterEach(() => vi.restoreAllMocks());

describe('crystals flying into the purse', () => {
  it('sends one crystal for every 15 claimed, no fewer than 5 and no more than 12', () => {
    expect(claim(0, 150).fx.children.length).toBe(10);
    expect(claim(0, 10).fx.children.length).toBe(5);
    expect(claim(0, 5000).fx.children.length).toBe(12);
  });

  it('bursts them out one after another and takes no taps', () => {
    const { fx, at, shown } = claim(0, 150);
    expect(fx.eventMode).toBe('none');
    expect(shown()).toBe(0);
    at(STAGGER * 2.5);
    expect(shown()).toBe(3);
    const first = fx.children[0] as Graphics;
    at(BURST);
    expect(first.position).not.toMatchObject({ x: 500, y: 1200 });
  });

  it('counts up from the old amount as each lands, the purse swelling and settling', () => {
    const { purse, count, at } = claim(100, 250);
    expect(count.text).toBe(formatAmount(100));
    at(BURST + FLIGHT);
    expect(count.text).toBe(formatAmount(115));
    expect(purse.scale.x).toBeCloseTo(1.14);
    at(BURST + FLIGHT + 0.03);
    expect(purse.scale.x).toBeGreaterThan(1);
    expect(purse.scale.x).toBeLessThan(1.14);
  });

  it('ends on the new amount and clears itself away', async () => {
    const { layer, purse, count, fx, at } = claim(100, 250);
    const last = BURST + FLIGHT + 9 * STAGGER;
    at(last);
    expect(count.text).toBe(formatAmount(250));
    expect(fx.visible).toBe(true);
    at(last + 0.25);
    expect([fx.visible, fx.onRender, purse.scale.x]).toEqual([false, null, 1]);
    await Promise.resolve();
    expect(fx.destroyed).toBe(true);
    expect(layer.children).toEqual([purse]);
  });

  it('stops when the purse goes before they land', () => {
    const { purse, count, at, shown } = claim(100, 250);
    purse.destroy();
    at(BURST + FLIGHT);
    expect([shown(), count.text]).toEqual([0, formatAmount(100)]);
  });
});
