import { Container, Texture, type Sprite } from 'pixi.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Enemy } from '../../sim/types';
import { noCanvas } from '../fakeArt';
import { turnView } from '../landView';
import { EnemyMarks } from './enemyMarks';

function foe(o: Partial<Enemy> = {}): Enemy {
  return { id: 1, kind: 'grunt', x: 500, y: 800, radius: 40, hp: 100, maxHp: 100, ...o } as Enemy;
}

/** One frame of marks for `foes`: their shadows and bars. */
function frame(marks: EnemyMarks, foes: Enemy[]): void {
  marks.begin();
  for (const e of foes) {
    marks.shadow(e);
    marks.hp(e);
  }
  marks.end();
}

const shown = (pool: Container) => pool.children.filter((c) => c.visible) as Sprite[];

describe('the marks under and over each enemy', () => {
  beforeAll(noCanvas);
  afterEach(() => turnView(new Container(), false));

  it('gives every enemy a shadow, and bars only to a hurt one or an elite', () => {
    const marks = new EnemyMarks();
    frame(marks, [foe(), foe({ id: 2, hp: 40 }), foe({ id: 3, elite: true })]);
    expect(shown(marks.shadows).length).toBe(3);
    expect(shown(marks.bars).length).toBe(4);
  });

  it('fills the HP bar by what is left of it, and adds a jar bar for a shield', () => {
    const marks = new EnemyMarks();
    frame(marks, [foe({ hp: 25, shieldMax: 50, shield: 10 })]);
    const [back, hp, jarBack, jar] = shown(marks.bars);
    expect(hp.width / back.width).toBeCloseTo(0.25);
    expect(jar.width / jarBack.width).toBeCloseTo(0.2);
    expect(jarBack.y).toBe(back.y - 14);
  });

  it('shows an untouched enemy whose shield is chipped, and an empty bar for one past dead', () => {
    const marks = new EnemyMarks();
    frame(marks, [foe({ shieldMax: 50, shield: 49 }), foe({ id: 2, hp: -5 })]);
    const bars = shown(marks.bars);
    expect(bars.length).toBe(6);
    expect(bars[5].width).toBe(0);
  });

  it('casts a flyer\'s shadow smaller and fainter', () => {
    const marks = new EnemyMarks();
    frame(marks, [foe(), foe({ id: 2, kind: 'flyer' })]);
    const [walker, flyer] = shown(marks.shadows);
    expect(flyer.width).toBeLessThan(walker.width);
    expect(flyer.alpha).toBeLessThan(walker.alpha);
  });

  it('hides the sprites a frame with fewer enemies no longer needs, and reuses them', () => {
    const marks = new EnemyMarks();
    frame(marks, [foe({ hp: 1 }), foe({ id: 2, hp: 1 })]);
    frame(marks, [foe({ hp: 1 })]);
    expect([marks.shadows.children.length, shown(marks.shadows).length]).toEqual([2, 1]);
    expect([marks.bars.children.length, shown(marks.bars).length]).toEqual([4, 2]);
    frame(marks, []);
    expect(shown(marks.shadows).length + shown(marks.bars).length).toBe(0);
  });

  it('puts the shadow at the feet and the bars above, on the screen, on a field on its side', () => {
    const marks = new EnemyMarks();
    const e = foe({ hp: 50 });
    frame(marks, [e]);
    const [upShadow, upBar] = [shown(marks.shadows)[0], shown(marks.bars)[0]];
    expect([upShadow.x, upShadow.y]).toEqual([e.x, e.y + 32]);
    expect(upBar.y).toBeLessThan(e.y);
    turnView(new Container(), true);
    frame(marks, [e]);
    const [shadow, bar] = [shown(marks.shadows)[0], shown(marks.bars)[0]];
    // below on the screen is +x in the view, above is -x
    expect([shadow.x, shadow.y]).toEqual([e.x + 32, e.y]);
    expect(bar.x).toBeLessThan(e.x);
    expect(bar.y).toBeGreaterThan(e.y);
  });
});

describe('the shadow disc', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('is baked once on a canvas where there is one', async () => {
    const calls: string[] = [];
    const ctx = { beginPath: () => calls.push('path'), arc: (...a: number[]) => calls.push(`arc ${a.slice(0, 3)}`), fill: () => calls.push('fill'), fillStyle: '' };
    const canvas = { width: 0, height: 0, getContext: () => ctx };
    const make = vi.fn(() => canvas);
    vi.stubGlobal('document', { createElement: make });
    const baked = new Texture({ source: Texture.WHITE.source });
    const from = vi.spyOn(Texture, 'from').mockReturnValue(baked);
    vi.resetModules();
    const { EnemyMarks: Fresh } = await import('./enemyMarks');
    const marks = new Fresh();
    frame(marks as EnemyMarks, [foe(), foe({ id: 2 })]);
    expect(shown(marks.shadows).map((s) => s.texture)).toEqual([baked, baked]);
    expect(make).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith(canvas);
    expect([canvas.width, canvas.height, ctx.fillStyle]).toEqual([64, 64, '#fff']);
    expect(calls).toEqual(['path', 'arc 32,32,31', 'fill']);
  });
});
