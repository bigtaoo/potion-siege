// Draws a battle (field, wall, enemies, shots, effects, the heroes on the wall) and turns drags
// between cells into moves and merges. The layers and effects are drawn in battleView/; this
// stacks them, turns the battle's events into effects and handles the touches.

import { Container, Graphics, Rectangle, type FederatedPointerEvent, type Text } from 'pixi.js';
import { t as tr } from '../i18n';
import { SLOT_COUNT, slotCenter, type Battle } from '../sim/battle';
import { mergeablePair } from '../sim/tutorial';
import { FP, TICK_RATE } from '../sim/math/fixed';
import { BALANCE, type BattleEvent, type EnemyKind } from '../sim/types';
import { SpriteLayer, loadField, potionLook } from './art';
import { HIT_TIME, beamLine, chainBolt, gearBurst, glassShards, gustWave, hitEffect, pushLines, rewindWave, vortexSwirl } from './effects';
import { PotionLayer, throwingHand } from './potion';
import { healthTube } from './stone';
import { DUST_TIME, RUSH_SHAKE, RushWatch, hordeDust } from './hordeFx';
import { COLORS, label } from './ui';
import { P } from './kit/palette';
import { DESIGN_W } from './viewport';
import { CommanderArt, badgeAt, commanderMid, onCommander } from './battleView/commander';
import { CastAim } from './battleView/castAim';
import { SPELL_COLOR, SPELL_WORD } from './battleView/spellLook';
import { EnemyLayer } from './battleView/enemies';
import { acidPool, acidSplash, flaskBurst, frostBurst, landingMark } from './battleView/castFx';
import { FieldArt, fieldOf } from './battleView/field';
import { FIGURES, drawCell } from './battleView/figures';
import { FLIGHT, HeroCells } from './battleView/heroCells';
import { BLOWS_PER_FRAME, HEAVY, wallBlow } from './battleView/wallBlows';
import { Floaters } from './battleView/floaters';
import { KillFx } from './battleView/killFx';
import { ReactionFx } from './battleView/reactionFx';
import { FxLayer } from './battleView/fxLayer';
import { MergeAnims } from './battleView/merges';
import { ShotLayer } from './battleView/shots';
import { starMark } from './battleView/starMark';
import { BAR_H, BAR_Y, WALL_TOP, drawWallTop } from './battleView/wall';
import { reducedMotion } from './media';
import { isLand, keepUpright } from './landView';

const F = BALANCE.field;
const G = BALANCE.grid;
/** Seconds without touching the grid before a mergeable pair starts hopping. */
const HINT_AFTER = 5;
/** The room between a turned field's wall bar and its numbers beside it. */
const LAND_NUMBERS_GAP = 18;

export class BattleView extends Container {
  private readonly field = new FieldArt();
  private readonly grid = new Graphics();
  private readonly under = new Graphics();
  /** The wall's top, under the enemies so they stand behind its merlons' shadows. */
  private readonly wall = new Graphics();
  /** The open cells the wall was drawn for, one bit each. */
  private wallKey = -1;
  /** The wall's hit points and maximum its label shows. */
  private wallShown = [-1, -1];
  private readonly enemies = new EnemyLayer();
  private readonly world = new Graphics();
  private readonly heroArt = new SpriteLayer();
  private readonly potions = new PotionLayer();
  private readonly shots = new ShotLayer();
  private readonly heroOver = new Graphics();
  private readonly dragArt = new SpriteLayer();
  private readonly dragPotions = new PotionLayer();
  private readonly fx = new FxLayer();
  private readonly merges = new MergeAnims(this.fx);
  private readonly heroes = new HeroCells(this.merges);
  private readonly drag = new Graphics();
  private readonly wallText: Text;
  private readonly cmd = new CommanderArt();
  private readonly aim = new CastAim();
  private readonly floaters = new Floaters();
  private readonly reactions = new ReactionFx();
  /** The coins flying off each kill and the kill streak; `kills.landed` is the HUD's to set. */
  readonly kills = new KillFx();
  private dragFrom: number | null = null;
  private dragPos = { x: 0, y: 0 };
  private shake = 0;
  /** Whether the screen shakes at all: the player's setting (view/media.shakeOn). */
  shakes: () => boolean = () => true;
  /** When the rushes of the horde (the first wave) come in, each with a cloud of dust. */
  private rushes = new RushWatch();
  private battle: Battle | null = null;
  private time = 0;
  private idle = 0;
  /** Enemy blows on the wall so far this frame. */
  private blows = 0;

