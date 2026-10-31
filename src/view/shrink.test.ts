import { describe, expect, it } from 'vitest';
import { Texture } from 'pixi.js';
import { halvingsFor, shrunk } from './shrink';

describe('shrunk copies', () => {
  it('halve a big picture down to just over 1.5 px a unit of the size drawn', () => {
    // a 416 px bottle on a 28-unit chip: 208, 104, 52 (52 >= 42, 26 is not)
    expect(halvingsFor(416, 28)).toBe(3);
    expect(halvingsFor(416, 84)).toBe(1);
    // a card's 220-unit bottle keeps the full picture
    expect(halvingsFor(416, 220)).toBe(0);
  });

  it('keep the picture itself when it is drawn big, or is nothing a canvas can draw', () => {
    const tex = Texture.WHITE;
    expect(shrunk(tex, 1000)).toBe(tex);
    expect(shrunk(tex, 1)).toBe(tex);
  });
});
