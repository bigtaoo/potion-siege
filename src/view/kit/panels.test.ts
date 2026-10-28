import '../layout/measure';
import { describe, expect, it } from 'vitest';
import { Graphics, Text } from 'pixi.js';
import { inset, lightPanel, lightTile, medal, paperCard, plate, woodPanel, workshopWall } from './panels';
import { LIGHT, P } from './palette';
import { fillColors } from './kitTestBits';

const size = (g: Graphics) => {
  const b = g.getLocalBounds();
  return { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };
};

describe('workshop surfaces', () => {
  it('panels the wall in planks of two shades with a seam each', () => {
    const g = workshopWall(600, 400);
    expect(fillColors(g)[0]).toBe(LIGHT.wall);
    const fills = fillColors(g);
    expect(fills.filter((c) => c === LIGHT.wallAlt)).toHaveLength(2);
    expect(fills.filter((c) => c === LIGHT.wallSeam)).toHaveLength(4);
  });

  it('frames a walnut board in brass, a seam down it every 110 px', () => {
    const short = fillColors(woodPanel(500, 300));
    const tall = fillColors(woodPanel(500, 900));
    expect(short).toContain(P.wood);
    expect(short).toContain(P.brass);
    const seams = (f: number[]) => f.filter((c) => c === P.woodDark).length;
    expect(seams(tall) - seams(short)).toBeGreaterThan(4);
    expect(short.filter((c) => c === P.brassLight)).toHaveLength(5); // the band and four rivets
  });

  it('centres the boards on their position, the shadow under them', () => {
    for (const g of [woodPanel(500, 300), lightPanel(500, 300)]) {
      const s = size(g);
      expect(s.x).toBeLessThanOrEqual(-250);
      expect(s.y).toBeLessThanOrEqual(-150);
      expect(s.w).toBeGreaterThanOrEqual(500);
      expect(s.h).toBeGreaterThanOrEqual(312);
    }
    expect(fillColors(lightPanel(500, 300))).toContain(LIGHT.face);
  });

  it('sinks an inset from its top, centred across', () => {
    const top = size(inset(400, 100, 30));
    expect(top.x).toBeLessThanOrEqual(-200);
    expect(top.y).toBeLessThanOrEqual(30);
    expect(top.y).toBeGreaterThan(20);
    expect(size(inset(400, 100)).y).toBeLessThanOrEqual(-50);
    expect(fillColors(inset(400, 100))).toEqual([LIGHT.inset]);
  });

  it('gives tiles and cards a darker lip along the bottom', () => {
    expect(fillColors(lightTile(200, 100))).toEqual([P.line, LIGHT.tileLip, LIGHT.tile]);
    expect(fillColors(paperCard(200, 100))).toEqual([P.line, LIGHT.cardLip, LIGHT.card]);
    expect(size(paperCard(200, 100)).h).toBeGreaterThanOrEqual(108);
  });
});

describe('plate', () => {
  it('is at least its least width, and grows round a longer name', () => {
    const short = plate('Hi', 56, 360);
    const long = plate('A rather long chapter name', 56, 360);
    const width = (c: ReturnType<typeof plate>) => size(c.children[0] as Graphics).w - 88 - 5; // the tails and the outline
    expect(width(short)).toBeCloseTo(360, 0);
    expect(width(long)).toBeGreaterThan(360);
    expect((long.children[1] as Text).y).toBe(-3);
  });

  it('shrinks the name to stay inside its widest', () => {
    const c = plate('A rather long chapter name to shrink', 56, 200, 'brass', 400);
    expect((c.children[1] as Text).width).toBeLessThanOrEqual(280 + 0.01);
    expect(size(c.children[0] as Graphics).w - 88 - 5).toBeLessThanOrEqual(400 + 0.01);
  });

  it('comes in red', () => {
    expect(fillColors(plate('Boss', 56, 360, 'red').children[0] as Graphics)).toContain(0xc9463d);
    expect(fillColors(plate('Boss').children[0] as Graphics)).toContain(P.brass);
  });
});

describe('medal', () => {
  it('rings its face in brass, walnut unless told', () => {
    expect(fillColors(medal(40)).pop()).toBe(P.wood);
    expect(fillColors(medal(40, P.red)).pop()).toBe(P.red);
    expect(size(medal(40)).w).toBeGreaterThanOrEqual(80);
  });
});
