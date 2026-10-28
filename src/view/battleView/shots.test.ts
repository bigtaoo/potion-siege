import { Graphics, type Sprite } from 'pixi.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { Battle } from '../../sim/battle';
import { FP } from '../../sim/math/fixed';
import { battleSetup, newMeta } from '../../sim/meta';
import type { Projectile } from '../../sim/types';
import { fakeArt } from '../fakeArt';
import { ShotLayer } from './shots';

const LEAVE_HAND = 0.15;

function shot(o: Partial<Projectile> = {}): Projectile {
  const at = { x: 400 * FP, y: 900 * FP };
  return { id: 1, kind: 'fire', star: 1, ...at, px: at.x, py: at.y, targetId: 0, tx: 400 * FP, ty: 300 * FP, damage: 1, ...o };
}

function layer() {
  const shots = new ShotLayer();
  const b = new Battle(1, battleSetup(newMeta(), 1));
  const w = new Graphics();
  const draw = (list: Projectile[], t: number) => {
    b.projectiles = list;
    shots.draw(b, 1, t, w.clear());
    shots.art.end();
    return shots.art.children.filter((s) => s.visible) as Sprite[];
  };
  return { shots, w, draw };
}

describe('the heroes\' shots as drawn', () => {
  it('draws placeholder shapes while there is no art', () => {
    const { w, draw } = layer();
    expect(draw([shot()], 0).length).toBe(0);
    expect(w.bounds.width).toBeGreaterThan(0);
  });

  describe('with the art', () => {
    beforeAll(fakeArt);

    it('throws a tumbling vial for every shot, and hides the vials of shots gone', () => {
      const { draw } = layer();
      const two = draw([shot(), shot({ id: 2, x: 600 * FP, px: 600 * FP })], 1);
      expect(two.map((s) => s.x)).toEqual([400, 600]);
      expect(two[0].rotation).not.toBe(two[1].rotation);
      expect(draw([shot({ id: 2 })], 1.1).length).toBe(1);
      expect(draw([], 1.2).length).toBe(0);
    });

    it('starts a thrown vial at the hand and eases it onto its true path', () => {
      const { shots, draw } = layer();
      shots.launch(1, -40, 20, 5);
      expect(draw([shot()], 5)[0].position).toMatchObject({ x: 360, y: 920 });
      const half = draw([shot()], 5 + LEAVE_HAND / 2)[0];
      expect(half.x).toBeCloseTo(390);
      expect(half.y).toBeCloseTo(905);
      expect(draw([shot()], 5 + LEAVE_HAND)[0].position).toMatchObject({ x: 400, y: 900 });
      // once on its path it stays there
      expect(draw([shot()], 5)[0].position).toMatchObject({ x: 400, y: 900 });
    });

    it('forgets the hands of launches long past, and all of them for a new battle', () => {
      const { shots, draw } = layer();
      shots.launch(1, -40, 0, 0);
      shots.launch(2, -40, 0, 1);
      // a second on, the first is long on its path; the second is just leaving the hand
      expect(draw([shot(), shot({ id: 2 })], 1).map((s) => s.x)).toEqual([400, 360]);
      shots.launch(3, -40, 0, 0);
      shots.clear();
      expect(draw([shot({ id: 3 })], 0)[0].x).toBe(400);
    });
  });
});
