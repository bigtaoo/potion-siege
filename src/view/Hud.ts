// The battle's heads-up display: wave and gold at the top, the upgrade and summon buttons on
// either side of the commander at the bottom.

import { Container, Graphics } from 'pixi.js';
import { t } from '../i18n';
import type { Battle } from '../sim/battle';
import { BALANCE, type BattleEvent } from '../sim/types';
import { Button, COLORS, label } from './ui';
import { DESIGN_H, DESIGN_W } from './viewport';

const HINT_SECONDS = 25;
const BUTTON = { w: 320, h: 150, y: DESIGN_H - 120 };

export class Hud extends Container {
  private readonly coin = new Graphics();
  private readonly waveText = label('', 56);
  private readonly stageText = label('', 44, { fill: COLORS.gold });
  private readonly goldText = label('', 56, { fill: COLORS.gold });
  private readonly hintText = label(t('hint'), 36, { wordWrap: true, wordWrapWidth: 900 });
  private readonly banner = label('', 76, { fill: COLORS.gold });
  private readonly summonButton: Button;
  private readonly upgradeButton: Button;
  private bannerTime = 0;
  private battle: Battle | null = null;
  /** Off while the tutorial does the explaining. */
  hint = true;

  constructor(onSummon: () => void, onUpgrade: () => void) {
    super();
    this.upgradeButton = new Button('', BUTTON.w, BUTTON.h, 0x7a4fd0, onUpgrade, 46);
    this.upgradeButton.position.set(190, BUTTON.y);
    this.summonButton = new Button('', BUTTON.w, BUTTON.h, COLORS.button, onSummon, 46);
    this.summonButton.position.set(DESIGN_W - 190, BUTTON.y);
    this.waveText.position.set(DESIGN_W / 2, 60);
    this.stageText.anchor.set(1, 0.5);
    this.stageText.position.set(DESIGN_W - 50, 60);
    this.coin.circle(90, 60, 26).fill(COLORS.gold).stroke({ width: 5, color: 0x0a1320 });
    this.goldText.anchor.set(0, 0.5);
    this.goldText.position.set(130, 60);
    this.hintText.position.set(DESIGN_W / 2, 150);
    // high on the field, above where the enemies walk in, so it does not hide them
    this.banner.position.set(DESIGN_W / 2, 270);
    this.banner.alpha = 0;
    this.addChild(this.coin, this.waveText, this.stageText, this.goldText, this.hintText, this.banner, this.upgradeButton, this.summonButton);
  }

  attach(battle: Battle): void {
    this.battle = battle;
    this.bannerTime = 0;
    this.banner.alpha = 0;
    this.stageText.text = t('stage', { n: battle.setup.stage });
  }

  react(events: BattleEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'wave') this.show(ev.boss ? t('bossWave') : t('wave', { n: ev.wave, total: BALANCE.waves.count }));
    }
  }

  update(dt: number): void {
    const b = this.battle;
    if (!b) return;
    this.waveText.text = t('wave', { n: b.wave, total: BALANCE.waves.count });
    this.goldText.text = `${b.gold}`;
    this.summonButton.text.text = `${t('summon')}\n● ${b.summonCost()}`;
    this.summonButton.setEnabled(b.canSummon());
    this.upgradeButton.text.text = `${t('upgrade')}\n● ${b.upgradeCost()}`;
    this.upgradeButton.setEnabled(b.canUpgrade());
    this.hintText.visible = this.hint && b.time < HINT_SECONDS;

    this.bannerTime = b.paused ? 0 : Math.max(0, this.bannerTime - dt);
    this.banner.alpha = Math.min(1, this.bannerTime);
    this.banner.scale.set(1 + Math.max(0, this.bannerTime - 1.7) * 0.6);
  }

  /** Where a button is on the board, for the tutorial to point at. */
  buttonRect(which: 'summon' | 'upgrade'): { x: number; y: number; w: number; h: number } {
    const b = which === 'summon' ? this.summonButton : this.upgradeButton;
    return { x: b.x - BUTTON.w / 2, y: b.y - BUTTON.h / 2, w: BUTTON.w, h: BUTTON.h };
  }

  private show(text: string): void {
    this.banner.text = text;
    this.bannerTime = 2;
  }
}
