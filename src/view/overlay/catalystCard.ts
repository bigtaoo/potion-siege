// The tower's catalyst pick (sim/tower.ts): tall gold-framed cards like the skill cards, a name
// on a brass band, a picture, what it does, and "×n" once it is held n times.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import type { CatalystId } from '../../sim/tower';
import { coinsIcon, LIGHT, P, paperCard, stopwatchIcon, swordIcon, wallIcon } from '../kit';
import { label } from '../ui';
import { BAND, CARD_H, CARD_W, descText, picture, titleText } from './cardFit';
import { RARITY_COLORS } from './skillCard';

const TINT: Record<CatalystId, number> = {
  volatile: 0xe8603c,
  wide: 0x3fb6c9,
  potent: 0xc84a4a,
  quick: 0x5aa0e6,
  bulwark: 0x9a8f80,
  bounty: 0xf2b632,
};

/** A burst of rays: the reactions' catalysts (`wide` with a ring round it). */
function burst(color: number, ring: boolean): Graphics {
  const g = new Graphics();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.moveTo(Math.cos(a) * 24, Math.sin(a) * 24).lineTo(Math.cos(a) * 62, Math.sin(a) * 62);
  }
  g.stroke({ width: 12, color, cap: 'round' });
  g.circle(0, 0, 26).fill(color).stroke({ width: 5, color: P.line });
  if (ring) g.circle(0, 0, 80).stroke({ width: 7, color });
  return g;
}

export function catalystIcon(id: CatalystId): Container {
  switch (id) {
    case 'volatile':
      return burst(TINT.volatile, false);
    case 'wide':
      return burst(TINT.wide, true);
    case 'potent':
      return swordIcon();
    case 'quick':
      return stopwatchIcon();
    case 'bulwark':
      return wallIcon();
    case 'bounty':
      return coinsIcon();
  }
}

export function catalystCard(id: CatalystId, held: number): Container {
  const card = new Container();
  card.label = `catalyst_${id}`;
  const top = -CARD_H / 2;
  card.addChild(paperCard(CARD_W, CARD_H, 30));
  card.addChild(
    new Graphics()
      .roundRect(-CARD_W / 2 - 4, top - 4, CARD_W + 8, CARD_H + 8, 34).stroke({ width: 10, color: RARITY_COLORS.legend })
      .roundRect(-CARD_W / 2 - 9, top - 9, CARD_W + 18, CARD_H + 18, 39).stroke({ width: 3, color: P.line }),
  );
  const x = -CARD_W / 2 + 10;
  const w = CARD_W - 20;
  card.addChild(new Graphics().roundRect(x, top + 10, w, BAND, 22).fill(P.brass).stroke({ width: 4, color: LIGHT.edge }));
  const name = titleText(t(`alchemy.catalyst.${id}.name`), 46);
  name.position.set(0, top + 10 + BAND / 2);
  if (name.height > BAND - 16) name.scale.set((BAND - 16) / name.height);
  if (name.width > w - 16) name.scale.set(Math.min(name.scale.x, (w - 16) / name.width));
  card.addChild(name);
  const pic = picture(false);
  card.addChild(new Graphics().circle(0, pic.y, pic.r).fill({ color: TINT[id], alpha: 0.22 }));
  const icon = catalystIcon(id);
  icon.position.set(0, pic.y);
  icon.scale.set(id === 'volatile' || id === 'wide' ? 1.1 : pic.scale);
  card.addChild(icon);
  const desc = descText(t(`alchemy.catalyst.${id}.desc`), 31);
  desc.anchor.set(0.5, 0);
  desc.position.set(0, pic.y + pic.r + 24);
  const room = CARD_H / 2 - 90 - desc.y;
  desc.scale.set(Math.min(1, room / desc.height, (w - 12) / desc.width));
  card.addChild(desc);
  if (held > 0) {
    const n = label(t('alchemy.catalyst.held', { n: held }), 34, { fill: P.brassDark });
    n.anchor.set(0.5);
    n.y = CARD_H / 2 - 48;
    card.addChild(n);
  }
  return card;
}

