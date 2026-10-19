// The skill pick's tall cards: name band, picture, what the skill does and its level pips.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../../i18n';
import { skillHeroes, skillMax, type SkillId } from '../../sim/skills';
import type { HeroKind } from '../../sim/types';
import { balanced, coinsIcon, LIGHT, medal, P, paperCard, stopwatchIcon, swordIcon, wallIcon } from '../kit';
import { iconTexture, ultimateTexture } from '../art';
import { HERO_COLORS, label } from '../ui';

const CARD_W = 320;
const CARD_H = 640;

/** A tall parchment card: the name on a band in its hero's colour (both colours for a recipe,
 *  brass for the skills every hero shares), the picture, what it does, and pips for how far
 *  it has been taken. */
export function skillCard(id: SkillId, level: number): Container {
  const card = new Container();
  const { hero, with: other } = skillHeroes(id);
  const top = -CARD_H / 2;
  const band = 130;
  const color = hero ? HERO_COLORS[hero] : P.brass;
  card.addChild(paperCard(CARD_W, CARD_H, 30));
  const g = new Graphics();
  const x = -CARD_W / 2 + 10;
  const w = CARD_W - 20;
  g.roundRect(x, top + 10, w, band, 22).fill(color);
  // a recipe's band turns into the second hero's colour along a slant
  if (other) g.poly([w / 2 - 10 + x + 40, top + 10, x + w - 22, top + 10, x + w, top + 32, x + w, top + 10 + band - 22, x + w - 22, top + 10 + band, x + w / 2 - 40, top + 10 + band]).fill(HERO_COLORS[other]);
  g.rect(x + 18, top + 18, w - 36, 10).fill({ color: 0xffffff, alpha: 0.35 });
  g.roundRect(x, top + 10, w, band, 22).stroke({ width: 4, color: LIGHT.edge });
  card.addChild(g);
  // wrapped only at spaces, and small enough that the longest word fits the band whole
  const title = t(`skill.${id}.name`);
  const longest = Math.max(...title.split(' ').map((word) => {
    const probe = label(word, 50, { stroke: { color: P.line, width: 6 } });
    const pw = probe.width;
    probe.destroy();
    return pw;
  }));
  const size = Math.min(50, Math.floor((50 * (w - 30)) / longest));
  const name = label(title, size, { wordWrap: true, breakWords: false, wordWrapWidth: w - 30, stroke: { color: P.line, width: 6 } });
  name.position.set(0, top + 10 + band / 2);
  if (name.height > band - 16) name.scale.set((band - 16) / name.height);
  card.addChild(name);

  const iy = top + band + 150;
  card.addChild(new Graphics().circle(0, iy, 118).fill({ color, alpha: 0.22 }));
  const icon = cardIcon(id, hero, other);
  if (icon) {
    icon.position.set(0, iy);
    icon.scale.set(1.25);
    card.addChild(icon);
  }
  if (other) {
    const tag = new Container();
    const text = label(t('recipe'), 32, { stroke: { color: P.line, width: 6 } });
    const tw = text.width + 40;
    tag.addChild(new Graphics().roundRect(-tw / 2, -24, tw, 48, 24).fill(0x8f5ce0).stroke({ width: 4, color: P.line }), text);
    tag.position.set(0, iy + 118);
    card.addChild(tag);
  }

  // the description keeps clear of the pips: a smaller size when it runs long
  const dy = iy + (other ? 160 : 140);
  const room = CARD_H / 2 - 62 - 14 - dy;
  let desc = balanced(t(`skill.${id}.desc`), 31, w - 40, { align: 'center', lineHeight: 40 });
  for (const ds of [28, 25]) {
    if (desc.height <= room) break;
    desc.destroy();
    desc = balanced(t(`skill.${id}.desc`), ds, w - 36, { align: 'center', lineHeight: Math.round(ds * 1.28) });
  }
  // a line with no break in it (a long Thai word) can still run wider than the wrap
  desc.scale.set(Math.min(1, room / desc.height, (w - 20) / desc.width));
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
      const fill = i < level ? P.brass : i === level ? 0x5cc66a : P.paperDark;
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
