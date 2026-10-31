// The four milestones past Lv 20 on a potion's panel: small tiles two by two, each its level and
// what it gives, ticked once reached.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { latePerk, LATE_STEPS } from '../../sim/latePerks';
import type { HeroKind } from '../../sim/types';
import { inkWrapped, ink, lightTile, lock, P } from '../kit';
import { label } from '../ui';
import { perkText } from './perkText';

export const TILE_W = 421;
export const TILE_H = 120;
const GAP = 18;

/** The tiles from `top` down, centred on the panel's middle; two rows high. */
export function lateTiles(kind: HeroKind, lv: number, top: number): Container {
  const c = new Container();
  LATE_STEPS.forEach(({ level, step }, i) => {
    const on = lv >= level;
    const r = new Container();
    r.label = `late_${step}`;
    r.position.set((i % 2 === 0 ? -1 : 1) * (TILE_W + GAP) / 2, top + Math.floor(i / 2) * (TILE_H + GAP) + TILE_H / 2);
    r.addChild(lightTile(TILE_W, TILE_H, 20));
    if (on) r.addChild(new Graphics().roundRect(-TILE_W / 2 - 5, -TILE_H / 2 - 5, TILE_W + 10, TILE_H + 10, 24).stroke({ width: 6, color: P.brass }));
    const tag = ink(t('level', { n: level }), 32, { fill: on ? P.brassDark : P.inkSoft });
    tag.anchor.set(0, 0.5);
    tag.position.set(-TILE_W / 2 + 20, 0);
    const what = inkWrapped(perkText(latePerk(kind, step)), 28, TILE_W - 190, { align: 'left', lineHeight: 34 });
    what.anchor.set(0, 0.5);
    what.position.set(-TILE_W / 2 + 112, 0);
    r.addChild(tag, what);
    if (on) {
      const tick = label('✓', 40, { fill: P.green, stroke: { color: P.line, width: 7 } });
      tick.position.set(TILE_W / 2 - 36, 0);
      r.addChild(tick);
    } else {
      const l = lock();
      l.scale.set(0.8);
      l.position.set(TILE_W / 2 - 36, 4);
      r.addChild(l);
      r.alpha = 0.8;
    }
    c.addChild(r);
  });
  return c;
}
