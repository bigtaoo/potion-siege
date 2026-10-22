// What the workshop menus are tapped through: the glossy pill button, making any container
// tappable, the shake and note of a refused tap, and the red dot that says something waits.

import { Container, Graphics } from 'pixi.js';
import { gem, label } from '../ui';
import { LIGHT, P } from './palette';
import { fit, ink } from './text';

/** The button colours: body, the darker lip under it, and the glossy band on top. */
const BUTTON = {
  green: [P.green, P.greenDark],
  brass: [P.brass, P.brassDark],
  purple: [0x8f5ce0, 0x5a35a0],
  off: [0xa8987f, 0x6e604f],
} as const;
export type ButtonKind = Exclude<keyof typeof BUTTON, 'off'>;

/** A glossy capsule button centred on its position, with an optional crystal price. */
export class PillButton extends Container {
  private readonly bg = new Graphics();
  private enabled = true;
  private offTap: (() => void) | null = null;

  constructor(
    caption: string,
    private readonly w: number,
    private readonly h: number,
    private readonly kind: ButtonKind,
    onTap: () => void,
    size = 52,
    price = false,
  ) {
    super();
    const text = label(caption, size, { stroke: { color: P.line, width: Math.max(4, size / 8) } });
    text.y = -4;
    // a long caption (a translation, say) shrinks to stay inside the rounded ends
    fit(text, price ? w - 60 : w - h * 0.6); // a price sits beside its gem
    this.addChild(this.bg, text);
    if (price) {
      // the crystal to the left of the number, the pair centred
      text.x = 22;
      this.addChild(gem(new Graphics(), 22 - text.width / 2 - 30, -4, size * 0.48));
    }
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', (e) => {
      e.stopPropagation();
      if (!this.enabled) {
        this.offTap?.();
        return;
      }
      uiSound.tap();
      onTap();
    });
    this.draw();
  }

  setEnabled(on: boolean): this {
    if (on !== this.enabled) {
      this.enabled = on;
      this.cursor = on ? 'pointer' : 'default';
      this.draw();
    }
    return this;
  }

  /** What a tap on the button does while it is off, such as saying why. */
  whenOff(fn: () => void): this {
    this.offTap = fn;
    return this;
  }

  private draw(): void {
    const { w, h } = this;
    const r = h / 2;
    const [body, lip] = BUTTON[this.enabled ? this.kind : 'off'];
    this.bg
      .clear()
      .roundRect(-w / 2, -h / 2 + 8, w, h, r)
      .fill({ color: P.line, alpha: 0.5 })
      .roundRect(-w / 2, -h / 2, w, h, r)
      .fill(lip)
      .roundRect(-w / 2, -h / 2, w, h - 10, r)
      .fill(body)
      .roundRect(-w / 2 + r * 0.6, -h / 2 + 8, w - r * 1.2, Math.max(8, h * 0.14), 6)
      .fill({ color: 0xffffff, alpha: 0.35 })
      .roundRect(-w / 2, -h / 2, w, h, r)
      .stroke({ width: 6, color: P.line });
  }
}

/** The click every button makes; the game's audio sets it. */
export const uiSound = { tap: (): void => {} };

/** Makes a container tappable. */
export function tappable<T extends Container>(c: T, onTap: () => void): T {
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.on('pointertap', () => {
    uiSound.tap();
    onTap();
  });
  return c;
}

/** A tap that cannot go through: the button shakes and a short note rises over it. */
export function refuse(b: Container, text: string): void {
  const parent = b.parent;
  if (!parent) return;
  const x0 = (b as Container & { refuseX?: number }).refuseX ?? b.x;
  (b as Container & { refuseX?: number }).refuseX = x0;
  const start = performance.now();
  b.onRender = () => {
    const e = (performance.now() - start) / 420;
    if (e >= 1) {
      b.x = x0;
      b.onRender = null;
      return;
    }
    b.x = x0 + Math.sin(e * Math.PI * 6) * 14 * (1 - e);
  };
  const old = parent.children.find((c) => c.label === 'refuse');
  old?.destroy({ children: true });
  const note = new Container();
  note.label = 'refuse';
  const word = ink(text, 34, { fill: 0xa8322a, fontWeight: '900' });
  const w = word.width + 44;
  note.addChild(new Graphics().roundRect(-w / 2, -30, w, 60, 30).fill(LIGHT.face).stroke({ width: 4, color: LIGHT.edge }), word);
  const y0 = b.y - b.height / 2 - 44;
  note.position.set(x0, y0);
  parent.addChild(note);
  note.onRender = () => {
    const e = (performance.now() - start) / 1400;
    if (e >= 1) {
      // gone after this frame, not in the middle of drawing it
      note.onRender = null;
      note.visible = false;
      queueMicrotask(() => note.destroyed || note.destroy({ children: true }));
      return;
    }
    note.y = y0 - 26 * Math.min(1, e * 4);
    note.alpha = e < 0.7 ? 1 : 1 - (e - 0.7) / 0.3;
  };
}

/** The red dot that says something is waiting. */
export function redDot(c: Container, x: number, y: number): void {
  c.addChild(new Graphics().circle(x, y, 17).fill(P.red).stroke({ width: 5, color: P.line }));
}
