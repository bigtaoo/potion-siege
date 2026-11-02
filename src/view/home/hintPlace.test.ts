// Where the guide's line goes: never on the pointed button or a hand, clear of the buttons it
// must not hide, and what a panel's shade hides does not count.
import '../layout/measure';
import { describe, expect, it } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { cheapest, cost, obstacles, overlap, placeCard, type Obstacle } from './hintPlace';
import type { Box } from './guideMark';

const FIT = { scale: 1, w: 1080, h: 2280, wide: false };
const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const inside = (p: { x: number; y: number }, cw: number, ch: number): Box => box(p.x - cw / 2, p.y - ch / 2, cw, ch);

/** A tappable rectangle on `root`, labelled. */
function button(root: Container, label: string, b: Box): Container {
  const c = new Container();
  c.label = label;
  c.eventMode = 'static';
  c.addChild(new Graphics().rect(b.x, b.y, b.w, b.h).fill(0));
  root.addChild(c);
  return c;
}

describe('the guide line', () => {
  it('measures what two boxes share', () => {
    expect(overlap(box(0, 0, 100, 100), box(50, 50, 100, 100))).toBe(2500);
    expect(overlap(box(0, 0, 100, 100), box(100, 0, 50, 50))).toBe(0);
  });

  it('takes the first of the cheapest', () => {
    expect(cheapest([3, 1, 1, 2], (n) => n)).toBe(1);
    expect(cheapest(['a', 'b'], () => 0)).toBe('a');
  });

  it('counts the kept-clear buttons over the rest, a touched button twice whole, and the hands over all', () => {
    const root = new Container();
    const target = button(root, 'go', box(0, 0, 50, 50));
    button(root, 'other', box(100, 0, 100, 100));
    button(root, 'start', box(300, 0, 100, 100));
    const obs = obstacles(root, target, FIT);
    expect(obs.map((o) => o.weight)).toEqual([1, 10]);
    const b = box(100, 0, 300, 100);
    expect(cost(b, obs, [])).toBe(20000 + 200000);
    expect(cost(b, obs, [box(100, 0, 10, 10)])).toBe(220000 + 100000);
    // a corner of a button counts all of it; a big card only what is covered
    expect(cost(box(190, 90, 20, 20), obs, [])).toBe(20000);
    expect(cost(box(0, 0, 100, 100), [{ box: box(0, 0, 400, 400), weight: 1 }], [])).toBe(10000);
  });

  it("leaves out what a panel's shade covers, and the button that holds the target", () => {
    const root = new Container();
    button(root, 'under', box(0, 0, 200, 200));
    button(root, 'shade', box(0, 0, FIT.w, FIT.h));
    const holder = button(root, 'holder', box(400, 400, 300, 300));
    const target = button(holder, 'go', box(450, 450, 50, 50));
    button(root, 'panel_close', box(800, 100, 90, 90));
    const obs = obstacles(root, target, FIT);
    expect(obs).toHaveLength(1);
    expect(obs[0].weight).toBe(10);
  });

  it('never puts the line on the pointed button or the hand, and keeps the close clear', () => {
    const r = box(440, 1000, 200, 120);
    const hand = box(480, 1120, 140, 200);
    const close = box(460, 820, 160, 160);
    const obs: Obstacle[] = [{ box: close, weight: 10 }];
    const [cw, ch] = [820, 160];
    const p = placeCard(r, { x: 540, y: 1000 }, cw, ch, FIT, obs, [hand]);
    const b = inside(p, cw, ch);
    expect(overlap(b, r)).toBe(0);
    expect(overlap(b, hand)).toBe(0);
    expect(overlap(b, close)).toBe(0);
    // and stays on the page
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y + b.h).toBeLessThanOrEqual(FIT.h);
  });

  it('on a wide page can stand the line beside the button', () => {
    const wide = { scale: 1, w: 1920, h: 1080, wide: true };
    const r = box(800, 0, 300, 1080);
    const p = placeCard(r, { x: 950, y: 540 }, 600, 160, wide, [], []);
    expect(overlap(inside(p, 600, 160), r)).toBe(0);
  });
});
