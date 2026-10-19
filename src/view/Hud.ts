// The battle's heads-up display: wave and gold at the top, the upgrade and summon buttons on
// either side of the commander at the bottom.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t, type TextKey } from '../i18n';
import { slotCenter, type Battle } from '../sim/battle';
import type { ModifierId } from '../sim/challenge';
import { resists } from '../sim/enemies';
import { mergeablePair } from '../sim/tutorial';
import { BALANCE, BOSS_KINDS, ENEMY_KINDS, isBoss, type BattleEvent, type BossKind, type HeroKind } from '../sim/types';
import { bossForStage, endlessBoss, endlessChapter, FIRST_STAGE, FIRST_WAVE } from '../sim/waves';
import { handTexture } from './art';
import { bossTag, enemySprite, fit, ink, LIGHT, lightTile, modifierIcon, P } from './kit';
import { drawArc, pointingHand, quad } from './Tutorial';
import { Button, COLORS, label } from './ui';
import { DESIGN_H, DESIGN_W } from './viewport';

const HINT_SECONDS = 25;
/** The wave banner's height; a boss wave's goes down the field, out of the way of the boss
 *  coming in at the top, with the boss card under it. */
const BANNER_Y = 270;
const BOSS_BANNER_Y = 620;
const BOSS_CARD_Y = 850;
const BUTTON = { w: 320, h: 150, y: DESIGN_H - 120 };
/** How long the grid stays full with a pair to fuse and gold for a summon before the board
 *  points at the pair by itself. */
const NUDGE_AFTER = 2;

export class Hud extends Container {
  private readonly coin = new Graphics();
  private readonly waveText = label('', 56);
  private readonly stageText = label('', 44, { fill: COLORS.gold });
  private readonly goldText = label('', 56, { fill: COLORS.gold });
  /** The opening hint as a banner: cream words on a dark plate with a brass rim, under the wave line. */
  private readonly hintText = label(t('hint'), 46, { fill: 0xfff3d6, wordWrap: true, wordWrapWidth: 860, breakWords: true, align: 'center', lineHeight: 60 });
  private readonly hintPlate = new Graphics();
  private readonly hintBox = new Container();
  private hintSize = '';
  private readonly banner = label('', 76, { fill: COLORS.gold });
  /** Under the wave banner, on the wave a kind first comes in: its name and what it fears. */
  private readonly newcomer = label('', 44, { wordWrap: true, wordWrapWidth: 960, breakWords: true, align: 'center' });
  /** In a daily challenge, its modifiers as chips under the stage. */
  private readonly mods = new Container();
  private readonly summonButton: Button;
  private readonly upgradeButton: Button;
  private bannerTime = 0;
  /** The banner's size before its pop: small enough that a long line stays on the board at the pop's peak. */
  private bannerFit = 1;
  /** The small words' growth on a small board (see textBoost). */
  private boost = 1;
  private newcomerTime = 0;
  /** A new chapter boss's card: its art, name, what it does and what it is weak to. */
  private readonly bossCard = new Container();
  private battle: Battle | null = null;
  /** Off while the tutorial does the explaining. */
  hint = true;
  /** The full-grid pointer on the board; off while the tutorial points at things itself. */
  nudge = true;
  /** Around the two cells that could fuse while the grid is full: pulsing rings, the dragging
   *  arc and the tutorial's hand. Takes no taps, so the drag reaches the board under it. */
  private readonly nudgeRings = new Graphics();
  private readonly nudgeArc = new Graphics();
  private readonly nudgeHand = new Container();
  /** Seconds the grid has been full with a pair and gold for a summon; the pointer shows past NUDGE_AFTER. */
  private fullTime = 0;
  /** The player tapped the grey summon button on a full grid: point at once until a cell frees up. */
  private asked = false;
  private nudgeTime = 0;
  /** The summon button's shake after a tap on it while grey. */
  private shake = 0;

