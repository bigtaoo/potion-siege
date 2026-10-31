// The last boss shown before it arrives (audit G3): once the free skill before the stage's last
// wave is picked (sim/bossPrep.ts), a card with the boss's dark silhouette and what it is weak
// to stays up for a moment while the wave walks in. (The HUD's newcomer card, Hud.showBoss, is
// for a boss's first wave, 5, long gone by then.)
import { Container, type Sprite } from 'pixi.js';
import { t } from '../i18n';
import type { Battle } from '../sim/battle';
import { resists } from '../sim/enemies';
import { isBoss, type BattleEvent, type BossKind } from '../sim/types';
import { enemySprite, fit, ink, lightTile, P } from './kit';
import { DESIGN_W } from './viewport';

/** Seconds the card stays, the last 0.3 fading. */
export const PREVIEW_SECONDS = 1.5;
const W = 760;
const H = 300;

export class BossPreview extends Container {
  /** The boss the free skill was offered for, until the pick lets the battle go on. */
  private due: BossKind | null = null;
  private time = 0;

  constructor(private readonly at = 850) {
    super();
    this.visible = false;
  }

  react(events: readonly BattleEvent[], b: Battle | null): void {
    for (const ev of events) {
      if (ev.type !== 'offer' || ev.reason !== 'boss' || !b) continue;
      this.due = (b.pending.find((s) => isBoss(s.kind))?.kind as BossKind | undefined) ?? null;
    }
  }

  update(dt: number, b: Battle | null): void {
    if (this.due && b && !b.paused) {
      this.build(this.due);
      this.due = null;
      this.time = PREVIEW_SECONDS;
    }
    if (!b || b.result) this.time = 0;
    this.time = Math.max(0, this.time - dt);
    this.visible = this.time > 0;
    this.alpha = Math.min(1, this.time / 0.3);
  }

  /** Clears what a battle left for the next. */
  reset(): void {
    this.due = null;
    this.time = 0;
    this.visible = false;
  }

  private build(kind: BossKind): void {
    this.removeChildren().forEach((c) => c.destroy({ children: true }));
    const weak = resists(kind).filter((r) => r.value > 1).map((r) => t(`hero.${r.element}`));
    const art = enemySprite(kind, 220, 240);
    for (const c of art.children) (c as Sprite).tint = 0x2a2230;
    art.position.set(-W / 2 + 150, 0);
    const tx = -W / 2 + 290;
    const room = W / 2 - 30 - tx;
    const head = fit(ink(t('bossComing'), 52), room);
    head.anchor.set(0, 0.5);
    head.position.set(tx, weak.length ? -40 : 0);
    this.addChild(lightTile(W, H, 28), art, head);
    if (weak.length) {
      const line = fit(ink(t('bossWeak', { weak: weak.join(t('listSep')) }), 38, { fill: P.redInk }), room);
      line.anchor.set(0, 0.5);
      line.position.set(tx, 40);
      this.addChild(line);
    }
    this.position.set(DESIGN_W / 2, this.at);
  }
}
