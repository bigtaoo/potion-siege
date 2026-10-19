/** Finds words that stick out of the panel, card, tile or button they sit on. A Text's box is
 *  the smallest Graphics drawn before it - an earlier sibling of the Text or of one of its
 *  ancestors, the nearest level that has one - whose bounds hold the Text's centre; a Text over
 *  no Graphics at all must stay on the page, and every Text must stay on the page anyway. Only
 *  the part a mask lets through counts. */
import { Container, Graphics, Text } from 'pixi.js';

export interface Overflow {
  text: string;
  /** How many px (page space) the words stick out on the worst side. */
  by: number;
  side: 'left' | 'right' | 'top' | 'bottom' | 'button';
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function shown(c: Container): boolean {
  for (let n: Container | null = c; n; n = n.parent) if (!n.visible || n.alpha <= 0 || n.renderable === false) return false;
  return true;
}

function holds(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

/** A Graphics, or a Container whose first child is one (a card built as a group). */
function surface(c: Container): Graphics | null {
  if (c instanceof Graphics) return c;
  return null;
}

/** The Text's box and the container it was found in. */
function boxOf(t: Text, page: Rect, root: Container): { box: Rect; level: Container } {
  const tb = t.getBounds();
  const cx = tb.x + tb.width / 2;
  const cy = tb.y + tb.height / 2;
  for (let node: Container = t; node.parent; node = node.parent) {
    const kids = node.parent.children;
    let best: Rect | null = null;
    for (const k of kids) {
      if (k === node) break;
      const g = surface(k);
      if (!g || !shown(g)) continue;
      const b = g.getBounds();
      if (b.width < 2 || b.height < 2 || !holds(b, cx, cy)) continue;
      if (!best || b.width * b.height < best.width * best.height) best = { x: b.x, y: b.y, width: b.width, height: b.height };
    }
    if (best) return { box: best, level: node.parent };
  }
  return { box: page, level: root };
}

/** The part of `r` the masks over `c` let through (a scrolled list's window), or null when they
 *  hide all of it. */
function unmasked(c: Container, r: Rect): Rect | null {
  let { x, y, width, height } = r;
  for (let n: Container | null = c; n; n = n.parent) {
    if (!(n.mask instanceof Container)) continue;
    const m = n.mask.getBounds();
    const x2 = Math.min(x + width, m.x + m.width);
    const y2 = Math.min(y + height, m.y + m.height);
    x = Math.max(x, m.x);
    y = Math.max(y, m.y);
    width = x2 - x;
    height = y2 - y;
    if (width < 1 || height < 1) return null;
  }
  return { x, y, width, height };
}

function inside(c: Container, outer: Container): boolean {
  for (let n: Container | null = c; n; n = n.parent) if (n === outer) return true;
  return false;
}

/** Every shown Text under `root` that sticks out of its box by more than `slack` px, or runs
 *  into a button (one of `buttons`' classes) on the same box that it is not part of. */
export function overflows(root: Container, page: Rect, buttons: readonly (abstract new (...a: never[]) => Container)[] = [], slack = 4): Overflow[] {
  const out: Overflow[] = [];
  const pressable: Container[] = [];
  const find = (c: Container): void => {
    if (!c.visible || c.alpha <= 0) return;
    if (buttons.some((b) => c instanceof b)) pressable.push(c);
    for (const k of c.children) find(k);
  };
  find(root);
  const walk = (c: Container): void => {
    if (!c.visible || c.alpha <= 0) return;
    if (c instanceof Text) {
      if (c.text.trim() && shown(c)) {
        // a list's row scrolled out of its window is not on the page
        const tb = unmasked(c, c.getBounds());
        if (!tb) return;
        // the stroke pads a Text's bounds by half its width on each side, past the glyphs, and
        // the line box runs past the ink above and below: accents and descenders take ~0.1 em
        const k = Math.hypot(c.worldTransform.a, c.worldTransform.b);
        const stroke = (c.style.stroke as { width?: number } | undefined)?.width ?? 0;
        const pad = (stroke / 2) * k + slack;
        const vpad = pad + c.style.fontSize * 0.1 * k;
        const { box, level } = boxOf(c, page, root);
        let worst: Overflow | null = null;
        // its box, and the page too: a plate that grows with its words can run off the screen
        for (const r of [box, page]) {
          const sides = {
            left: r.x - (tb.x + pad),
            right: tb.x + tb.width - pad - (r.x + r.width),
            top: r.y - (tb.y + vpad),
            bottom: tb.y + tb.height - vpad - (r.y + r.height),
          };
          for (const [side, by] of Object.entries(sides) as [Overflow['side'], number][]) {
            if (by >= 1 && (!worst || by > worst.by)) worst = { text: c.text, by: Math.round(by), side };
          }
        }
        if (worst) out.push(worst);
        else {
          for (const b of pressable) {
            // a button in another layer (the page under a panel) is not in the way
            if (inside(c, b) || !inside(b, level)) continue;
            const bb = b.getBounds();
            const w = Math.min(tb.x + tb.width - pad, bb.x + bb.width) - Math.max(tb.x + pad, bb.x);
            const h = Math.min(tb.y + tb.height - vpad, bb.y + bb.height) - Math.max(tb.y + vpad, bb.y);
            if (w >= 1 && h >= 1) {
              out.push({ text: c.text, by: Math.round(w), side: 'button' });
              break;
            }
          }
        }
      }
      return;
    }
    for (const k of c.children) walk(k);
  };
  walk(root);
  return out;
}