  constructor(onSummon: () => void, onUpgrade: () => void) {
    super();
    this.upgradeButton = new Button('', BUTTON.w, BUTTON.h, 0x7a4fd0, onUpgrade, 46);
    this.upgradeButton.position.set(190, BUTTON.y);
    this.summonButton = new Button('', BUTTON.w, BUTTON.h, COLORS.button, onSummon, 46, () => this.blocked());
    this.summonButton.position.set(DESIGN_W - 190, BUTTON.y);
    this.waveText.position.set(DESIGN_W / 2, 60);
    this.stageText.anchor.set(1, 0.5);
    this.stageText.position.set(DESIGN_W - 50, 60);
    this.coin.circle(90, 60, 26).fill(COLORS.gold).stroke({ width: 5, color: 0x0a1320 });
    this.goldText.anchor.set(0, 0.5);
    this.goldText.position.set(130, 60);
    // hung from its top, under the wave line, so a bigger hint grows down the field
    this.hintText.anchor.set(0.5, 0);
    this.hintBox.position.set(DESIGN_W / 2, 118);
    this.hintBox.addChild(this.hintPlate, this.hintText);
    // high on the field, above where the enemies walk in, so it does not hide them
    this.banner.position.set(DESIGN_W / 2, BANNER_Y);
    this.banner.alpha = 0;
    this.newcomer.position.set(DESIGN_W / 2, 370);
    this.newcomer.alpha = 0;
    for (const o of [this.nudgeRings, this.nudgeArc, this.nudgeHand]) o.eventMode = 'none';
    this.nudgeHand.addChild(pointingHand());
    this.nudgeHand.rotation = Math.PI - 0.35;
    this.addChild(this.coin, this.waveText, this.stageText, this.goldText, this.hintBox, this.banner, this.newcomer, this.bossCard, this.mods);
    this.addChild(this.nudgeRings, this.nudgeArc, this.nudgeHand, this.upgradeButton, this.summonButton);
  }

  attach(battle: Battle): void {
    this.battle = battle;
    this.bannerTime = 0;
    this.banner.alpha = 0;
    this.newcomerTime = 0;
    this.newcomer.alpha = 0;
    this.bossCard.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.stageText.text = battle.setup.endless ? t('endless.title') : t('stage', { n: battle.setup.stage });
    this.mods.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.fullTime = 0;
    this.asked = false;
    this.shake = 0;
  }

  /** Grows the small words for a small board; the hint wraps narrower to stay on it. */
  legible(k: number): void {
    if (k === this.boost) return;
    this.boost = k;
    const top = Math.min(k, 1.25);
    this.waveText.scale.set(top);
    this.stageText.scale.set(top);
    this.goldText.scale.set(top);
    this.goldText.x = 130 + (top - 1) * 30;
    this.coin.scale.set(top);
    this.coin.position.set(90 * (1 - top), 60 * (1 - top));
    this.hintBox.scale.set(Math.min(k, 1.3));
    this.hintBox.y = 118 + (top - 1) * 40;
    this.hintText.style.wordWrapWidth = 940 / Math.min(k, 1.3) - 80;
    this.newcomer.scale.set(Math.min(k, 1.3));
    this.newcomer.style.wordWrapWidth = 960 / Math.min(k, 1.3);
  }

  /** The challenge's modifiers, a chip each down the right under the stage; the hint line
   *  makes way for them. */
  showMods(ids: readonly ModifierId[], trial: HeroKind | null): void {
    this.mods.removeChildren().forEach((c) => c.destroy({ children: true }));
    ids.forEach((id, i) => {
      const chip = new Container();
      const name = fit(ink(t(`challenge.mod.${id}.name`), 28, { fontWeight: '900' }), 300);
      name.anchor.set(1, 0.5);
      const w = name.width + 92;
      const icon = modifierIcon(id, trial);
      icon.scale.set(0.42);
      icon.position.set(-w + 38, -2);
      name.position.set(-18, -1);
      const tile = lightTile(w, 56, 28);
      tile.x = -w / 2;
      const rim = new Graphics().roundRect(-w, -28, w, 56, 28).stroke({ width: 3, color: LIGHT.edge });
      chip.addChild(tile, rim, icon, name);
      chip.position.set(DESIGN_W - 36, 128 + i * 70);
      this.mods.addChild(chip);
    });
  }

  /** "Wave n/10", or just "Wave n" in endless mode, which has no last wave. */
  private waveLabel(n: number): string {
    return this.battle?.setup.endless ? t('waveEndless', { n }) : t('wave', { n, total: BALANCE.waves.count });
  }

