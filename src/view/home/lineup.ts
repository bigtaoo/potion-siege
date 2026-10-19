// The lineup strip over the potions tab's cards while there is a reserve potion, and what a tap
// on it does to the save.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { benched, heroUnlocked, swapLineup, type MetaSave } from '../../sim/meta';
import { HERO_KINDS, type HeroKind } from '../../sim/types';
import type { HomeActions } from '../Home';
import { bottle, fit as fitText, ink, LIGHT, lightPanel, lightTile, P, tappable } from '../kit';
import { HERO_COLORS } from '../ui';
import { tick } from './shared';

/** A tap on the strip: a potion in the lineup swaps out for the reserve (the one picked, or the
 *  only one), `swap` naming the two; a reserve potion is picked, or unpicked. */
export function tapLineup(m: MetaSave, picked: HeroKind | null, kind: HeroKind): { picked: HeroKind | null; swap: [HeroKind, HeroKind] | null } {
  if (!heroUnlocked(m, kind)) return { picked, swap: null };
  if (!m.lineup.includes(kind)) return { picked: picked === kind ? null : kind, swap: null };
  const bench = benched(m);
  const into = picked ?? (bench.length === 1 ? bench[0] : null);
  if (!into || !swapLineup(m, kind, into)) return { picked, swap: null };
  return { picked: null, swap: [kind, into] };
}

/** The lineup over the potion cards while there is a reserve: a tile a potion, the four fielded
 *  ticked, the reserve tagged. Tapping one in the lineup swaps it for the reserve (or for the
 *  reserve `picked` first, when there are several). */
export function lineupStrip(root: Container, m: MetaSave, act: HomeActions, picked: HeroKind | null, x: number, y: number, w: number): void {
  const kinds = HERO_KINDS.filter((k) => heroUnlocked(m, k));
  const c = new Container();
  c.position.set(x, y);
  root.addChild(c);
  c.addChild(lightPanel(w, LINEUP_H));
  const step = Math.min(150, (w - 80) / kinds.length);
  const tw = step - 14;
  const th = 100;
  kinds.forEach((kind, i) => {
    const fielded = m.lineup.includes(kind);
    const b = tappable(new Container(), () => act.lineup(kind));
    b.position.set((i - (kinds.length - 1) / 2) * step, -22);
    b.addChild(lightTile(tw, th, 18));
    if (fielded) b.addChild(new Graphics().roundRect(-tw / 2 + 5, -th / 2 + 5, tw - 10, th - 10, 14).fill({ color: HERO_COLORS[kind], alpha: 0.25 }));
    if (kind === picked) b.addChild(new Graphics().roundRect(-tw / 2 - 6, -th / 2 - 6, tw + 12, th + 12, 22).stroke({ width: 7, color: P.brass }));
    const bt = bottle(kind, fielded ? 84 : 70);
    bt.y = fielded ? 0 : -12;
    b.addChild(bt);
    if (fielded) {
      const tk = tick(18);
      tk.position.set(tw / 2 - 14, -th / 2 + 14);
      b.addChild(tk);
    } else {
      b.alpha = kind === picked ? 1 : 0.75;
      const tag = new Container();
      const word = fitText(ink(t('bench'), 22, { fill: P.inkSoft }), tw - 20);
      const pw = word.width + 18;
      tag.position.set(0, th / 2 - 18);
      tag.addChild(new Graphics().roundRect(-pw / 2, -15, pw, 30, 15).fill(LIGHT.inset).stroke({ width: 3, color: LIGHT.edge }), word);
      b.addChild(tag);
    }
    c.addChild(b);
  });
  const hint = fitText(ink(picked ? t('lineupPick') : t('lineupHint'), 28, { fill: P.inkSoft }), w - 90);
  hint.y = LINEUP_H / 2 - 42;
  c.addChild(hint);
}

export const LINEUP_H = 204;
