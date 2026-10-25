// The gold and the notes that float up over the battle and fade; hidden ones are reused.

import { Container, type Text } from 'pixi.js';
import { label } from '../ui';

export class Floaters extends Container {
  /** A note floating up from (x, y) and fading, on a hidden one when there is one; at most 31.
   *  `size` scales it up for a note that matters more. */
  show(text: string, x: number, y: number, color: number, size = 1): void {
    let shown = 0;
    let free: Text | null = null;
    for (const f of this.children as Text[]) {
      if (f.visible) shown++;
      else if (!free) free = f;
    }
    if (shown > 30) return;
    if (!free) free = label(text, 40, { fill: color });
    else {
      if (free.text !== text) free.text = text;
      if (free.style.fill !== color) free.style.fill = color;
      free.alpha = 1;
      free.visible = true;
    }
    free.position.set(x, y - 30);
    free.scale.set(size);
    // the newest on top, as when each was new
    this.addChild(free);
  }

  /** Moves the notes up and fades them, `dt` seconds on. */
  update(dt: number): void {
    for (const f of this.children) {
      if (!f.visible) continue;
      f.y -= 120 * dt;
      f.alpha -= dt * 1.2;
      if (f.alpha <= 0) f.visible = false;
    }
  }

  hideAll(): void {
    for (const f of this.children) f.visible = false;
  }
}
