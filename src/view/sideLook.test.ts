import { describe, expect, it } from 'vitest';
import type { Graphics, Text } from 'pixi.js';
import { sideBackdrop, sideHead, sidePanel, sideTile } from './sideLook';

describe('the boards beside a battle on a wide screen', () => {
  it('lays the wall over the whole screen', () => {
    const wall = sideBackdrop(1920, 1080, 420);
    expect(wall.children.length).toBe(2);
    const b = (wall.children[1] as Graphics).bounds;
    expect([b.minX, b.minY, b.width, b.height]).toEqual([0, 0, 1920, 1080]);
  });

  it('centres a board and a row on their positions, the board\'s shadow below it', () => {
    const panel = sidePanel(300, 400).bounds;
    expect([panel.minX, panel.minY, panel.maxX]).toEqual([-151.5, -201.5, 151.5]);
    expect(panel.maxY).toBeGreaterThan(200);
    const tile = sideTile(200, 60).bounds;
    expect([tile.minX, tile.minY, tile.width, tile.height]).toEqual([-101.5, -31.5, 203, 63]);
  });

  it('hangs a heading just inside the board\'s top edge', () => {
    const head = sideHead('Waves');
    const text = head.children[0] as Text;
    expect([text.text, text.y]).toEqual(['Waves', 22]);
  });
});
