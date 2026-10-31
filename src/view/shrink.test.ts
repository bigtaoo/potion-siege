import { afterEach, describe, expect, it, vi } from 'vitest';
import { Container, Texture, TextureSource, Rectangle, type Renderer } from 'pixi.js';
import { copyAt, halvingsFor, sharp } from './shrink';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('halvingsFor', () => {
  it('halves a picture as long as it stays at least as big as it lands on screen', () => {
    // a 416 px bottle landing 66 px tall: 208, 104 (104 >= 66, 52 is not)
    expect(halvingsFor(416, 66)).toBe(2);
    expect(halvingsFor(416, 208)).toBe(1);
    expect(halvingsFor(416, 300)).toBe(0);
    expect(halvingsFor(416, 0)).toBe(0);
  });
});

/** Stands in for a browser's image and canvas, so a copy can be made under node. */
class FakeImage {}
function fakeCanvas() {
  vi.stubGlobal('HTMLImageElement', FakeImage);
  const drawn: number[] = [];
  vi.stubGlobal('document', {
    createElement: () => {
      const c = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => drawn.push(c.width) }),
      };
      return c;
    },
  });
  const made: { width: number; height: number }[] = [];
  vi.spyOn(Texture, 'from').mockImplementation((c) => {
    const canvas = c as unknown as { width: number; height: number };
    made.push(canvas);
    return new Texture({ source: new TextureSource({ width: canvas.width, height: canvas.height }) });
  });
  return { drawn, made };
}

function picture(w: number, h: number, frame = { width: w, height: h }): Texture {
  const source = new TextureSource({ width: w, height: h });
  source.resource = new FakeImage();
  return new Texture({ source, frame: new Rectangle(0, 0, frame.width, frame.height) });
}

describe('copyAt', () => {
  it('halves a step at a time and makes each level once', () => {
    const { drawn } = fakeCanvas();
    const full = picture(416, 400);
    const copy = copyAt(full, 2);
    expect(copy.width).toBe(104);
    expect(drawn).toEqual([208, 104]);
    expect(copyAt(full, 2)).toBe(copy);
    expect(drawn).toHaveLength(2);
    expect(copyAt(full, 0)).toBe(full);
  });

  it('keeps a frame of a sheet, or what a canvas cannot copy, as it is', () => {
    fakeCanvas();
    expect(copyAt(picture(416, 400, { width: 100, height: 100 }), 2).width).toBe(100);
    expect(copyAt(Texture.WHITE, 2)).toBe(Texture.WHITE);
  });
});

describe('sharp', () => {
  const draw = (s: Container, res: number) => s.onRender?.({ resolution: res } as Renderer);

  it('draws from the copy that fits the size on screen, keeping its size in the menu', () => {
    fakeCanvas();
    const full = picture(416, 400);
    const parent = new Container();
    const s = sharp(full, 150);
    parent.addChild(s);
    expect(s.texture).toBe(full);
    // 150 units at 0.3 units a px on a 1.5x screen land 67.5 px tall
    parent.scale.set(0.3);
    draw(s, 1.5);
    expect(s.texture.width).toBe(104);
    expect(s.width).toBeCloseTo(150, 5);
    // made bigger, it goes back to the full picture
    parent.scale.set(1);
    draw(s, 2);
    expect(s.texture).toBe(full);
    expect(s.width).toBeCloseTo(150, 5);
  });

  it('waits for a parent before choosing', () => {
    const full = picture(416, 400);
    const s = sharp(full, 20);
    draw(s, 3);
    expect(s.texture).toBe(full);
  });
});
