// Full-screen panels over the battle: the title, the home screen, the skill pick and the end
// of a battle.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../i18n';
import type { MetaSave, Reward } from '../sim/meta';
import type { SkillId } from '../sim/skills';
import { iconTexture } from './art';
import { buildHome, type HomeActions } from './Home';
import { Button, COLORS, gem, label } from './ui';
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

  showHome(m: MetaSave, act: HomeActions): void {
    this.open(0.82);
    this.addChild(buildHome(m, act));
  }

  showSkills(choices: SkillId[], title: string, onPick: (id: SkillId) => void): void {
    this.open(0.6);
    const head = label(title, 64, { fill: COLORS.gold, wordWrap: true, wordWrapWidth: 980 });
    head.position.set(DESIGN_W / 2, 520);
    this.addChild(head);
    choices.forEach((id, i) => {
      const card = new Container();
      card.position.set(DESIGN_W / 2, 760 + i * 280);
      const bg = new Graphics()
        .roundRect(-430, -115, 860, 230, 36)
        .fill(COLORS.card)
        .stroke({ width: 6, color: COLORS.gold, alpha: 0.7 });
      const name = label(t(`skill.${id}.name`), 60, { fill: COLORS.gold });
      name.position.set(0, -42);
      const desc = label(t(`skill.${id}.desc`), 42, { wordWrap: true, wordWrapWidth: 800 });
      desc.position.set(0, 40);
      card.addChild(bg, name, desc);
      const tex = iconTexture(id);
      if (tex) {
        // icon on the left, text shifted right of it
        const icon = new Sprite(tex);
        icon.anchor.set(0.5);
        icon.scale.set(150 / tex.height);
        icon.position.set(-330, 0);
        name.x = desc.x = 80;
        desc.style.wordWrapWidth = 620;
        card.addChild(icon);
      }
      card.eventMode = 'static';
      card.cursor = 'pointer';
      card.once('pointertap', () => onPick(id));
      this.addChild(card);
    });
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