  constructor() {
    super();
    this.wallText = label('', 40, { stroke: { color: P.umber, width: 6 } });
    this.addChild(this.field.ground, this.wall, this.enemies.marks.shadows, this.under, this.fx.ground, this.enemies.dead, this.enemies.art, this.enemies.flash, this.world, this.enemies.marks.bars, this.shots.art, this.fx.mid, this.grid, this.heroArt, this.potions, this.heroOver, this.fx.top, this.aim.g, this.wallText, this.kills, this.floaters, this.drag, this.dragArt, this.dragPotions);
    this.addChildAt(this.cmd.count, this.children.indexOf(this.wallText));
    this.addChildAt(this.cmd.castTap, this.children.indexOf(this.wallText));
    this.addChildAt(this.cmd.hints, this.children.indexOf(this.wallText));
    this.field.build(this);
    this.enemies.onBlow = (x, y, r, kind) => this.blow(x, y, r, kind);
    this.eventMode = 'static';
    // the grid for the drags, the commander for the casts, everything while a spell is picked up
    const grid = new Rectangle(G.x0, G.y0, G.cellW * G.cols, G.cellH * G.rows);
    this.hitArea = { contains: (x: number, y: number) => this.aim.active || grid.contains(x, y) || onCommander(x, y) };
    this.on('pointerdown', (e) => this.onDown(e));
    this.on('globalpointermove', (e) => this.onMove(e));
    this.on('pointerup', (e) => this.onUp(e));
    this.on('pointerupoutside', (e) => this.onUp(e));
  }

  /** Whether the wall's tube shows where three stars end: on a stage battle not revived (app.ts). */
  starMark: () => boolean = () => false;

  attach(battle: Battle): void {
    this.battle = battle;
    this.field.reset();
    this.field.show(fieldOf(battle));
    this.fx.clear();
    this.dragFrom = null;
    this.cmd.reset();
    this.aim.reset();
    this.heroes.clear();
    this.shots.clear();
    this.merges.clear();
    this.floaters.hideAll();
    this.kills.clear();
    this.reactions.clear();
  }

  /** Lets the field and the floor reach past the board's ends into the screen's spare room. */
  reach(top: number, bottom: number): void {
    this.field.reach(top, bottom);
  }

  /** Grows the wall's numbers and the commander's count for a small board. */
  legible(k: number): void {
    // on a turned field they stand in the strip behind the bar, no wider than it
    this.wallText.scale.set(Math.min(k, isLand() ? 1.1 : 1.4));
    this.cmd.legible(k);
  }

