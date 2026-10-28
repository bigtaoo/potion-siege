import '../layout/measure';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import * as icons from './icons';
import { fillColors, picture } from './kitTestBits';
import { P } from './palette';

const art = vi.hoisted(() => ({ tex: undefined as Texture | undefined }));
vi.mock('../art', async (orig) => ({ ...(await orig<typeof import('../art')>()), ultimateTexture: () => art.tex, enemyTexture: () => art.tex }));

afterEach(() => {
  art.tex = undefined;
});

const across = (c: Container) => {
  const b = c.getLocalBounds();
  return Math.max(b.maxX - b.minX, b.maxY - b.minY);
};

describe('bottle', () => {
  it('draws the stand-in flask, with a face, until the art is in', () => {
    const c = icons.bottle('fire', 200);
    expect(c.children[0]).toBeInstanceOf(Graphics);
    expect(across(c)).toBeGreaterThan(150);
    expect(across(c)).toBeLessThan(210);
  });

  it('shows the ultimate bottle art at its height once loaded', () => {
    art.tex = picture(400, 800);
    const s = icons.bottle('fire', 200).children[0] as Sprite;
    expect(s).toBeInstanceOf(Sprite);
    expect(s.scale.x).toBeCloseTo(0.25);
    expect(s.anchor.x).toBe(0.5);
  });
});

describe('flask', () => {
  it('fills its belly with the colour and gives a living potion eyes', () => {
    const plain = fillColors(icons.flask(new Graphics(), 0, 100, 100, 0x123456));
    const face = fillColors(icons.flask(new Graphics(), 0, 100, 100, 0x123456, true));
    expect(plain).toContain(0x123456);
    expect(face.length - plain.length).toBe(4);
    expect(face.filter((c) => c === P.line)).toHaveLength(2);
  });
});

describe('enemySprite', () => {
  it('is empty until the art is in', () => {
    expect(icons.enemySprite('grunt', 100).children).toHaveLength(0);
  });

  it('fits the art inside its box, centred', () => {
    art.tex = picture(200, 100);
    const s = icons.enemySprite('grunt', 100, 100).children[0] as Sprite;
    expect(s.scale.x).toBeCloseTo(0.5);
    art.tex = picture(100, 400);
    expect((icons.enemySprite('grunt', 100).children[0] as Sprite).scale.x).toBeCloseTo(0.25);
  });
});

describe('the small pictures', () => {
  it('sizes the boss tag round its word, never under four of its height', () => {
    const tag = icons.bossTag(30);
    const bg = tag.children[0] as Graphics;
    expect(fillColors(bg)).toEqual([P.red]);
    expect(bg.getLocalBounds().maxX - bg.getLocalBounds().minX).toBeGreaterThanOrEqual(30 * 4.1);
  });

  it('draws the padlock in the colours asked', () => {
    expect(fillColors(icons.lock())).toEqual([P.inkSoft, P.paper, P.paper]);
    expect(fillColors(icons.lock(0x111111, 0x222222))).toEqual([0x111111, 0x222222, 0x222222]);
  });

  it('draws each icon about 100 across, centred', () => {
    const all: Container[] = [
      icons.gearIcon(),
      icons.bookIcon(),
      icons.chestIcon(),
      icons.swordsIcon(),
      icons.swordIcon(),
      icons.stopwatchIcon(),
      icons.infinityIcon(),
      icons.wallIcon(),
      icons.coinsIcon(),
      icons.calendarIcon(),
      icons.scrollIcon(),
    ];
    for (const c of all) {
      expect(across(c)).toBeGreaterThan(60);
      expect(across(c)).toBeLessThan(170);
    }
  });

  it('crosses two swords, and turns the lone one', () => {
    const two = icons.swordsIcon();
    expect(two.children.map((c) => c.rotation)).toEqual([-Math.PI / 4, Math.PI / 4]);
    expect(icons.swordIcon().rotation).toBe(Math.PI / 4);
  });

  it('colours the gear as asked', () => {
    expect(fillColors(icons.gearIcon(46, 0xabcdef))[0]).toBe(0xabcdef);
  });
});
