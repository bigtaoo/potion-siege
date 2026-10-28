// The edges of finding enemies (targets.ts) and of the battle's grid (battle.ts): the front
// without winders or the dead, a reach that counts its rim, the nearest on a tie, the wall's
// front over each column, and which cells are open or buildable. Pinned by mutation testing
// (ref/mutation-sim.md).

import { describe, expect, it } from 'vitest';
import { Battle, SLOT_COUNT, WALL_ROW } from './battle';
import { K } from './field';
import { toFp } from './math/fixed';
import { frontY, nearest, targets, within } from './targets';
import { BALANCE, type Enemy, type EnemyKind } from './types';

const G = BALANCE.grid;

/** An enemy at (x, y), world units, with `hp` hit points. */
function enemy(b: Battle, x: number, y: number, kind: EnemyKind = 'grunt', hp = 100): Enemy {
  [x, y] = [toFp(x), toFp(y)];
  const e: Enemy = {
    id: 9000 + b.enemies.length, kind, x, y, px: x, py: y, hp: toFp(hp), maxHp: toFp(100), speed: 0, radius: toFp(30),
    slowFactor: 1000, slowTime: 0, freezeTime: 0, poisonDps: 0, poisonTime: 0, rust: 0, rustTime: 0, burnDps: 0, burnTime: 0, scorch: 0, scorchTime: 0,
    markTime: 0, chill: 0, chillTime: 0, brittleTime: 0, charge: 0, chargeTime: 0, pushTime: 0, atWall: false, gold: 1000, heft: 1000,
  };
  b.enemies.push(e);
  return e;
}

function field(): Battle {
  const b = new Battle(1);
  b.enemies = [];
  return b;
}

describe('targets edges', () => {
  it('finds the front without winders or the dead', () => {
    const b = field();
    expect(frontY(b)).toBe(-Infinity);
    enemy(b, 500, 900, 'winder');
    enemy(b, 500, 800, 'grunt', 0);
    enemy(b, 500, 600);
    expect(frontY(b)).toBe(toFp(600));
  });

  it('counts an enemy on the rim of a reach as within it', () => {
    const b = field();
    const e = enemy(b, 500, 600);
    expect(within(e, toFp(500), toFp(700), toFp(70))).toBe(true);
    expect(within(e, toFp(500), toFp(701), toFp(70))).toBe(false);
  });

  it('lists only the living, front first', () => {
    const b = field();
    const back = enemy(b, 500, 300);
    enemy(b, 500, 900, 'grunt', 0);
    const front = enemy(b, 500, 600);
    expect(targets(b)).toEqual([front, back]);
  });

  it('takes the nearest living one, the last of a tie, up to the rim of its range', () => {
    const b = field();
    const from = enemy(b, 500, 600);
    enemy(b, 500, 610, 'grunt', 0);
    enemy(b, 400, 600);
    const right = enemy(b, 600, 600);
    expect(nearest(b, from, toFp(100), new Set([from.id]))).toBe(right);
    expect(nearest(b, from, toFp(99), new Set([from.id]))).toBeUndefined();
  });
});

describe('battle grid edges', () => {
  const front = (rows: number) => toFp(G.y0 + G.cellH * rows - BALANCE.field.parapet);
  const midX = (col: number) => K.x0 + toFp(G.cellW * (col + 0.5));

  it('moves the wall\'s front up a cell over a built column only', () => {
    const b = new Battle(1);
    expect(b.wallFront(midX(1))).toBe(front(WALL_ROW));
    b.open[(WALL_ROW - 1) * G.cols + 1] = true;
    expect(b.wallFront(midX(1))).toBe(front(WALL_ROW - 1));
    expect(b.wallFront(midX(0))).toBe(front(WALL_ROW));
    expect(b.wallFront(midX(2))).toBe(front(WALL_ROW));
    b.open[(WALL_ROW - 1) * G.cols + G.cols - 1] = true;
    b.open[(WALL_ROW - 2) * G.cols + G.cols - 1] = true;
    expect(b.wallFront(toFp(1e5))).toBe(front(WALL_ROW - 2));
    expect(b.wallFront(-toFp(1e5))).toBe(front(WALL_ROW));
  });

  it('knows which slots are open, on the grid only', () => {
    const b = new Battle(1);
    expect(b.isOpen(WALL_ROW * G.cols)).toBe(true);
    expect(b.isOpen(0)).toBe(false);
    expect(b.isOpen(-1)).toBe(false);
    expect(b.isOpen(SLOT_COUNT)).toBe(false);
  });

  it('builds only on top of an open cell', () => {
    const b = new Battle(1);
    const first = (WALL_ROW - 1) * G.cols;
    expect(b.buildable()).toEqual(Array.from({ length: G.cols }, (_, c) => first + c));
  });

  it('counts the summons left to the next cell part way through', () => {
    const b = new Battle(1);
    b.summons = 1;
    expect(b.summonsToNextCell()).toBe(BALANCE.commander.summonsPerCell - 1);
  });

  it('pauses once the battle is over', () => {
    const b = new Battle(1);
    expect(b.paused).toBe(false);
    b.result = 'lost';
    expect(b.paused).toBe(true);
  });
});
