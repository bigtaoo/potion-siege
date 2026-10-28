// The overflow finder itself (check.ts), on hand-built scenes: layout.test.ts only ever sees
// screens where everything fits.
import './measure';
import { Container, Graphics, Text, type TextOptions } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { overflows } from './check';

const PAGE = { x: 0, y: 0, width: 1000, height: 1000 };

class Btn extends Container {}

function words(s: string, x: number, y: number, o: Partial<TextOptions> = {}): Text {
  const t = new Text({ text: s, style: { fontSize: 40, fontFamily: 'Arial' }, ...o });
  t.position.set(x, y);
  return t;
}

const box = (x: number, y: number, w: number, h: number) => new Graphics().rect(x, y, w, h).fill(0x333333);

describe('overflows', () => {
  it('finds words wider than their plate, on the worst side', () => {
    const root = new Container();
    root.addChild(box(100, 100, 200, 60), words('a long line of words', 100, 105));
    const found = overflows(root, PAGE);
    expect(found).toHaveLength(1);
    expect(found[0].side).toBe('right');
    expect(found[0].by).toBeGreaterThan(100);
  });

  it('keeps the worst of two sides', () => {
    const root = new Container();
    // sticks out a little on the left, a lot on the right
    root.addChild(box(100, 100, 200, 60), words('a long line of words', 85, 105));
    expect(overflows(root, PAGE).map((o) => o.side)).toEqual(['right']);
  });

  it('skips hidden plates, and words that are not rendered', () => {
    const root = new Container();
    const hidden = box(100, 100, 60, 60);
    hidden.visible = false;
    const ghost = words('not drawn at all', 900, 900);
    ghost.renderable = false;
    root.addChild(hidden, words('fits the page', 90, 105), ghost);
    expect(overflows(root, PAGE)).toEqual([]);
  });

  it('counts a stroke-less Text with no pad for the stroke', () => {
    const root = new Container();
    const t = words('edge', 0, 0);
    (t.style as unknown as { _stroke: unknown })._stroke = undefined;
    root.addChild(t);
    expect(overflows(root, PAGE)).toEqual([]);
  });

  it('counts only what a mask lets through, and nothing a mask hides', () => {
    const root = new Container();
    const list = new Container();
    const mask = box(0, 0, 1000, 120);
    list.mask = mask;
    root.addChild(mask, list);
    // half in the window: the visible half fits the page
    list.addChild(words('half shown', 10, 90));
    // beside the window: wide enough to share its x, but all below it
    list.addChild(words('scrolled out of the window', 10, 600));
    expect(overflows(root, PAGE)).toEqual([]);
    // a row in the window is checked like any other: these words stick out of their plate
    const row = new Container();
    row.addChild(box(0, 0, 300, 60), words('a long line of words', 10, 5));
    list.addChild(row);
    expect(overflows(root, PAGE).map((o) => [o.text, o.side])).toEqual([['a long line of words', 'right']]);
  });

  it('flags words that run into a button on the same plate, not their own', () => {
    const root = new Container();
    const btn = new Btn();
    btn.addChild(box(300, 100, 200, 60), words('own', 320, 105));
    root.addChild(box(0, 0, 1000, 400), words('runs into it', 220, 105), btn);
    const found = overflows(root, PAGE, [Btn]);
    expect(found.map((o) => [o.text, o.side])).toEqual([['runs into it', 'button']]);
  });
});
