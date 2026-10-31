import { Container, Texture, type Sprite } from 'pixi.js';
import { afterEach, describe, expect, it } from 'vitest';
import { SpriteLayer } from '../art';
import { turnView } from '../landView';
import { BOSS_WRECK_TIME, MAX_WRECKS, WRECK_TIME, Wrecks, flashOver, type Snapshot } from './wrecks';

const SNAP: Snapshot = { tex: Texture.WHITE, x: 100, y: 200, sx: 2, sy: 3, rot: 0.1, tint: 0xffb27a };

function wrecks() {
  const w = new Wrecks();
  const art = new SpriteLayer();
  const flash = new SpriteLayer();
  const draw = (now: number, soft = false) => {
    art.begin();
    flash.begin();
    w.draw(art, flash, now, soft);
    art.end();
    flash.end();
    const vis = (c: Container) => c.children.filter((s) => s.visible) as Sprite[];
    return { art: vis(art), flash: vis(flash) };
  };
  return { w, draw };
}

afterEach(() => turnView(new Container(), false));

describe('flashOver', () => {
  it('puts an added copy of the sprite over it', () => {
    const flash = new SpriteLayer();
    flash.begin();
    flashOver(flash, SNAP, 0.4);
    const f = flash.children[0] as Sprite;
    expect([f.x, f.y, f.scale.x, f.scale.y, f.rotation, f.alpha]).toEqual([100, 200, 2, 3, 0.1, 0.4]);
    expect(f.blendMode).toBe('add');
  });
});

describe('Wrecks', () => {
  it('lights a wreck up at first, then tips it over, squashes and fades it out', () => {
    const { w, draw } = wrecks();
    w.add(SNAP, 0, false);
    let d = draw(0);
    expect(d.art.length).toBe(1);
    expect(d.flash.length).toBe(1);
    expect(d.art[0].rotation).toBeCloseTo(0.1);
    expect(d.art[0].tint).toBe(0xffb27a);
    d = draw(WRECK_TIME * 0.5);
    expect(d.flash.length).toBe(0);
    expect(d.art[0].rotation).toBeGreaterThan(0.1);
    expect(d.art[0].scale.y).toBeLessThan(3);
    expect(d.art[0].alpha).toBeCloseTo(0.75);
    expect(d.art[0].y).toBeGreaterThan(200);
    expect(draw(WRECK_TIME).art.length).toBe(0);
    expect(w.count).toBe(0);
  });

  it('tips each the way its place gives it', () => {
    const { w, draw } = wrecks();
    w.add({ ...SNAP, x: 100.5 }, 0, false);
    w.add({ ...SNAP, x: 101.5 }, 0, false);
    const [a, b] = draw(WRECK_TIME * 0.5).art;
    expect(a.rotation - 0.1).toBeCloseTo(-(b.rotation - 0.1));
  });

  it('shudders a boss upright a while, lit, before it comes down', () => {
    const { w, draw } = wrecks();
    w.add(SNAP, 0, true);
    const d = draw(BOSS_WRECK_TIME * 0.3);
    expect(d.flash.length).toBe(1);
    expect(d.art[0].rotation).toBeCloseTo(0.1);
    expect(d.art[0].x).not.toBe(100);
    expect(draw(BOSS_WRECK_TIME * 0.9).art[0].rotation).toBeGreaterThan(0.1);
    expect(draw(BOSS_WRECK_TIME).art.length).toBe(0);
  });

  it('keeps wrecks half as long and still with reduced motion', () => {
    const { w, draw } = wrecks();
    w.add(SNAP, 0, true);
    w.add(SNAP, 0, false);
    const d = draw(0.1, true);
    expect(d.art[0].x).toBe(100);
    expect(d.art[1].rotation).toBe(0.1);
    expect(draw(BOSS_WRECK_TIME * 0.5, true).art.length).toBe(0);
  });

  it('keeps no more than so many at once, and none from before now', () => {
    const { w, draw } = wrecks();
    for (let i = 0; i < MAX_WRECKS + 5; i++) w.add(SNAP, 0, false);
    expect(w.count).toBe(MAX_WRECKS);
    expect(draw(-1).art.length).toBe(0);
    w.add(SNAP, 0, false);
    w.clear();
    expect(w.count).toBe(0);
  });

  it('sinks it across the screen on a field lying on its side', () => {
    turnView(new Container(), true);
    const { w, draw } = wrecks();
    w.add(SNAP, 0, false);
    const s = draw(WRECK_TIME * 0.5).art[0];
    expect(s.y).toBe(200);
    expect(s.x).not.toBe(100);
  });
});