  /** Turns battle events into short-lived effects. */
  react(events: BattleEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'wave':
          if (this.battle?.setup.endless) {
            if (fieldOf(this.battle, ev.wave) !== this.field.key) this.field.show(fieldOf(this.battle, ev.wave), true);
            // the next band's field, so it is in by the time the battle gets there
            void loadField(fieldOf(this.battle, ev.wave + BALANCE.endless.chapterEvery));
          }
          break;
        case 'hit':
          this.enemies.tracks.strike(ev.x, ev.y, ev.radius);
          // the fire blast is wide, so it goes on the ground and the enemies in it stay visible
          this.fx.effect(HIT_TIME[ev.kind], (g, life) => hitEffect(g, ev.kind, ev.x, ev.y, ev.radius, 1 - life), ev.kind === 'fire');
          break;
        case 'beam': {
          const { x1, y1, x2, y2 } = ev;
          this.enemies.tracks.strike(x1, y1, 24);
          this.fx.effect(0.25, (g, life) => beamLine(g, x1, y1, x2, y2, life));
          this.fx.effect(HIT_TIME.light, (g, life) => hitEffect(g, 'light', x1, y1, 30, 1 - life));
          break;
        }
        case 'chain': {
          const pts = ev.points;
          for (const p of pts) this.enemies.tracks.strike(p.x, p.y, 20);
          this.fx.effect(0.22, (g, life) => chainBolt(g, pts, life));
          break;
        }
        case 'shot': {
          const b = this.battle;
          const p = b?.projectiles.find((o) => o.id === ev.projectile);
          const c = slotCenter(ev.slot);
          // the battle time at the start of the tick it threw in, where the frame after begins
          const a = b && this.heroes.shot(ev.slot, (b.time - 1) / TICK_RATE, p ? p.tx / FP : c.x, p ? p.ty / FP : 0);
          if (a) {
            const h = b.slots[ev.slot];
            const look = h && potionLook(h.kind);
            if (h && look && h.star < BALANCE.maxStar) {
              // the figure that just threw, and where its hand is
              const { spots, height } = FIGURES[h.star - 1];
              const [sx, sy] = spots[(a.shots - 1) % h.star];
              const hand = throwingHand(look, height * 1.05);
              this.shots.launch(ev.projectile, sx + hand.x, 40 + sy + hand.y, this.time);
            }
          }
          break;
        }
        case 'kill':
          this.enemies.tracks.died(ev.x, ev.y);
          this.fx.effect(ev.boss ? 0.9 : 0.6, (g, life) => gearBurst(g, ev.x, ev.y, ev.boss, 1 - life));
          if (ev.boss) {
            if (ev.gold > 0) this.floaters.show(`+${ev.gold}`, ev.x, ev.y, COLORS.gold);
            this.shake = 0.5;
          } else if (this.kills.kill(ev.x, ev.y, ev.gold)) this.shake = Math.max(this.shake, 0.12);
          break;
        case 'summon': {
          const c = slotCenter(ev.slot);
          // the commander nods its flask at each summon
          this.cmd.nod = this.time;
          this.heroes.summoned(ev.slot, this.time);
          // it leaves the flask in a flash and lands in its cell in another
          const m = commanderMid();
          this.fx.burst(m.x, m.y, 60, COLORS.gold, 0.25);
          const land = FLIGHT / (FLIGHT + 0.35);
          this.fx.effect(FLIGHT + 0.35, (g, life) => {
            if (life < 1 - land) g.circle(c.x, c.y, 80 * (1.2 - life * 0.5)).fill({ color: COLORS.gold, alpha: (life / (1 - land)) * 0.45 });
          });
          break;
        }
        case 'merge':
          // a dropped merge flashes once its potions have swirled together, see MergeAnims.swirls;
          // one the player did not drop (the bot's) flashes at once
          if (!this.merges.fusing(ev.slot)) this.merges.fused(this.battle, ev.slot);
          break;
        case 'cast': {
          // the commander draws back and flings the flask at its mark
          const color = SPELL_COLOR[ev.skill];
          this.cmd.cast = { at: this.time, skill: ev.skill };
          const badge = badgeAt();
          this.fx.burst(badge.x, badge.y, 110, color, 0.4);
          this.cmd.thrown.push({ x: ev.x, y: ev.y, at: this.time, flight: ev.flight, skill: ev.skill });
          landingMark(this.fx, ev.x, ev.y, BALANCE.commander[ev.skill].radius, ev.flight, color);
          this.floaters.show(tr(SPELL_WORD[ev.skill]), DESIGN_W / 2, WALL_TOP - 60, color);
          break;
        }
        case 'flask': {
          // the flask comes down: the bomb's fire, the frost's cold, the acid's splash
          this.cmd.thrown.shift();
          if (ev.skill === 'bomb') flaskBurst(this.fx, this.floaters, ev.x, ev.y, ev.radius, ev.hits);
          else if (ev.skill === 'frost') frostBurst(this.fx, ev.x, ev.y, ev.radius, ev.hits);
          else acidSplash(this.fx, ev.x, ev.y, ev.radius);
          this.shake = Math.max(this.shake, ev.skill === 'bomb' && ev.hits.length > 0 ? 0.4 : 0.25);
          break;
        }
        case 'cellOpen': {
          this.cmd.pulse = 1;
          const mid = commanderMid();
          this.fx.burst(mid.x, mid.y, 150, COLORS.gold, 0.5);
          const c = slotCenter(ev.slot);
          this.fx.burst(c.x, c.y, 120, 0xffffff, 0.5);
          this.floaters.show(tr('cellOpen'), c.x, c.y, COLORS.gold);
          if (ev.last) this.floaters.show(tr('wallDone'), DESIGN_W / 2, WALL_TOP - 80, COLORS.gold);
          break;
        }
        case 'rewind':
          this.fx.effect(0.7, (g, life) => rewindWave(g, ev.x, ev.y, ev.radius, 1 - life), true);
          break;
        case 'brood':
          // the pendulum door bangs open and the mice tumble out at its feet
          this.fx.burst(ev.x, ev.y + 40, 110, 0xd9a441, 0.4);
          break;
        case 'jar':
          if (ev.up) this.fx.burst(ev.x, ev.y - 120, 170, 0x8fe6f0, 0.5);
          else {
            // the bell jar bursts into glass
            const { x, y } = ev;
            this.fx.effect(0.6, (g, life) => glassShards(g, x, y - 120, 1 - life));
            this.shake = Math.max(this.shake, 0.15);
          }
          break;
        case 'leap':
          this.fx.burst(ev.x, ev.y + 60, 90, 0xb8a07a, 0.35);
          break;
        case 'slam': {
          // the anvil comes down on the wall: the potions under it see stars
          this.shake = Math.max(this.shake, 0.35);
          this.fx.burst(ev.x, ev.y + 60, 160, 0xff7a2a, 0.4);
          for (const slot of ev.slots) {
            const c = slotCenter(slot);
            this.fx.burst(c.x, c.y, 100, 0xffe25a, 0.35);
          }
          break;
        }
        case 'crack': {
          // the rim shatters off the gear king and the crowned core runs on
          const { x, y } = ev;
          this.fx.effect(0.9, (g, life) => gearBurst(g, x, y, true, 1 - life));
          this.fx.burst(x, y - 100, 200, 0xb58cff, 0.5);
          this.shake = Math.max(this.shake, 0.4);
          break;
        }
        case 'reaction':
          this.reactions.show(this.fx, this.floaters, ev.id, ev.x, ev.y, ev.radius, this.battle?.setup.mastery?.[ev.id]);
          break;
        case 'gust':
          this.fx.effect(0.5, (g, life) => gustWave(g, F.left, F.right, ev.y, ev.depth, 1 - life), true);
          break;
        case 'push': {
          this.enemies.tracks.pushed(ev.id);
          // the lines trail the enemy as it flies back
          const e = this.battle?.enemies.find((o) => o.id === ev.id);
          const r = e ? e.radius / FP : 36;
          this.fx.effect(0.35, (g, life) => pushLines(g, e ? e.x / FP : ev.x, e ? e.y / FP : ev.y, r, 1 - life));
          break;
        }
      }
    }
  }

  /** Draws the battle `alpha` of the way through its last tick (see FixedStep). */
  update(dt: number, alpha = 1): void {
    const b = this.battle;
    if (!b) return;
    if (this.rushes.arrived(b)) {
      this.shake = Math.max(this.shake, RUSH_SHAKE);
      this.fx.effect(DUST_TIME, hordeDust, true);
    }
    this.shake = Math.max(0, this.shake - dt);
    const k = this.shakes() ? this.shake * 40 : 0;
    this.position.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    this.merges.soft = reducedMotion();

    this.time += dt;
    this.field.update(dt);
    const t = this.time;
    // the battle's own clock, between its ticks: it stops with the battle and keeps its pace
    const bt = Math.max(0, (b.time - 1 + alpha) / TICK_RATE);
    this.blows = 0;
    const w = this.world.clear();
    const u = this.under.clear();
    this.enemies.soft = reducedMotion();
    this.enemies.draw(b, alpha, bt, t, w, u);
    this.shots.draw(b, alpha, t, w);
    this.cmd.drawThrown(w, t, this.shots.art);
    this.aim.draw(b);
    this.shots.art.end();
    // wall health
    const frac = Math.max(0, b.wall / b.wallMax);
    const barY = BAR_Y;
    healthTube(w, F.left, barY, F.right - F.left, BAR_H, frac);
    if (this.starMark()) starMark(w, F.left, barY, F.right - F.left, BAR_H, frac);
    const hp = Math.ceil(Math.max(0, b.wall) / FP);
    const max = Math.round(b.wallMax / FP);
    if (hp !== this.wallShown[0] || max !== this.wallShown[1]) {
      this.wallShown[0] = hp;
      this.wallShown[1] = max;
      this.wallText.text = `${hp} / ${max}`;
    }
    // on a turned field the bar stands upright on the screen, too thin for the numbers across it:
    // they read up along its top end, just beside it (the view's y runs leftward there), well clear
    // of the commander, so they read as the bar's and not its count (keepUpright keeps this turn)
    const land = isLand();
    this.wallText.rotation = land ? -Math.PI / 2 : 0;
    const numbers = land ? { x: F.left + LAND_NUMBERS_GAP + this.wallText.width / 2, y: barY + BAR_H + LAND_NUMBERS_GAP + this.wallText.height / 2 } : { x: DESIGN_W / 2, y: barY + BAR_H / 2 };
    this.wallText.position.set(numbers.x, numbers.y);

    this.fx.update(dt);
    for (const p of b.pools) acidPool(this.fx.ground, p.x / FP, p.y / FP, BALANCE.commander.acid.radius, t, Math.min(1, p.time / TICK_RATE / 0.5));
    for (const v of b.vortices) vortexSwirl(this.fx.ground, v.x / FP, v.y / FP, BALANCE.skills.vortexRadius, t, Math.min(1, v.time / TICK_RATE / 0.4));
    this.floaters.update(dt);
    this.kills.update(dt);

    const g = this.grid.clear();
    const ho = this.heroOver.clear();
    this.heroArt.begin();
    this.potions.begin();
    const from = this.dragFrom;
    this.idle = from !== null || b.paused ? 0 : this.idle + dt;
    const hint = this.idle > HINT_AFTER ? mergeablePair(b) : null;
    this.drawWall(b);
    const foes = b.enemies.some((e) => e.hp > 0);
    this.heroes.draw(b, g, ho, this.heroArt, this.potions, t, bt, from, hint, foes);
    this.merges.swirls(g, ho, this.heroArt, this.potions, b, this.time);
    this.cmd.aiming = this.aim.active;
    this.cmd.draw(g, ho, this.heroArt, b, dt, this.time);
    this.heroArt.end();
    this.potions.end();

    const d = this.drag.clear();
    this.dragArt.begin();
    this.dragPotions.begin();
    const held = from !== null ? b.slots[from] : null;
    if (held) {
      const anim = this.heroes.held(this.dragPos, dt);
      drawCell(this.time, d, d, this.dragArt, this.dragPotions, held.kind, held.star, this.dragPos.x, this.dragPos.y, 1.15, 1, 0, false, () => anim);
    }
    this.merges.dives(d, this.dragArt, this.dragPotions, this.time);
    this.dragArt.end();
    this.dragPotions.end();
    keepUpright(this, this.wall);
  }

  /** An enemy's blow lands on the wall: dust and chips for the first few a frame, and a heavy
   *  one's shakes the screen a little. */
  private blow(x: number, y: number, r: number, kind: EnemyKind): void {
    if (this.blows++ >= BLOWS_PER_FRAME) return;
    wallBlow(this.fx, x, y, r, kind);
    if (HEAVY.has(kind)) this.shake = Math.max(this.shake, 0.06);
  }

  /** The wall from above, redrawn only when a cell is built (see drawWallTop). */
  private drawWall(b: Battle): void {
    let key = 0;
    for (let s = 0; s < SLOT_COUNT; s++) if (b.open[s]) key |= 1 << s;
    if (key === this.wallKey) return;
    this.wallKey = key;
    drawWallTop(this.wall.clear(), b);
  }

  private slotAt(e: FederatedPointerEvent): number | null {
    const p = this.toLocal(e.global);
    const col = Math.floor((p.x - G.x0) / G.cellW);
    const row = Math.floor((p.y - G.y0) / G.cellH);
    if (col < 0 || col >= G.cols || row < 0 || row >= G.rows) return null;
    return row * G.cols + col;
  }

  private onDown(e: FederatedPointerEvent): void {
    if (this.aim.down(this.battle, this.toLocal(e.global))) return;
    const s = this.slotAt(e);
    this.idle = 0;
    if (s === null || !this.battle?.slots[s] || this.battle.paused) return;
    this.dragFrom = s;
    this.dragPos = this.toLocal(e.global);
    this.heroes.drop(this.dragPos);
  }

  private onMove(e: FederatedPointerEvent): void {
    if (this.aim.active) this.aim.move(this.toLocal(e.global));
    if (this.dragFrom !== null) this.dragPos = this.toLocal(e.global);
  }

  private onUp(e: FederatedPointerEvent): void {
    this.aim.up(this.battle, this.toLocal(e.global), e.pointerType === 'mouse');
    if (this.dragFrom === null) return;
    const to = this.slotAt(e);
    const b = this.battle;
    if (to !== null && b) {
      const held = b.slots[this.dragFrom];
      const there = b.slots[to];
      if (held && b.canMerge(this.dragFrom, to)) this.merges.drop(this.dragFrom, to, held.kind, held.star, this.dragPos, this.time);
      else if (held && to !== this.dragFrom && b.isOpen(to)) {
        // moved, or swapped with the one there: each lands in its new cell
        this.heroes.moved(held.id, this.time);
        if (there) this.heroes.moved(there.id, this.time);
        const c = slotCenter(to);
        this.fx.burst(c.x, c.y + 40, 50, 0xd8c8a8, 0.25);
      }
      b.move(this.dragFrom, to);
    }
    this.dragFrom = null;
  }
}