  react(events: BattleEvent[]): void {
    for (const ev of events) {
      // the merge hint has done its job once the player merges
      if (ev.type === 'merge') this.hint = false;
      if (ev.type !== 'wave') continue;
      this.show(ev.boss ? t('bossWave') : this.waveLabel(ev.wave), ev.boss ? BOSS_BANNER_Y : BANNER_Y);
      const stage = this.battle?.setup.stage;
      // endless mode brings in every other chapter's boss in turn: each gets its card on its first lap
      const visitor = this.battle?.setup.endless && ev.boss ? endlessBoss(ev.wave) : undefined;
      const firstLap = ev.wave - BALANCE.waves.count <= (BOSS_KINDS.length - 1) * BALANCE.endless.bossEvery;
      const kind =
        visitor && visitor !== bossForStage(BALANCE.endless.stage)
          ? firstLap ? visitor : undefined
          : ENEMY_KINDS.find((k) => FIRST_STAGE[k] > 1 && FIRST_STAGE[k] === stage && FIRST_WAVE[k] === ev.wave);
      if (kind) {
        const weak = resists(kind).filter((r) => r.value > 1).map((r) => t(`hero.${r.element}`));
        if (isBoss(kind)) {
          this.newcomer.text = '';
          this.showBoss(kind, weak.join(t('listSep')));
        } else this.newcomer.text = t('newEnemy', { name: t(`enemy.${kind}`), weak: weak.join(t('listSep')) });
        this.newcomerTime = 5;
      } else if (this.battle?.setup.endless && ev.wave > 1 && endlessChapter(ev.wave) !== endlessChapter(ev.wave - 1)) {
        // endless mode moves on to the next chapter's field: say where
        this.newcomer.text = t('endlessChapter', { name: t(`chapter.name.${BALANCE.chapters[endlessChapter(ev.wave) - 1].id}` as TextKey) });
        this.newcomerTime = 5;
      }
    }
  }

  private showBoss(kind: BossKind, weak: string): void {
    const c = this.bossCard;
    c.removeChildren().forEach((o) => o.destroy({ children: true }));
    const w = 860;
    const h = 250;
    const art = enemySprite(kind, 200, 220);
    art.position.set(-w / 2 + 130, 0);
    const tag = bossTag(22);
    tag.position.set(-w / 2 + 130, h / 2 - 26);
    const tx = -w / 2 + 250;
    const room = w / 2 - 30 - tx;
    const head = fit(ink(t('bossNew'), 26, { fill: LIGHT.edge }), room);
    const name = fit(ink(t(`enemy.${kind}`), 48), room);
    const lines = [head, name];
    if (kind !== 'boss') lines.push(fit(ink(t(`codex.trait.${kind}`), 28), room));
    lines.push(fit(ink(t('bossWeak', { weak }), 28, { fill: 0xb23a2a }), room));
    c.addChild(lightTile(w, h, 28), art, tag);
    lines.forEach((l, i) => {
      l.anchor.set(0, 0.5);
      l.position.set(tx, -h / 2 + 40 + i * 56);
      c.addChild(l);
    });
    // under the BOSS WAVE banner
    c.position.set(DESIGN_W / 2, BOSS_CARD_Y);
  }

  update(dt: number): void {
    const b = this.battle;
    if (!b) return;
    this.waveText.text = this.waveLabel(b.wave);
    this.goldText.text = `${b.gold}`;
    // a full grid says so on the button, and what to do about it, rather than just going grey
    const full = !b.paused && !b.result && b.freeSlots().length === 0;
    const pair = full ? mergeablePair(b) : null;
    this.summonButton.text.text = full ? t(pair ? 'full.merge' : 'full.upgrade') : `${t('summon')}\n● ${b.summonCost()}`;
    this.summonButton.setEnabled(b.canSummon());
    this.shake = Math.max(0, this.shake - dt);
    this.summonButton.x = DESIGN_W - 190 + Math.sin(this.shake * 60) * 14 * (this.shake / 0.35);
    if (!full) this.asked = false;
    this.fullTime = pair && b.gold >= b.summonCost() ? this.fullTime + dt : 0;
    this.pointAt(this.nudge && pair && (this.asked || this.fullTime >= NUDGE_AFTER) ? pair : null, dt);
    this.upgradeButton.text.text = `${t('upgrade')}\n● ${b.upgradeCost()}`;
    this.upgradeButton.setEnabled(b.canUpgrade());
    for (const btn of [this.summonButton, this.upgradeButton]) {
      // as big as the boost asks while the caption still fits on the button
      const raw = btn.text.scale.x;
      const w = btn.text.width / raw;
      const h = btn.text.height / raw;
      btn.text.scale.set(Math.min(this.boost, (BUTTON.w - 36) / w, (BUTTON.h - 12) / h));
    }
    // the opening hint, or a word on what to do while the board points at a pair
    const pointing = this.nudgeHand.visible;
    const opening = this.hint && b.seconds < HINT_SECONDS;
    this.hintBox.visible = (pointing || opening) && this.mods.children.length === 0;
    const words = pointing ? t('full.hint') : t('hint');
    if (this.hintText.text !== words) this.hintText.text = words;
    if (this.hintBox.visible) this.fitHint();
    // the opening one fades out over its last second
    this.hintBox.alpha = pointing ? 1 : Math.min(1, HINT_SECONDS - b.seconds);

    this.bannerTime = b.paused ? 0 : Math.max(0, this.bannerTime - dt);
    this.banner.alpha = Math.min(1, this.bannerTime);
    this.banner.scale.set(this.bannerFit * (1 + Math.max(0, this.bannerTime - 1.7) * 0.6));
    this.newcomerTime = b.paused ? this.newcomerTime : Math.max(0, this.newcomerTime - dt);
    this.newcomer.alpha = Math.min(1, this.newcomerTime);
    this.bossCard.alpha = this.newcomer.alpha;
    this.bossCard.scale.set(1 + Math.max(0, this.newcomerTime - 4.8) * 0.8);
  }

