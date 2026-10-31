// Dark capsules behind the HUD's top words (audit V3): the wave, the stage and the gold with its
// coin stay readable over whatever walks under them, a chapter's bright field or a boss at the
// top of the board, upright and on a field turned on its side alike.
import { Graphics, type Text } from 'pixi.js';

/** The plates' ink and how much of the field shows through. */
export const PLATE = { color: 0x0a1320, alpha: 0.55 };
const PAD_X = 22;
const PAD_Y = 8;

/** A span on the HUD a plate goes behind: a text, or a text with its coin at `coin`. */
export interface PlateSpan {
  text: Text;
  coin?: { x: number; y: number; r: number };
}

export class HudPlates extends Graphics {
  private drawn = '';

  /** Redraws the plates when one of the spans moved, grew or changed its words. */
  fit(spans: readonly PlateSpan[]): void {
    const boxes = spans.flatMap((s) => (s.text.visible && s.text.text !== '' ? [box(s)] : []));
    const key = boxes.map((b) => b.map(Math.round).join(',')).join(' ');
    if (key === this.drawn) return;
    this.drawn = key;
    this.clear();
    for (const [x, y, w, h] of boxes) this.roundRect(x, y, w, h, h / 2).fill(PLATE);
  }
}

/** A span's plate: x, y, w, h. */
function box({ text, coin }: PlateSpan): [number, number, number, number] {
  const w = text.width;
  const h = text.height;
  let left = text.x - text.anchor.x * w;
  let right = left + w;
  let top = text.y - text.anchor.y * h;
  let bottom = top + h;
  if (coin) {
    left = Math.min(left, coin.x - coin.r);
    right = Math.max(right, coin.x + coin.r);
    top = Math.min(top, coin.y - coin.r);
    bottom = Math.max(bottom, coin.y + coin.r);
  }
  return [left - PAD_X, top - PAD_Y, right - left + 2 * PAD_X, bottom - top + 2 * PAD_Y];
}
