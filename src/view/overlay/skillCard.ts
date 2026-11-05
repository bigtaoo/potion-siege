// The skill pick's tall cards: name band, picture, what the skill does and its level pips.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../../i18n';
import { boostedBy } from '../../sim/reactionPower';
import { skillHeroes, skillMax, skillRarity, type Rarity, type SkillId } from '../../sim/skills';
import type { HeroKind } from '../../sim/types';
import { coinsIcon, LIGHT, medal, P, paperCard, stopwatchIcon, swordIcon, wallIcon } from '../kit';
import { iconTexture, ultimateTexture } from '../art';
import { HERO_COLORS, label } from '../ui';
import { BAND, CARD_H, CARD_W, cardLook, descRoom, descText, picture, titleText, type CardLook } from './cardFit';


/** The frame round a card, by how strong it is: white, blue, purple, gold. */
export const RARITY_COLORS: Record<Rarity, number> = { common: 0xf4efe2, rare: 0x3f8fe6, epic: 0x9a5ce0, legend: 0xf2b632 };

/** A tall parchment card in a frame of its rarity's colour: the name on a band in its hero's
 *  colour (both colours for a recipe, brass for the skills every hero shares), the picture, what
 *  it does, and pips for how far it has been taken. `look`: the sizes the row it is in shares
 *  (cardFit.ts), its own when alone. */
export function skillCard(id: SkillId, level: number, look: CardLook = cardLook([id])): Container {
  const card = new Container();
  const { hero, with: other } = skillHeroes(id);
  const top = -CARD_H / 2;
  const band = BAND;
  const color = hero ? HERO_COLORS[hero] : P.brass;
  card.addChild(paperCard(CARD_W, CARD_H, 30));
  const rarity = skillRarity(id);
  const rim = new Graphics()
    .roundRect(-CARD_W / 2 - 4, top - 4, CARD_W + 8, CARD_H + 8, 34).stroke({ width: 10, color: RARITY_COLORS[rarity] })
    .roundRect(-CARD_W / 2 - 9, top - 9, CARD_W + 18, CARD_H + 18, 39).stroke({ width: 3, color: P.line });
  rim.label = `rarity_${rarity}`;
  card.addChild(rim);
  const g = new Graphics();
  const x = -CARD_W / 2 + 10;
  const w = CARD_W - 20;
  g.roundRect(x, top + 10, w, band, 22).fill(color);
  // a recipe's band turns into the second hero's colour along a slant
  if (other) g.poly([w / 2 - 10 + x + 40, top + 10, x + w - 22, top + 10, x + w, top + 32, x + w, top + 10 + band - 22, x + w - 22, top + 10 + band, x + w / 2 - 40, top + 10 + band]).fill(HERO_COLORS[other]);
  g.rect(x + 18, top + 18, w - 36, 10).fill({ color: 0xffffff, alpha: 0.35 });
  g.roundRect(x, top + 10, w, band, 22).stroke({ width: 4, color: LIGHT.edge });
  card.addChild(g);
  // wrapped only at spaces, at the row's size: small enough that every name's longest word fits
  const name = titleText(t(`skill.${id}.name`), look.title);
  name.position.set(0, top + 10 + band / 2);
  if (name.height > band - 16) name.scale.set((band - 16) / name.height);
  card.addChild(name);

  const pic = picture(look.small);
  const iy = pic.y;
  card.addChild(new Graphics().circle(0, iy, pic.r).fill({ color, alpha: 0.22 }));
  const icon = cardIcon(id, hero, other);
  if (icon) {
    icon.position.set(0, iy);
    icon.scale.set(pic.scale);
    card.addChild(icon);
  }
  // a legend recipe's tag names the reaction it boosts, on gold
  const rx = boostedBy(id);
  if (other) {
    const tag = new Container();
    const text = label(rx ? t('alchemy.legendBoost', { name: t(`codex.rx.${rx}`) }) : t('recipe'), 32, { stroke: { color: P.line, width: 6 } });
    if (text.width > w - 60) text.scale.set((w - 60) / text.width);
    const tw = text.width + 40;
    tag.addChild(new Graphics().roundRect(-tw / 2, -24, tw, 48, 24).fill(rx ? RARITY_COLORS.legend : 0x8f5ce0).stroke({ width: 4, color: P.line }), text);
    tag.label = rx ? `boosts_${rx}` : 'recipe';
    tag.position.set(0, iy + pic.r);
    card.addChild(tag);
  }

  // the description at the row's size, clear of the pips; only a line with no break in it (a
  // long Thai word) is ever shrunk
  const { y: dy, room } = descRoom(look.small, !!other);
  const desc = descText(t(`skill.${id}.desc`), look.desc);
  desc.scale.set(Math.min(1, room / desc.height, (w - 12) / desc.width));
  desc.anchor.set(0.5, 0);
  desc.position.set(0, dy);
  card.addChild(desc);

  // pips: brass for the levels already taken, green for the one this card adds
  const max = skillMax(id);
  if (max <= 5) {
    const pips = new Graphics();
    const step = 44;
    for (let i = 0; i < max; i++) {
      const px = (i - (max - 1) / 2) * step;
      const fill = i < level ? P.brass : i === level ? P.green : P.paperDark;
      pips.roundRect(px - 15, CARD_H / 2 - 62, 30, 30, 8).fill(fill).stroke({ width: 4, color: P.line });
    }
    card.addChild(pips);
  }
  return card;
}

const DRAWN_ICONS: Partial<Record<SkillId, () => Container>> = {
  allDamage: swordIcon,
  allSpeed: stopwatchIcon,
  gold: coinsIcon,
  wallRepair: wallIcon,
};

/** A card's picture: the bottle of the hero it belongs to (a recipe shows both), or the
 *  skill's own icon for the ones that serve every hero. */
export function cardIcon(id: SkillId, hero?: HeroKind, other?: HeroKind): Container | null {
  const c = new Container();
  const bottle = (kind: HeroKind, h: number, x: number, y: number) => {
    const tex = ultimateTexture(kind);
    if (!tex) return;
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(h / Math.max(tex.width, tex.height));
    s.position.set(x, y);
    c.addChild(s);
  };
  if (hero && other) {
    bottle(other, 140, -40, -14);
    bottle(hero, 150, 38, 14);
  } else if (hero) {
    bottle(hero, 190, 0, 0);
  } else {
    const tex = iconTexture(id);
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.scale.set(150 / tex.height);
      c.addChild(s);
    } else {
      // drawn until these get painted art of their own
      const drawn = DRAWN_ICONS[id];
      if (!drawn) return null;
      const icon = drawn();
      icon.scale.set(1.4);
      c.addChild(medal(78, P.paperDark), icon);
    }
  }
  return c;
}
