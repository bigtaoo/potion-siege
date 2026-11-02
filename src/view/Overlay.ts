// Full-screen panels over the battle: the title, the skill pick and the end of a battle.
// The skill cards are in overlay/skillCard.ts, the result board's rows in overlay/endRows.ts.

import { Container, Graphics } from 'pixi.js';
import { t } from '../i18n';
import { ENDLESS_MILESTONES } from '../sim/endless';
import type { Reward } from '../sim/meta';
import type { SkillId, SkillLevels } from '../sim/skills';
import { LIGHT, lightPanel, plate, tappable } from './kit';
import { COLORS, label } from './ui';
import { DESIGN_H, DESIGN_W } from './viewport';
import { adButton } from './overlay/adButton';
import {
  challengeTrack,
  damageChart,
  endButtons,
  endlessHeader,
  endlessTrack,
  header,
  purse,
  ribbon,
  section,
  statTiles,
  tips,
  type Section,
} from './overlay/endRows';
import type { EndExtras } from './overlay/endTypes';
import { CardNudge, topTag } from './overlay/cardNudge';
import { starNotes } from './overlay/endStars';
import { skillCard } from './overlay/skillCard';
import { cardLook } from './overlay/cardFit';

/** The skill pick's box, centred on the page (shrunk to fit), which the tutorial keeps clear of. */
export const SKILL_BOX = { w: 1060, h: 1080 };

/** Laid out on the whole screen (see fitMenu): `w` x `h` page units, at least 1080x1920 on a
 *  phone and 1920x1080 on a wide screen, built again when the page size changes. */
export class Overlay extends Container {
  private w = DESIGN_W;
  private h = DESIGN_H;
  /** Builds the panel that is up again, for a new page size. */
  private redo: (() => void) | null = null;
  /** The hand over the suggested skill card, while the pick is up. */
  private nudge: CardNudge | null = null;
  /** The line under the cards on battle 3's first pick, once (game/battleTips.ts). */
  pickTip: (() => string) | null = null;

  constructor() {
    super();
    this.visible = false;
  }

  /** A new page size: the panel that is up is laid out again. */
  layout(w: number, h: number): void {
    if (Math.abs(w - this.w) < 1 && Math.abs(h - this.h) < 1) return;
    this.w = w;
    this.h = h;
    this.redo?.();
  }

  /** The panel that is up, built again as it is (the rest of the art came in). */
  rebuild(): void {
    this.redo?.();
  }

  hide(): void {
    this.visible = false;
    this.redo = null;
    this.nudge = null;
    this.removeChildren().forEach((c) => c.destroy({ children: true }));
  }

  private open(dim: number, redo: () => void): void {
    this.hide();
    this.visible = true;
    this.redo = redo;
    const shade = new Graphics().rect(0, 0, this.w, this.h).fill({ color: COLORS.dim, alpha: dim });
    shade.eventMode = 'static'; // swallow taps meant for the board
    this.addChild(shade);
  }

  /** A box centred on the page for content `w` x `h` across (centred on the box's origin),
   *  shrunk when the page is smaller than that. */
  private box(w: number, h: number): Container {
    const box = new Container();
    box.position.set(this.w / 2, this.h / 2);
    box.scale.set(Math.min(1, (this.w - 40) / w, (this.h - 40) / h));
    this.addChild(box);
    return box;
  }

  /** The hand over the suggested card, or the result's way on, taps on. */
  tick(dt: number): void {
    if (this.nudge && !this.nudge.destroyed) this.nudge.update(dt);
  }

  /** Three tall cards side by side, and under them the rewarded refresh when `onReroll` is
   *  given. `levels` says how far each skill has been taken. In the first battles the card at
   *  index `top` carries the "推荐" tag and, left alone, a hand tapping it. */
  showSkills(choices: SkillId[], levels: SkillLevels, title: string, onPick: (id: SkillId) => void, onReroll: (() => void) | null, top: number | null = null): void {
    this.open(0.7, () => this.showSkills(choices, levels, title, onPick, onReroll, top));
    const box = this.box(SKILL_BOX.w, SKILL_BOX.h);
    const head = plate(title, 54, 520, 'brass', SKILL_BOX.w - 120);
    head.y = -450;
    box.addChild(head);
    const gap = 340;
    // one size for every name and one for every description across the row
    const look = cardLook(choices);
    choices.forEach((id, i) => {
      const card = skillCard(id, levels[id], look);
      card.x = (i - (choices.length - 1) / 2) * gap;
      tappable(card, () => onPick(id));
      if (i === top) {
        const tag = topTag();
        tag.y = -320;
        card.addChild(tag);
      }
      box.addChild(card);
    });
    if (top !== null && top < choices.length) {
      this.nudge = new CardNudge((top - (choices.length - 1) / 2) * gap, 215); // on the pips, clear of the text
      box.addChild(this.nudge);
      if (this.pickTip) {
        const tip = label(this.pickTip(), 36, { wordWrap: true, wordWrapWidth: SKILL_BOX.w - 120, align: 'center' });
        tip.anchor.set(0.5);
        tip.y = 365; // between the cards and the refresh
        box.addChild(tip);
      }
    }
    if (onReroll) {
      const b = adButton(t('reroll'), 440, 130, 'purple', onReroll, 50);
      b.y = 460;
      box.addChild(b);
    }
  }

