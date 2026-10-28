import { Graphics, Sprite } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { INK, PotionLayer, popScale, recoil, snowflake, star, stillPotion, throwingHand, type PotionLook, type PotionPose } from './potion';
import { blankTexture, countColor, drawnColors } from './potionKit';

const LID = 0xa1a1a1;
const LIMB = 0xb2b2b2;
const GLOW: [number, number, number] = [0xc10000, 0x00c200, 0x0000c3];
const LEAF = 0x7fcf4a;

function look(mark: PotionLook['mark'], size?: number): PotionLook {
  return { body: blankTexture(100, 200), eyes: [[0.35, 0.5], [0.65, 0.5]], eyeSize: [0.05, 0.04], lid: LID, limb: LIMB, mark, glow: GLOW, neck: [0.5, 0.1], size };
}

/** Standing still, not blinking, long since its last throw. */
function pose(over: Partial<PotionPose> = {}): PotionPose {
  return { x: 300, feet: 800, height: 100, alpha: 1, dim: false, phase: 0, time: 1, wind: 0, since: 5, pop: 1, ...over };
}

function parts(c: { children: unknown[] }) {
  const [back, body, front] = c.children as [Graphics, Sprite, Graphics];
  return { back, body, front };
}

describe('popScale', () => {
  it('grows from nothing, overshoots and settles at 1', () => {
    expect(popScale(-1)).toBe(0);
    expect(popScale(0)).toBe(0);
    expect(popScale(0.16)).toBeCloseTo(1 + 0.6 ** 4);
    expect(popScale(0.4)).toBe(1);
    expect(popScale(3)).toBe(1);
  });
});

describe('recoil', () => {
  it('is 1 at the release and falls off to 0 by 0.4 s', () => {
    expect(recoil(0)).toBe(1);
    expect(recoil(0.2)).toBeCloseTo(0.25);
    expect(recoil(0.4)).toBe(0);
    expect(recoil(9)).toBe(0);
  });
});

describe('throwingHand', () => {
  it('sits up and to the right of the feet, scaled by the look\'s size', () => {
    const hand = throwingHand(look('flame'), 100);
    expect(hand.x).toBeCloseTo(16.5);
    expect(hand.y).toBeCloseTo(-98);
    const big = throwingHand(look('flame', 2), 100);
    expect(big.x).toBeCloseTo(33);
    expect(big.y).toBeCloseTo(-196);
  });
});

describe('a still potion', () => {
  it('stands on its feet with the body art over two feet and under its face and arms', () => {
    const l = look('flame');
    const p = stillPotion(l, pose({ alpha: 0.6 }));
    const { back, body, front } = parts(p);
    expect(back).toBeInstanceOf(Graphics);
    expect(front).toBeInstanceOf(Graphics);
    expect([p.x, p.y, p.alpha, p.tint]).toEqual([300, 800, 0.6, 0xffffff]);
    expect(body.texture).toBe(l.body);
    expect(body.y).toBeCloseTo(-10);
    expect(body.scale.x).toBeCloseTo(0.5);
    expect(countColor(back, 'fill', LIMB)).toBe(2);
    expect(countColor(back, 'stroke', INK)).toBe(2);
    expect(countColor(front, 'fill', LIMB)).toBe(2);
  });

  it('draws a bigger look taller', () => {
    const { body } = parts(stillPotion(look('flame', 1.5), pose()));
    expect(body.y).toBeCloseTo(-15);
    expect(body.scale.x).toBeCloseTo(0.75);
  });

  it('greys out when dimmed', () => {
    expect(stillPotion(look('flame'), pose({ dim: true })).tint).toBe(0x5a5a5a);
  });

  it('is at rest at time 0: no breath, no sway', () => {
    const p = stillPotion(look('flame'), pose({ time: 0 }));
    expect(p.scale.x).toBeCloseTo(1);
    expect(p.scale.y).toBeCloseTo(1);
    expect(p.rotation).toBeCloseTo(0);
  });

  it('squashes flat or stretches up', () => {
    const flat = stillPotion(look('flame'), pose({ time: 0, squash: 0.2 }));
    expect(flat.scale.x).toBeCloseTo(1.2);
    expect(flat.scale.y).toBeCloseTo(0.8);
    const tall = stillPotion(look('flame'), pose({ time: 0, squash: -0.2 }));
    expect(tall.scale.x).toBeCloseTo(0.8);
    expect(tall.scale.y).toBeCloseTo(1.2);
  });

  it('crouches and leans away while winding up', () => {
    const p = stillPotion(look('flame'), pose({ time: 0, wind: 1 }));
    expect(p.scale.x).toBeCloseTo(1.16);
    expect(p.scale.y).toBeCloseTo(0.8);
    expect(p.rotation).toBeCloseTo(-0.22);
  });

  it('hops, stretches and leans forward at the release', () => {
    const p = stillPotion(look('flame'), pose({ time: 0, since: 0 }));
    expect(p.y).toBeCloseTo(800 - 14);
    expect(p.scale.x).toBeCloseTo(0.92);
    expect(p.scale.y).toBeCloseTo(1.16);
    expect(p.rotation).toBeCloseTo(0.1);
  });

  it('pops in from nothing with a jiggle', () => {
    const none = stillPotion(look('flame'), pose({ time: 0, pop: 0 }));
    expect([none.scale.x, none.scale.y]).toEqual([0, 0]);
    const p = stillPotion(look('flame'), pose({ time: 0, pop: 0.16 }));
    const jiggle = 1 + 0.1 * 0.6 * Math.sin(0.16 * 40);
    expect(p.scale.x).toBeCloseTo(popScale(0.16) * jiggle);
    expect(p.scale.y).toBeCloseTo(popScale(0.16) / jiggle);
  });

  it('holds a fixed tilt plus any spin in place of the sway', () => {
    const p = stillPotion(look('flame'), pose({ time: 0, wind: 1, tilt: 0.5, spin: 0.2 }));
    expect(p.rotation).toBeCloseTo(0.7);
    expect(stillPotion(look('flame'), pose({ spin: 0.3, time: 0 })).rotation).toBeCloseTo(0.3);
  });

  it('blinks now and then, with lids of its liquid, but never when dimmed', () => {
    const { front } = parts(stillPotion(look('flame'), pose({ time: 0 })));
    expect(countColor(front, 'fill', LID)).toBe(2);
    expect(countColor(parts(stillPotion(look('flame'), pose())).front, 'fill', LID)).toBe(0);
    expect(countColor(parts(stillPotion(look('flame'), pose({ time: 0, dim: true }))).front, 'fill', LID)).toBe(0);
  });

  it('holds up a vial once wound up past a quarter', () => {
    expect(drawnColors(parts(stillPotion(look('flame'), pose({ tilt: 0, wind: 0.25 }))).front, 'fill')).toEqual([LIMB, LIMB]);
    expect(drawnColors(parts(stillPotion(look('flame'), pose({ tilt: 0, wind: 0.5 }))).front, 'fill')).toEqual([LIMB, LIMB, GLOW[1], GLOW[2]]);
  });
});

