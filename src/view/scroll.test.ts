import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Graphics } from 'pixi.js';
import { scrollList } from './scroll';

let now = 0;
beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

/** A 400 x 300 window onto a list 1000 tall, and the offsets it reported. */
function list(start = 0) {
  const moves: number[] = [];
  const s = scrollList(400, 300, start, (y) => moves.push(y));
  s.fill(1000);
  const at = (type: string, y: number) => s.view.emit(type as never, { global: { x: 50, y } } as never);
  const frame = (ms: number) => {
    now += ms;
    s.view.onRender!(null as never);
  };
  return { s, moves, at, frame, thumb: s.view.children[2] as Graphics };
}

describe('scroll list', () => {
  it('opens where it was asked, never above the top', () => {
    expect(list(250).s.offset).toBe(250);
    expect(list(-40).s.offset).toBe(0);
    expect(list(250).s.content.y).toBe(-250);
  });

  it('holds the offset between the ends and reports each move once', () => {
    const { s, moves } = list();
    s.to(200);
    s.to(200);
    s.to(-50);
    s.to(5000);
    expect(moves).toEqual([200, 0, 700]);
    expect(s.content.y).toBe(-700);
    s.fill(500);
    expect(s.offset).toBe(200);
  });

  it('shows a thumb only while the list is taller than the window', () => {
    const { s, thumb } = list();
    expect(thumb.context.instructions.length).toBeGreaterThan(0);
    s.fill(200);
    expect(s.offset).toBe(0);
    expect(thumb.context.instructions).toHaveLength(0);
  });

  it('follows a drag once it moves past the slop, and lets the rows tap again after', async () => {
    const { s, at } = list();
    at('pointerdown', 200);
    at('globalpointermove', 195);
    expect(s.offset).toBe(0);
    expect(s.content.interactiveChildren).not.toBe(false);
    now += 16;
    at('globalpointermove', 100);
    expect(s.offset).toBe(100);
    expect(s.content.interactiveChildren).toBe(false);
    at('pointerup', 100);
    expect(s.content.interactiveChildren).toBe(false);
    await Promise.resolve();
    expect(s.content.interactiveChildren).toBe(true);
  });

  it('ignores moves with no press, and a press that never moved is a tap', () => {
    const { s, at, frame } = list();
    at('globalpointermove', 50);
    at('pointerdown', 200);
    at('pointerupoutside', 205);
    at('pointercancel', 205);
    frame(16);
    frame(16);
    expect(s.offset).toBe(0);
  });

  it('coasts on after a fling, slowing until it stops', () => {
    const { s, at, frame } = list();
    at('pointerdown', 250);
    for (let y = 230; y >= 150; y -= 20) {
      now += 10;
      at('globalpointermove', y);
    }
    const left = s.offset;
    at('pointerup', 150);
    frame(0);
    frame(16);
    const first = s.offset - left;
    expect(first).toBeGreaterThan(10);
    frame(16);
    expect(s.offset - left - first).toBeLessThan(first);
    for (let i = 0; i < 300; i++) frame(16);
    const settled = s.offset;
    frame(16);
    expect(s.offset).toBe(settled);
  });

  it('stops a coast at the end of the list', () => {
    const { s, at, frame } = list(600);
    at('pointerdown', 250);
    for (let y = 230; y >= 150; y -= 20) {
      now += 10;
      at('globalpointermove', y);
    }
    at('pointerup', 150);
    frame(0);
    for (let i = 0; i < 20; i++) frame(16);
    expect(s.offset).toBe(700);
  });

  it('does not fling after the finger held still before letting go', () => {
    const { s, at, frame } = list();
    at('pointerdown', 250);
    now += 10;
    at('globalpointermove', 150);
    now += 200;
    at('pointerup', 150);
    const left = s.offset;
    frame(16);
    frame(16);
    expect(s.offset).toBe(left);
  });

  it('stops a coast on a new press or a jump', () => {
    const { s, at, frame } = list();
    at('pointerdown', 250);
    now += 10;
    at('globalpointermove', 200);
    at('pointerup', 200);
    s.to(300);
    frame(16);
    frame(16);
    expect(s.offset).toBe(300);
  });

  it('scrolls by the wheel in the window\'s own units', () => {
    const { s } = list();
    s.view.emit('wheel', { deltaY: 120 } as never);
    expect(s.offset).toBe(120);
    s.view.scale.set(2);
    s.view.updateLocalTransform();
    (s.view as unknown as { worldTransform: { c: number; d: number } }).worldTransform.d = 2;
    s.view.emit('wheel', { deltaY: 120 } as never);
    expect(s.offset).toBe(180);
  });
});
