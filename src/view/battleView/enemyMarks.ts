// What every drawn enemy carries besides its art: the shadow at its feet and its HP bars. They
// are sprites reused frame to frame (a baked disc, stretched into the ellipse, and white bars,
// tinted), not Graphics: with a hundred grunts on the road, rebuilding those shapes every frame
// was the biggest single cost of a battle frame. The rare extras (an elite's ring and frame) stay
// Graphics (shapes.ts).

import { Container, Sprite, Texture } from 'pixi.js';
import type { Enemy } from '../../sim/types';
import { aside } from '../landView';
import { artBarTop, barsShown, enemyBarBox } from '../shapes';
import { COLORS } from '../ui';

/** A white disc, stretched and tinted into each shadow. Made on first use. */
let disc: Texture | undefined;

function discTexture(): Texture {
  if (disc) return disc;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return (disc = Texture.WHITE);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  return (disc = Texture.from(c));
}

/** Sprites of one texture handed out in order each frame; the unused ones are hidden. */
class Pool extends Container {
  private used = 0;

  constructor(private readonly tex: () => Texture, private readonly anchor: number) {
    super();
  }

  begin(): void {
    this.used = 0;
  }

  /** A sprite covering `w` x `h` at (x, y): its centre (anchor 0.5) or its top left (0). */
  put(x: number, y: number, w: number, h: number, tint: number, alpha = 1): Sprite {
    let s = this.children[this.used] as Sprite | undefined;
    if (!s) {
      s = new Sprite(this.tex());
      s.anchor.set(this.anchor);
      this.addChild(s);
    }
    this.used++;
    s.visible = true;
    s.position.set(x, y);
    s.setSize(w, h);
    s.tint = tint;
    s.alpha = alpha;
    return s;
  }

  end(): void {
    for (let i = this.used; i < this.children.length; i++) this.children[i].visible = false;
  }
}

export class EnemyMarks {
  /** Goes under the enemies' art. */
  readonly shadows = new Pool(discTexture, 0.5);
  /** Goes over the enemies' art. */
  readonly bars = new Pool(() => Texture.WHITE, 0);

  begin(): void {
    this.shadows.begin();
    this.bars.begin();
  }

  /** A flyer's shadow is smaller and fainter, cast from up in the air. */
  shadow(e: Enemy): void {
    const { x, y, radius: r } = e;
    const fly = e.kind === 'flyer';
    const p = aside(x, y, 0, r * 0.8);
    this.shadows.put(p.x, p.y, r * (fly ? 1.4 : 1.8), r * (fly ? 0.44 : 0.6), 0x000000, fly ? 0.2 : 0.3);
  }

  /** The HP bar over an enemy's art (and the tripod's jar bar over that), unless untouched; an
   *  elite's gold frame under them is Graphics (drawEnemy's `over`). */
  hp(e: Enemy): void {
    if (!barsShown(e)) return;
    const { x, w, top } = enemyBarBox(e, artBarTop(e));
    // the bars' top left, as an offset from the enemy on the screen
    const dx = x - w / 2 - e.x;
    let p = aside(e.x, e.y, dx, top - e.y);
    this.bars.put(p.x, p.y, w, 10, COLORS.hpBack);
    this.bars.put(p.x, p.y, (w * Math.max(0, e.hp)) / e.maxHp, 10, COLORS.hp);
    if (e.shieldMax) {
      p = aside(e.x, e.y, dx, top - 14 - e.y);
      this.bars.put(p.x, p.y, w, 10, COLORS.hpBack);
      this.bars.put(p.x, p.y, (w * Math.max(0, e.shield ?? 0)) / e.shieldMax, 10, 0x8fe6f0);
    }
  }

  end(): void {
    this.shadows.end();
    this.bars.end();
  }
}
