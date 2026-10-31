import './layout/measure';
import { Text } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { HudPlates } from './hudPlates';

function text(words: string, x: number, y: number, ax = 0): Text {
  const t = new Text({ text: words, style: { fontSize: 40 } });
  t.anchor.set(ax, 0.5);
  t.position.set(x, y);
  return t;
}

describe('HudPlates', () => {
  it('puts a capsule behind each shown text and around the coin', () => {
    const p = new HudPlates();
    const wave = text('Wave 3/10', 540, 60, 0.5);
    const gold = text('120', 120, 60);
    p.fit([{ text: wave }, { text: gold, coin: { x: 90, y: 60, r: 26 } }]);
    const b = p.getLocalBounds();
    expect(b.minX).toBeLessThan(90 - 26);
    expect(b.maxX).toBeGreaterThan(wave.x + wave.width / 2);
    expect(b.minY).toBeLessThan(60 - 26);
  });

  it('skips hidden and empty texts and redraws only on a change', () => {
    const p = new HudPlates();
    const a = text('', 100, 60);
    const h = text('Stage 4', 300, 60);
    h.visible = false;
    p.fit([{ text: a }, { text: h }]);
    expect(p.getLocalBounds().width).toBe(0);
    h.visible = true;
    p.fit([{ text: a }, { text: h }]);
    const first = p.getLocalBounds().width;
    expect(first).toBeGreaterThan(0);
    const clear = p.clear.bind(p);
    let cleared = 0;
    p.clear = () => (cleared++, clear());
    p.fit([{ text: a }, { text: h }]);
    expect(cleared).toBe(0);
    h.text = 'Stage 45';
    p.fit([{ text: a }, { text: h }]);
    expect(cleared).toBe(1);
  });
});
