// Full-screen panels over the battle: the title, the skill pick and the end of a battle.
// The skill cards are in overlay/skillCard.ts, the result board's rows in overlay/endRows.ts.

import { Container, Graphics } from 'pixi.js';
import { t } from '../i18n';
import { ENDLESS_MILESTONES } from '../sim/endless';
import type { Reward } from '../sim/meta';
import type { SkillId, SkillLevels } from '../sim/skills';
import { LIGHT, lightPanel, plate, tappable } from './kit';
import { COLORS } from './ui';
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
import { skillCard } from './overlay/skillCard';

/** The skill pick's box, centred on the page (shrunk to fit), which the tutorial keeps clear of. */
export const SKILL_BOX = { w: 1060, h: 1080 };

/** Laid out on the whole screen (see fitMenu): `w` x `h` page units, at least 1080x1920 on a
 *  phone and 1920x1080 on a wide screen, built again when the page size changes. */
export class Overlay extends Container {
  private w = DESIGN_W;
  private h = DESIGN_H;
  /** Builds the panel that is up again, for a new page size. */
  private redo: (() => void) | null = null;

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

  /** Three tall cards side by side, and under them the rewarded refresh when `onReroll` is
   *  given. `levels` says how far each skill has been taken. */
  showSkills(choices: SkillId[], levels: SkillLevels, title: string, onPick: (id: SkillId) => void, onReroll: (() => void) | null): void {
    this.open(0.7, () => this.showSkills(choices, levels, title, onPick, onReroll));
    const box = this.box(SKILL_BOX.w, SKILL_BOX.h);
    const head = plate(title, 54, 520, 'brass', SKILL_BOX.w - 120);
    head.y = -450;
    box.addChild(head);
    const gap = 340;
    choices.forEach((id, i) => {
      const card = skillCard(id, levels[id]);
      card.x = (i - (choices.length - 1) / 2) * gap;
      tappable(card, () => onPick(id));
      box.addChild(card);
    });
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
    const left: Section[] = [en ? endlessHeader(en) : header(won, ch), statTiles(stats, cw)];
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
    const right: Section[] = [];
    if (more.dealt.length > 0) right.push(damageChart(more.dealt, cw));
    if (more.onTip) right.push(tips(more.onTip, more.dealt, cw));
    const buttons = endButtons(onContinue, onRevive, more.onNext ?? null);
    const wide = this.w > this.h && right.length > 0;
    const cols = wide ? [[...left, buttons], right] : [[...left, ...right, buttons]];
    const heights = cols.map((col) => col.reduce((a, c) => a + c.h, 0));
    const H = Math.max(...heights) + 80;
    const BW = W * cols.length;
    const box = this.box(BW + 60, H + 220);
    box.y += 40; // room for the crest over the board
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
  }
}
