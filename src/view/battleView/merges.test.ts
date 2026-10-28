import { Graphics } from 'pixi.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Battle, slotCenter } from '../../sim/battle';
import { battleSetup, newMeta } from '../../sim/meta';
import { SpriteLayer } from '../art';
import { fakeArt } from '../fakeArt';
import { PotionLayer } from '../potion';
import { FxLayer } from './fxLayer';
import { MergeAnims } from './merges';

const FLY = 0.15;
const FUSE = 0.3;

function anims() {
  const fx = new FxLayer();
  const push = vi.spyOn(fx, 'push');
  const burst = vi.spyOn(fx, 'burst');
  const m = new MergeAnims(fx);
  const b = new Battle(1, battleSetup(newMeta(), 1));
  const layers = { under: new Graphics(), over: new Graphics(), art: new SpriteLayer(), potions: new PotionLayer() };
  const swirl = (t: number) => {
    layers.potions.begin();
    m.swirls(layers.under.clear(), layers.over.clear(), layers.art, layers.potions, b, t);
    layers.potions.end();
  };
  const dive = (t: number) => {
    layers.potions.begin();
    m.dives(layers.over.clear(), layers.art, layers.potions, t);
    layers.potions.end();
  };
  return { fx, push, burst, m, b, ...layers, swirl, dive };
}

const drawn = (g: Graphics) => g.bounds.width > 0;

describe('a merge as the battle plays it', () => {
  it('holds the result back in its slot until the two have fused', () => {
    const { m } = anims();
    m.drop(3, 4, 'fire', 1, { x: 300, y: 1200 }, 10);
    expect(m.fusing(4)).toBe(true);
    expect(m.fusing(3)).toBe(false);
    expect(m.bornAt(4, 10.1)).toBeCloseTo(10 + FUSE);
    expect(m.bornAt(5, 10.1)).toBe(10.1);
    m.clear();
    expect(m.fusing(4)).toBe(false);
  });

  it('drops a merge still fusing in a slot the player drags from or drops onto again', () => {
    const { m } = anims();
    m.drop(0, 1, 'fire', 1, { x: 0, y: 0 }, 0);
    m.drop(2, 3, 'ice', 1, { x: 0, y: 0 }, 0);
    m.drop(1, 5, 'fire', 2, { x: 0, y: 0 }, 0.1);
    m.drop(6, 3, 'ice', 1, { x: 0, y: 0 }, 0.1);
    expect([1, 3, 5].map((s) => m.fusing(s))).toEqual([false, true, true]);
    expect(m.bornAt(3, 0)).toBeCloseTo(0.1 + FUSE);
  });

  it('ripples once as the dive lands, then flashes and splashes once it has fused', () => {
    const { m, push, burst, swirl } = anims();
    m.drop(0, 1, 'fire', 1, { x: 200, y: 1300 }, 0);
    swirl(0.05);
    expect(push).not.toHaveBeenCalled();
    swirl(FLY + 0.01);
    swirl(FLY + 0.05);
    expect(push).toHaveBeenCalledTimes(1);
    swirl(FUSE);
    // the flash and the splash, and the burst under them
    expect(push).toHaveBeenCalledTimes(3);
    expect(burst).toHaveBeenCalledTimes(1);
    expect(m.fusing(1)).toBe(false);
    swirl(FUSE + 1);
    expect(push).toHaveBeenCalledTimes(3);
  });

  it('lets the effects it leaves run out', () => {
    const { m, fx, swirl } = anims();
    m.drop(0, 1, 'ice', 2, { x: 200, y: 1300 }, 0);
    swirl(FLY + 0.01);
    swirl(FUSE);
    fx.update(0.01);
    expect(drawn(fx.top)).toBe(true);
    fx.update(1);
    expect(drawn(fx.top)).toBe(false);
  });

  it('flashes a merge it did not see dropped, with no battle to colour it', () => {
    const { m, push, burst } = anims();
    m.fused(null, 7);
    expect(push).toHaveBeenCalledTimes(2);
    const c = slotCenter(7);
    expect(burst).toHaveBeenCalledWith(c.x, c.y, 110, expect.any(Number), 0.35);
  });

  it('draws the dive only while it flies, and the swirl only until it fuses', () => {
    const { m, over, under, dive, swirl } = anims();
    m.drop(0, 1, 'fire', 1, { x: 200, y: 1300 }, 0);
    dive(0.05);
    expect(drawn(over)).toBe(true);
    dive(FLY);
    expect(drawn(over)).toBe(false);
    swirl(0.2);
    expect(drawn(over)).toBe(true);
    swirl(FUSE);
    expect(drawn(over) || drawn(under)).toBe(false);
  });

  describe('with the art', () => {
    beforeAll(fakeArt);

    it('dives the dropped potion in and swirls the one it lands on, a potion each', () => {
      const { m, potions, dive, swirl } = anims();
      m.drop(0, 1, 'fire', 1, { x: 200, y: 1300 }, 0);
      dive(0.05);
      expect(potions.children.filter((c) => c.visible).length).toBe(1);
      swirl(0.2);
      expect(potions.children.filter((c) => c.visible).length).toBe(1);
      swirl(FUSE);
      expect(potions.children.filter((c) => c.visible).length).toBe(0);
    });
  });
});