describe('the mark out of its neck', () => {
  const front = (mark: PotionLook['mark'], over: Partial<PotionPose> = {}) => parts(stillPotion(look(mark), pose(over))).front;

  it('goes out while pouring', () => {
    for (const mark of ['flame', 'frost', 'spark', 'star', 'acid', 'wind'] as const) {
      expect(drawnColors(front(mark, { tilt: 0.3 }), 'fill')).toEqual([LIMB, LIMB]);
    }
  });

  it('flame: three nested flames, the outer one outlined, and three embers', () => {
    const f = front('flame');
    expect(countColor(f, 'fill', GLOW[0])).toBe(1);
    expect(countColor(f, 'fill', GLOW[1])).toBe(1);
    expect(countColor(f, 'fill', GLOW[2])).toBe(4);
    expect(drawnColors(f, 'fill').slice(0, 3)).toEqual([GLOW[0], GLOW[1], GLOW[2]]);
  });

  it('frost: four puffs of mist and a snowflake', () => {
    const f = front('frost');
    expect(countColor(f, 'fill', GLOW[1])).toBe(2);
    expect(countColor(f, 'fill', GLOW[2])).toBe(3);
    expect(countColor(f, 'stroke', GLOW[1])).toBe(1);
  });

  it('spark: a bolt with a pale core and up to two arcs that flicker on and off', () => {
    const arcs = new Set<number>();
    for (let time = 0; time < 6; time += 0.05) {
      const f = front('spark', { time });
      expect(countColor(f, 'fill', GLOW[1])).toBe(1);
      expect(countColor(f, 'fill', GLOW[2])).toBe(1);
      arcs.add(countColor(f, 'stroke', GLOW[0]));
    }
    expect([...arcs].sort()).toEqual([0, 1, 2]);
  });

  it('acid: a drip and three bubbles, each either whole or popping into four specks', () => {
    let pops = 0;
    for (let time = 0; time < 6; time += 0.05) {
      const f = front('acid', { time });
      const whole = countColor(f, 'fill', GLOW[1]) - 1;
      const specks = countColor(f, 'fill', GLOW[0]);
      expect(specks % 4).toBe(0);
      expect(whole + specks / 4).toBe(3);
      expect(countColor(f, 'fill', GLOW[2])).toBe(whole);
      pops += specks / 4;
    }
    expect(pops).toBeGreaterThan(0);
  });

  it('wind: three broken rings and a leaf riding round them', () => {
    const f = front('wind', { wind: 0.2, since: 0.1 });
    expect(countColor(f, 'stroke', GLOW[1])).toBe(2);
    expect(countColor(f, 'stroke', GLOW[2])).toBe(1);
    expect(countColor(f, 'fill', LEAF)).toBe(1);
  });

  it('star: three stars circling, each with a pale core', () => {
    const f = front('star');
    expect(countColor(f, 'fill', GLOW[1])).toBe(3);
    expect(countColor(f, 'fill', GLOW[2])).toBe(3);
  });

  it('flares up higher on a throw', () => {
    for (const mark of ['frost', 'spark', 'star', 'wind'] as const) {
      const calm = front(mark).context.bounds;
      const hot = front(mark, { since: 0 }).context.bounds;
      expect(hot.minY, mark).toBeLessThan(calm.minY);
    }
    // the embers drift above the flame itself: measure the outer flame alone
    const outer = (over: Partial<PotionPose>) => (front('flame', over).context.instructions[0].data as { path: { bounds: { minY: number } } }).path.bounds.minY;
    expect(outer({ since: 0 })).toBeLessThan(outer({}) - 10);
  });
});

