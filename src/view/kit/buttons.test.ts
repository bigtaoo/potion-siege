import '../layout/measure';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Container, Graphics, Text } from 'pixi.js';
import { PillButton, redDot, refuse, tappable, uiSound } from './buttons';
import { P } from './palette';
import { fillColors } from './kitTestBits';

const tap = (c: Container) => {
  const e = { stopPropagation: vi.fn() };
  c.emit('pointertap', e as never);
  return e;
};

afterEach(() => {
  uiSound.tap = () => {};
  vi.restoreAllMocks();
});

describe('PillButton', () => {
  it('runs its tap with a click, and keeps the tap from the board under it', () => {
    const onTap = vi.fn();
    const sound = vi.fn();
    uiSound.tap = sound;
    const b = new PillButton('Go', 400, 120, 'green', onTap);
    const e = tap(b);
    expect(onTap).toHaveBeenCalledOnce();
    expect(sound).toHaveBeenCalledOnce();
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(b.cursor).toBe('pointer');
  });

  it('turns grey while off and says why on a tap, without running it', () => {
    const onTap = vi.fn();
    const why = vi.fn();
    const b = new PillButton('Go', 400, 120, 'purple', onTap).whenOff(why);
    const bg = b.children[0] as Graphics;
    expect(fillColors(bg)).toContain(0x8f5ce0);
    expect(b.setEnabled(false)).toBe(b);
    expect(b.cursor).toBe('default');
    expect(fillColors(bg)).not.toContain(0x8f5ce0);
    expect(fillColors(bg)).toContain(0xa8987f);
    tap(b);
    expect(onTap).not.toHaveBeenCalled();
    expect(why).toHaveBeenCalledOnce();
    b.setEnabled(true);
    tap(b);
    expect(onTap).toHaveBeenCalledOnce();
    expect(b.cursor).toBe('pointer');
  });

  it('takes an off tap quietly when nothing says why', () => {
    const b = new PillButton('Go', 400, 120, 'red', () => {}).setEnabled(false);
    expect(() => tap(b)).not.toThrow();
  });

  it('shrinks a long caption to stay inside its rounded ends', () => {
    const b = new PillButton('A caption far too long for so short a button', 300, 100, 'brass', () => {});
    const text = b.children[1] as Text;
    expect(text.width).toBeLessThanOrEqual(300 - 100 * 0.6 + 0.01);
  });

  it('puts a crystal beside a price, the pair centred', () => {
    const b = new PillButton('120', 300, 100, 'green', () => {}, 52, true);
    expect(b.children).toHaveLength(3);
    const text = b.children[1] as Text;
    expect(text.x).toBe(22);
    expect(b.children[2]).toBeInstanceOf(Graphics);
  });
});

describe('tappable', () => {
  it('makes a container answer taps with a click', () => {
    const onTap = vi.fn();
    const sound = vi.fn();
    uiSound.tap = sound;
    const c = tappable(new Container(), onTap);
    expect(c.eventMode).toBe('static');
    expect(c.cursor).toBe('pointer');
    tap(c);
    expect(onTap).toHaveBeenCalledOnce();
    expect(sound).toHaveBeenCalledOnce();
  });
});

describe('refuse', () => {
  function setup() {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const parent = new Container();
    const b = parent.addChild(new PillButton('Go', 400, 120, 'green', () => {}));
    b.position.set(300, 500);
    return { parent, b, at: (ms: number) => (now = 1000 + ms) };
  }
  const note = (p: Container) => p.children.find((c) => c.label === 'refuse');

  it('does nothing to a button on no board', () => {
    const b = new PillButton('Go', 400, 120, 'green', () => {});
    refuse(b, 'No');
    expect(b.onRender).toBeFalsy();
  });

  it('shakes the button and settles it back where it was', () => {
    const { b, at } = setup();
    refuse(b, 'Not enough');
    at(100);
    b.onRender!(null as never);
    expect(b.x).not.toBe(300);
    expect(Math.abs(b.x - 300)).toBeLessThanOrEqual(14);
    at(420);
    b.onRender!(null as never);
    expect(b.x).toBe(300);
    expect(b.onRender).toBeFalsy();
  });

  it('raises a note over the button that fades and is gone after its time', async () => {
    const { parent, b, at } = setup();
    refuse(b, 'Not enough');
    const n = note(parent)!;
    const y0 = n.y;
    expect(n.x).toBe(300);
    expect(y0).toBeLessThan(b.y - b.height / 2);
    at(700);
    n.onRender!(null as never);
    expect(n.y).toBe(y0 - 26);
    expect(n.alpha).toBe(1);
    at(1200);
    n.onRender!(null as never);
    expect(n.alpha).toBeGreaterThan(0);
    expect(n.alpha).toBeLessThan(1);
    at(1400);
    n.onRender!(null as never);
    expect(n.visible).toBe(false);
    expect(n.destroyed).toBe(false);
    await Promise.resolve();
    expect(n.destroyed).toBe(true);
  });

  it('keeps one note at a time and shakes about the first place, not a shaken one', () => {
    const { parent, b, at } = setup();
    refuse(b, 'One');
    const first = note(parent)!;
    at(100);
    b.onRender!(null as never);
    refuse(b, 'Two');
    expect(first.destroyed).toBe(true);
    expect(parent.children.filter((c) => c.label === 'refuse')).toHaveLength(1);
    expect(note(parent)!.x).toBe(300);
    at(600);
    b.onRender!(null as never);
    expect(b.x).toBe(300);
  });
});

describe('redDot', () => {
  it('adds a red dot at the spot', () => {
    const c = new Container();
    redDot(c, 40, -20);
    const dot = c.children[0] as Graphics;
    expect(fillColors(dot)).toEqual([P.red]);
    const b = dot.getLocalBounds();
    expect((b.minX + b.maxX) / 2).toBeCloseTo(40);
    expect((b.minY + b.maxY) / 2).toBeCloseTo(-20);
  });
});