  /** The result on a walnut board: a plate saying won or lost, the wave, kills and time on
   *  parchment, the crystals it earned (with the rewarded ×2) and the first clear, each
   *  potion's share of the damage with the MVP, after a loss the tips for getting stronger,
   *  then the rewarded revive when there is one and Continue (to the home screen). On a wide
   *  screen the damage and the tips stand in a second column. */
  showEnd(won: boolean, stats: string, reward: Reward, onContinue: () => void, onRevive: (() => void) | null, more: EndExtras): void {
    this.open(0.72, () => this.showEnd(won, stats, reward, onContinue, onRevive, more));
    const W = 900;
    const cw = W - 120;
    const ch = more.challenge;
    const en = more.endless;
    const left: Section[] = [en ? endlessHeader(en) : header(won, ch, more.stars?.stars, more.stars?.hard), statTiles(stats, cw)];
    if (ch) left.push(challengeTrack(ch, cw));
    if (en) left.push(endlessTrack(en, cw));
    left.push(purse(reward, more, cw));
    if (en?.result.record) left.push(section(ribbon(t('endless.record'), W - 200), 110));
    if (en && en.result.milestones > 0) {
      const top = ENDLESS_MILESTONES.filter((s) => en.result.wave >= s.wave).pop();
      left.push(section(ribbon(`${t('endless.milestone', { n: top?.wave ?? en.result.wave })} ${t('reward', { n: en.result.milestones })}`, W - 200), 110));
    }
    if (ch && ch.streakBonus > 0) left.push(section(ribbon(`${t('challenge.streakBonus', { n: ch.streak })} ${t('reward', { n: ch.streakBonus })}`, W - 200), 110));
    if (reward.firstClear) left.push(section(ribbon(t('firstClear'), W - 200), 120));
    if (reward.chest) left.push(section(ribbon(t('chapter.cleared', { c: reward.chest }), W - 200), 110));
    for (const kind of reward.unlocked) left.push(section(ribbon(t('unlockHero', { name: t(`hero.${kind}`) }), W - 200), 110));
    left.push(...starNotes(more.stars, W - 200, !!more.starsTip));
    const right: Section[] = [];
    if (more.dealt.length > 0) right.push(damageChart(more.dealt, cw));
    const tipRows = more.onTip ? tips(more.onTip, more.dealt, cw, more.tipTabs, more.ready ?? null) : null;
    if (tipRows) right.push(tipRows);
    const buttons = endButtons(onContinue, onRevive, more.onNext ?? null, more.adBlocked);
    const wide = this.w > this.h && right.length > 0;
    const cols = wide ? [[...left, buttons], right] : [[...left, ...right, buttons]];
    const heights = cols.map((col) => col.reduce((a, c) => a + c.h, 0));
    const H = Math.max(...heights) + 80;
    const BW = W * cols.length;
    // room for the crest over the board: its top star stands about 130 over the board's top edge,
    // so a tall board (a challenge's track and ribbons) no longer pushes it off the screen
    const box = this.box(BW + 60, H + 280);
    box.y += 10;
    box.addChild(lightPanel(BW, H));
    if (wide) box.addChild(new Graphics().rect(-3, -H / 2 + 40, 6, H - 80).fill(LIGHT.seam));
    cols.forEach((col, i) => {
      const x = (i - (cols.length - 1) / 2) * W;
      // the second column sits in the middle of the board's height
      let y = -H / 2 + (i === 0 ? 0 : (H - heights[i]) / 2);
      for (const sec of col) {
        sec.c.position.set(x, y);
        box.addChild(sec.c);
        y += sec.h;
      }
    });
    const lit = tipRows?.lit;
    const wait = more.pointWait;
    if (wait != null && lit) {
      // a lost battle's tip to do first: the hand on its arrow
      this.nudge = new CardNudge(tipRows.c.x + cw / 2 - 46, tipRows.c.y + lit.y + 10, wait);
      box.addChild(this.nudge);
    } else if (wait != null) {
      // the hand's fingertip a little below the button's middle, over its words
      this.nudge = new CardNudge(buttons.c.x + buttons.main.x, buttons.c.y + buttons.main.y + 10, wait);
      box.addChild(this.nudge);
    }
  }
}