describe('star and snowflake', () => {
  it('draws a star outlined in ink with a pale core, `size` to its tips', () => {
    const g = new Graphics();
    star(g, 50, 60, 20, 0, GLOW, 2);
    expect(drawnColors(g, 'fill')).toEqual([GLOW[1], GLOW[2]]);
    expect(drawnColors(g, 'stroke')).toEqual([INK]);
    expect(g.context.bounds.minY).toBeCloseTo(60 - 20 - 1, 0);
  });

  it('draws a snowflake inked under its glow, with a core', () => {
    const g = new Graphics();
    snowflake(g, 0, 0, 30, 0, GLOW, 2);
    expect(drawnColors(g, 'stroke')).toEqual([INK, GLOW[1], INK]);
    expect(drawnColors(g, 'fill')).toEqual([GLOW[2]]);
    expect(g.context.bounds.maxX).toBeGreaterThanOrEqual(30);
  });
});

describe('PotionLayer', () => {
  it('reuses its figures frame to frame and hides the spares', () => {
    const layer = new PotionLayer();
    layer.begin();
    for (let i = 0; i < 3; i++) layer.put(look('flame'), pose({ x: i * 100 }));
    layer.end();
    const first = [...layer.children];
    layer.begin();
    layer.put(look('star'), pose({ x: 40 }));
    layer.end();
    expect(layer.children).toEqual(first);
    expect(layer.children.map((c) => c.visible)).toEqual([true, false, false]);
    expect(layer.children[0].x).toBe(40);
    layer.begin();
    layer.put(look('star'), pose());
    layer.put(look('star'), pose());
    layer.end();
    expect(layer.children.map((c) => c.visible)).toEqual([true, true, false]);
  });

  /** Puts the same idle potion `frames` times and counts how often each figure redrew. */
  function redraws(frames: number, at: (frame: number) => [PotionLook, PotionPose][]): number[] {
    const layer = new PotionLayer();
    const first = at(0);
    layer.begin();
    for (const [l, p] of first) layer.put(l, p);
    const spies = layer.children.map((c) => vi.spyOn(parts(c).front, 'clear'));
    for (let f = 1; f <= frames; f++) {
      layer.begin();
      for (const [l, p] of at(f)) layer.put(l, p);
    }
    return spies.map((s) => s.mock.calls.length);
  }

  it('redraws an idle figure every other frame, half of them on each', () => {
    const l = look('flame');
    expect(redraws(4, () => [[l, pose()], [l, pose()]])).toEqual([2, 2]);
    expect(redraws(1, () => [[l, pose()], [l, pose()]])).toEqual([1, 0]);
    expect(redraws(2, () => [[l, pose()], [l, pose()]])).toEqual([1, 1]);
  });

  it('redraws at once while winding up, recoiling or pouring', () => {
    const l = look('flame');
    expect(redraws(4, () => [[l, pose({ wind: 0.1 })]])).toEqual([4]);
    expect(redraws(4, () => [[l, pose({ since: 0.1 })]])).toEqual([4]);
    expect(redraws(4, () => [[l, pose({ tilt: 0.2 })]])).toEqual([4]);
  });

  it('redraws at once with a new look, size, dimming or blink', () => {
    const a = look('flame');
    const b = look('frost');
    expect(redraws(4, (f) => [[f % 2 ? a : b, pose()]])).toEqual([4]);
    expect(redraws(4, (f) => [[a, pose({ height: 100 + f })]])).toEqual([4]);
    expect(redraws(4, (f) => [[a, pose({ dim: f % 2 === 0 })]])).toEqual([4]);
    expect(redraws(4, (f) => [[a, pose({ time: f % 2 ? 0 : 1 })]])).toEqual([4]);
  });
});