  /** A tap on the grey summon button: it shakes, and on a full grid the board points at a pair. */
  private blocked(): void {
    this.shake = 0.35;
    const b = this.battle;
    if (b && !b.paused && b.freeSlots().length === 0) this.asked = true;
  }

  /** The pointer over the two cells of `pair` (design units), or hidden when it is null: the
   *  tutorial's merge look, its hand dragging along an arc from one to the other. */
  private pointAt(pair: [number, number] | null, dt: number): void {
    this.nudgeRings.visible = this.nudgeArc.visible = this.nudgeHand.visible = pair !== null;
    if (!pair) {
      this.nudgeTime = 0;
      return;
    }
    // the painted glove once it has loaded
    if (handTexture() && !(this.nudgeHand.children[0] instanceof Sprite)) {
      this.nudgeHand.removeChildren().forEach((c) => c.destroy());
      this.nudgeHand.addChild(pointingHand());
    }
    const s = (this.nudgeTime += dt);
    const g = BALANCE.grid;
    const [from, to] = pair.map((slot) => slotCenter(slot));
    const pulse = 0.5 + 0.5 * Math.sin(s * 5);
    const r = this.nudgeRings.clear();
    for (const c of [from, to]) {
      const x = c.x - g.cellW / 2 - 10;
      const y = c.y - g.cellH / 2 - 10;
      r.roundRect(x, y, g.cellW + 20, g.cellH + 20, 30).stroke({ width: 10, color: P.brassLight, alpha: 0.35 + 0.55 * pulse });
      r.roundRect(x, y, g.cellW + 20, g.cellH + 20, 30).stroke({ width: 3, color: LIGHT.edge, alpha: 0.6 });
    }
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 - 0.25 * Math.hypot(to.x - from.x, to.y - from.y) };
    drawArc(this.nudgeArc.clear(), from, mid, to);
    // drags along the arc, then lifts and starts again
    const cycle = (s % 1.8) / 1.8;
    const k = Math.min(1, Math.max(0, (cycle - 0.15) / 0.65));
    const p = quad(from, mid, to, k * k * (3 - 2 * k));
    this.nudgeHand.position.set(p.x, p.y);
    this.nudgeHand.alpha = cycle > 0.9 ? 1 - (cycle - 0.9) * 10 : Math.min(1, cycle * 10);
    this.nudgeHand.scale.set(cycle < 0.15 ? 1.08 - cycle * 0.5 : 1);
  }

  /** The hint's plate around its words, drawn again when they wrap differently. */
  private fitHint(): void {
    const w = this.hintText.width + 64;
    const h = this.hintText.height + 30;
    const size = `${Math.round(w)}x${Math.round(h)}`;
    if (size === this.hintSize) return;
    this.hintSize = size;
    this.hintText.y = 15;
    this.hintPlate.clear().roundRect(-w / 2, 0, w, h, 28).fill({ color: 0x14202c, alpha: 0.82 }).stroke({ width: 5, color: P.brass });
  }

  /** Where a button is on the board, for the tutorial to point at. */
  buttonRect(which: 'summon' | 'upgrade'): { x: number; y: number; w: number; h: number } {
    const b = which === 'summon' ? this.summonButton : this.upgradeButton;
    return { x: b.x - BUTTON.w / 2, y: b.y - BUTTON.h / 2, w: BUTTON.w, h: BUTTON.h };
  }

  /** A line in the wave banner's place, e.g. the tutorial saying it did a step. */
  say(text: string): void {
    this.show(text);
  }

  private show(text: string, y = BANNER_Y): void {
    this.banner.text = text;
    this.banner.y = y;
    this.banner.scale.set(1);
    this.bannerFit = Math.min(1, (DESIGN_W - 40) / (this.banner.width * 1.18));
    this.bannerTime = 2;
  }
}
