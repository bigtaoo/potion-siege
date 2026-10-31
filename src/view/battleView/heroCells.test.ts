import { Container, Graphics } from 'pixi.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Battle, slotCenter } from '../../sim/battle';
import { TICK_RATE } from '../../sim/math/fixed';
import { battleSetup, newMeta } from '../../sim/meta';
import type { Hero } from '../../sim/types';
import { SpriteLayer } from '../art';
import { fakeArt } from '../fakeArt';
import { turnView } from '../landView';
import { PotionLayer } from '../potion';
import { FxLayer } from './fxLayer';
import { FLIGHT, HeroCells, LANDING, aimAt, arc, landing } from './heroCells';
import { MergeAnims } from './merges';

function cells() {
  const heroes = new HeroCells(new MergeAnims(new FxLayer()));
  const b = new Battle(1, battleSetup(newMeta(), 1));
  const slot = b.freeSlots()[0];
  const layers = { g: new Graphics(), ho: new Graphics(), art: new SpriteLayer(), potions: new PotionLayer() };
  const put = (o: Partial<Hero> = {}) => (b.slots[o.slot ?? slot] = { id: 7, kind: 'fire', star: 1, slot, cooldown: 0, ...o });
  const draw = (now: number, bt = now, foes = true) => {
    layers.art.begin();
    layers.potions.begin();
    heroes.draw(b, layers.g.clear(), layers.ho.clear(), layers.art, layers.potions, now, bt, null, null, foes);
    layers.art.end();
    layers.potions.end();
    // the figures are reused: what they show now
    return layers.potions.children.filter((p) => p.visible).map((p) => ({ sx: p.scale.x, rot: p.rotation }));
  };
  return { heroes, b, slot, layers, put, draw };
}

afterEach(() => turnView(new Container(), false));

describe('the helpers', () => {
  it('leans all the way at a target far enough to the side', () => {
    expect(aimAt(200)).toBe(0.5);
    expect(aimAt(-1000)).toBe(-1);
    expect(aimAt(1000)).toBe(1);
  });

  it('lands squashed and springs back to nothing', () => {
    expect(landing(-0.1)).toBe(0);
    expect(landing(0)).toBeCloseTo(0.3);
    expect(landing(LANDING)).toBe(0);
    expect(Math.abs(landing(LANDING * 0.9))).toBeLessThan(0.01);
  });

  it('flies in an arc over the straight line', () => {
    expect(arc(0, 0, 100, 200, 0)).toEqual({ x: 0, y: 0 });
    expect(arc(0, 0, 100, 200, 1).x).toBeCloseTo(100);
    expect(arc(0, 0, 100, 200, 0.5)).toEqual({ x: 50, y: 100 - 160 });
  });
});

describe('HeroCells', () => {
  beforeAll(fakeArt);

  it('knows no throw from a cell it has not drawn', () => {
    const { heroes, slot } = cells();
    expect(heroes.shot(slot, 1, 0, 0)).toBeNull();
  });

  it('turns the next thrower toward its target and keeps when it threw', () => {
    const { heroes, slot, put, draw } = cells();
    put();
    draw(1);
    const c = slotCenter(slot);
    const a = heroes.shot(slot, 2, c.x + 200, c.y - 500);
    expect(a).toMatchObject({ shots: 1, lastShot: 2, aim: 0.5 });
    turnView(new Container(), true);
    expect(heroes.shot(slot, 3, c.x, c.y + 400)?.aim).toBe(-1);
  });

  it('winds a hero up just before it throws, but not with nothing to throw at or while dazed', () => {
    const { put, draw } = cells();
    const near = TICK_RATE * 1000 * 0.1;
    put({ cooldown: near });
    // past its pop in
    draw(0);
    const [wound] = draw(5);
    put({ cooldown: TICK_RATE * 1000 });
    const [idle] = draw(5);
    expect(wound.sx).not.toBeCloseTo(idle.sx);
    put({ cooldown: near });
    expect(draw(5, 5, false)[0].sx).toBeCloseTo(idle.sx);
    put({ cooldown: near, stunTime: 10 });
    expect(draw(5)[0].sx).toBeCloseTo(idle.sx);
  });

  it('sways a dazed hero and stars it', () => {
    const { put, draw, layers } = cells();
    put({ stunTime: 10 });
    const [p] = draw(1, 0.3);
    expect(layers.ho.bounds.width).toBeGreaterThan(0);
    put();
    const [q] = draw(1, 0.3);
    expect(p.rot).not.toBeCloseTo(q.rot);
  });

  it('flies a summoned hero in from the flask and pops it in once it lands', () => {
    const { heroes, slot, put, draw } = cells();
    heroes.summoned(slot, 1);
    put();
    // the flying one only: the one in the cell waits for it
    const mid = draw(1 + FLIGHT / 2);
    expect(mid.length).toBe(1);
    expect(mid[0].sx).toBeLessThan(1);
    expect(draw(1 + FLIGHT + 0.01).length).toBe(1);
    expect(draw(1 + FLIGHT + 1).length).toBe(1);
  });

  it('forgets a flight whose hero is gone', () => {
    const { heroes, slot, draw } = cells();
    heroes.summoned(slot, 1);
    expect(draw(1.1).length).toBe(0);
    heroes.clear();
  });

  it('lands a moved hero squashed in its new cell instead of popping it in', () => {
    const { heroes, b, slot, put, draw } = cells();
    const to = b.freeSlots()[1];
    put();
    draw(1);
    b.slots[slot] = null;
    put({ slot: to });
    heroes.moved(7, 2);
    const [landed] = draw(2);
    put({ slot: to, id: 8 });
    const [popped] = draw(2);
    expect(landed.sx).toBeGreaterThan(popped.sx);
  });

  it('leans and stretches a held hero the way it is dragged, from rest once dropped', () => {
    const { heroes } = cells();
    heroes.drop({ x: 0, y: 0 });
    const a = heroes.held({ x: 100, y: 0 }, 1 / 60);
    expect(a.spin).toBeGreaterThan(0);
    expect(a.squash).toBeLessThan(0);
    expect(heroes.held({ x: 100, y: 0 }, 0).spin).toBe(a.spin);
    heroes.drop({ x: 0, y: 0 });
    expect(heroes.held({ x: 0, y: 0 }, 1 / 60)).toMatchObject({ spin: 0, squash: -0 });
    turnView(new Container(), true);
    expect(heroes.held({ x: 0, y: -100 }, 1 / 60).spin).toBeGreaterThan(0);
  });
});
