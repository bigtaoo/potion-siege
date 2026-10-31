// The home screen's potions tab: a card per potion (potionCard.ts) with its level, milestones and
// level-up button, under the lineup strip while there is a reserve potion.

import { Container } from 'pixi.js';
import { t } from '../../i18n';
import { benched, type MetaSave } from '../../sim/meta';
import { HERO_KINDS, type HeroKind } from '../../sim/types';
import { plate } from '../kit';
import { LINEUP_H, lineupStrip } from './lineup';
import { pointer } from './pointer';
import { heroCard } from './potionCard';
import { recommendedHero } from './potionPick';
import type { Area } from './shared';
import type { HomeActions } from './types';

/** A card per potion: portrait, level, the milestones reached and the level-up button; over
 *  them the lineup strip while there is a reserve to swap in, else the tab's name. */
export function potionsTab(root: Container, m: MetaSave, act: HomeActions, a: Area, picked: HeroKind | null, hint: HeroKind | null): void {
  const cx = a.x + a.w / 2;
  const swap = benched(m).length > 0;
  if (swap) lineupStrip(root, m, act, picked, cx, a.y + (a.wide ? 40 : 30) + LINEUP_H / 2, Math.min(1000, a.w - 80));
  else {
    const head = plate(t('potions'), 52);
    head.position.set(cx, a.y + 60);
    root.addChild(head);
  }
  // one row of five on a wide page; three over two on a portrait one
  const n = HERO_KINDS.length;
  const cols = a.wide ? n : 3;
  const cw = Math.min(380, (a.w - 60) / cols - 30);
  const ch = a.wide ? 640 : swap ? 625 : 640;
  const y0 = a.y + (swap ? (a.wide ? 270 : 252) : 150);
  const pick = recommendedHero(m);
  const cards = HERO_KINDS.map((kind, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const card = heroCard(m, act, kind, cw, ch, kind === pick);
    card.position.set(cx + (col - (inRow - 1) / 2) * (cw + 30), y0 + ch / 2 + row * (ch + 40));
    root.addChild(card);
    return card;
  });
  // over all the cards: up at the hinted potion's price button from below it
  const i = hint ? HERO_KINDS.indexOf(hint) : -1;
  if (i >= 0) root.addChild(pointer(cards[i].x + cw * 0.22, cards[i].y + ch / 2 - 34, 0, 0.8));
}
