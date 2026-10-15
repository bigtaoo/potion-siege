// Full-screen panels over the battle: the title, the home screen, the skill pick and the end
// of a battle.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../i18n';
import type { Reward } from '../sim/meta';
import type { HeroKind } from '../sim/types';
import { skillHeroes, skillMax, type SkillId, type SkillLevels } from '../sim/skills';
import { coinsIcon, inkWrapped, medal, P, paperCard, PillButton, plate, stopwatchIcon, swordIcon, tappable, wallIcon } from './kit';
import { iconTexture, ultimateTexture } from './art';
import { Button, COLORS, gem, HERO_COLORS, label } from './ui';
import { DESIGN_H, DESIGN_W } from './viewport';

export class Overlay extends Container {
  constructor() {
    super();
    this.visible = false;
  }

  hide(): void {
    this.visible = false;
    this.removeChildren().forEach((c) => c.destroy({ children: true }));
  }

  private open(dim: number): void {
    this.hide();
    this.visible = true;
    const shade = new Graphics().rect(-2000, -2000, DESIGN_W + 4000, DESIGN_H + 4000).fill({ color: COLORS.dim, alpha: dim });
    shade.eventMode = 'static'; // swallow taps meant for the board
    this.addChild(shade);
  }

  showTitle(best: number, onStart: () => void): void {
    this.open(0.55);
    const title = label(t('title'), 140, { fill: COLORS.gold });
    title.position.set(DESIGN_W / 2, 620);
    const tap = label(t('tapToStart'), 70);
    tap.position.set(DESIGN_W / 2, 1000);
    this.addChild(title, tap);
    if (best > 0) {
      const b = label(t('bestWave', { n: best }), 50);
      b.position.set(DESIGN_W / 2, 760);
      this.addChild(b);
    }
    const area = this.children[0];
    area.cursor = 'pointer';
    area.once('pointertap', onStart);
  }

  /** Three tall cards side by side, and under them the rewarded refresh when `onReroll` is
   *  given. `levels` says how far each skill has been taken. */
  showSkills(choices: SkillId[], levels: SkillLevels, title: string, onPick: (id: SkillId) => void, onReroll: (() => void) | null): void {
    this.open(0.7);
    const head = plate(title, 54, 520);
    head.position.set(DESIGN_W / 2, 560);
    this.addChild(head);
    const gap = 340;
    choices.forEach((id, i) => {
      const card = skillCard(id, levels[id]);
      card.position.set(DESIGN_W / 2 + (i - (choices.length - 1) / 2) * gap, 1010);
      tappable(card, () => onPick(id));
      this.addChild(card);
    });
    if (onReroll) {
      const b = new PillButton(t('reroll'), 440, 130, 'purple', onReroll, 50);
      // the ad sign in front of the caption
      b.children[1].x = 34;
      const ad = adSign();
      ad.position.set(-b.children[1].width / 2 - 14, -4);
      b.addChild(ad);
      b.position.set(DESIGN_W / 2, 1470);
      this.addChild(b);
    }
  }

  /** The result, the crystals it earned, and Continue (to the home screen); a revive offer
   *  when the battle was lost. */
  showEnd(won: boolean, stats: string, reward: Reward, onContinue: () => void, onRevive: (() => void) | null): void {
    this.open(0.65);
    const head = label(won ? t('won') : t('lost'), 110, { fill: won ? COLORS.gold : 0xff8a8a });
    head.position.set(DESIGN_W / 2, 600);
    const info = label(stats, 48);
    info.position.set(DESIGN_W / 2, 750);
    const purse = new Container();
    const count = label(t('reward', { n: reward.crystals }), 80, { fill: 0x9beaff });
    count.anchor.set(0, 0.5);
    count.x = 40;
    purse.addChild(gem(new Graphics(), 0, 0, 40), count);
    purse.position.set(DESIGN_W / 2 - (count.width + 40) / 2, 880);
    this.addChild(head, info, purse);
    if (reward.firstClear) {
      const first = label(t('firstClear'), 48, { fill: COLORS.gold });
      first.position.set(DESIGN_W / 2, 980);
      this.addChild(first);
    }
    const go = new Button(t('continue'), 620, 160, COLORS.button, onContinue, 60);
    go.position.set(DESIGN_W / 2, 1120);
    this.addChild(go);
    if (onRevive) {
      const revive = new Button(`▶ ${t('revive')}`, 620, 160, 0xd98b1f, onRevive, 52);
      revive.position.set(DESIGN_W / 2, 1320);
      this.addChild(revive);
    }
  }
}

const CARD_W = 320;
const CARD_H = 640;

/** A tall parchment card: the name on a band in its hero's colour (both colours for a recipe,
 *  brass for the skills every hero shares), the picture, what it does, and pips for how far
 *  it has been taken. */
function skillCard(id: SkillId, level: number): Container {
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
  g.roundRect(x, top + 10, w, band, 22).stroke({ width: 5, color: P.line });
  card.addChild(g);
  const name = label(t(`skill.${id}.name`), 50, { wordWrap: true, breakWords: true, wordWrapWidth: w - 30, stroke: { color: P.line, width: 8 } });
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

  const desc = inkWrapped(t(`skill.${id}.desc`), 31, w - 40, { align: 'center', lineHeight: 40 });
  desc.anchor.set(0.5, 0);
  desc.position.set(0, iy + (other ? 160 : 140));
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

/** The sign for "watch an ad": a little screen with a play arrow. */
function adSign(): Graphics {
  return new Graphics()
    .roundRect(-30, -22, 60, 44, 10)
    .fill(0xffd34d)
    .stroke({ width: 4, color: P.line })
    .poly([-8, -11, -8, 11, 12, 0])
    .fill(P.line);
}

const DRAWN_ICONS: Partial<Record<SkillId, () => Container>> = {
  allDamage: swordIcon,
  allSpeed: stopwatchIcon,
  gold: coinsIcon,
  wallRepair: wallIcon,
};

/** A card's picture: the bottle of the hero it belongs to (a recipe shows both), or the
 *  skill's own icon for the ones that serve every hero. */
function cardIcon(id: SkillId, hero?: HeroKind, other?: HeroKind): Container | null {
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
