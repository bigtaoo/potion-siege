// Draws a battle (field, wall, enemies, shots, effects, the heroes on the wall) and turns drags
// between cells into moves and merges. The layers and effects are drawn in battleView/; this
// stacks them, turns the battle's events into effects and handles the touches.

import { Container, Graphics, Rectangle, type FederatedPointerEvent, type Text } from 'pixi.js';
import { t as tr } from '../i18n';
import { SLOT_COUNT, slotCenter, type Battle } from '../sim/battle';
import { mergeablePair } from '../sim/tutorial';
import { FP, TICK_RATE } from '../sim/math/fixed';
import { BALANCE, type BattleEvent } from '../sim/types';
import { SpriteLayer, loadField, potionLook } from './art';
import { HIT_TIME, chainBolt, gearBurst, glassShards, stunStars, gustWave, hitEffect, pushLines, rewindWave, vortexSwirl } from './effects';
import { PotionLayer, throwingHand } from './potion';
import { healthTube } from './stone';
import { DUST_TIME, RUSH_SHAKE, RushWatch, hordeDust } from './hordeFx';
import { COLORS, label } from './ui';
import { P } from './kit/palette';
import { DESIGN_W } from './viewport';
import { BADGE, BOMB_COLOR, BREW_COLOR, CMD, CommanderArt, onCommander } from './battleView/commander';
import { EnemyLayer } from './battleView/enemies';
import { brewLift, flaskBurst, landingMark } from './battleView/castFx';
import { FieldArt, fieldOf } from './battleView/field';
import { FIGURES, drawCell, type FigureAnim } from './battleView/figures';
import { Floaters } from './battleView/floaters';
import { KillFx } from './battleView/killFx';
import { FxLayer } from './battleView/fxLayer';
import { MergeAnims } from './battleView/merges';
import { ShotLayer } from './battleView/shots';
import { starMark } from './battleView/starMark';
import { BAR_H, BAR_Y, WALL_TOP, drawWallTop } from './battleView/wall';
import { reducedMotion } from './media';
import { keepUpright } from './landView';

const F = BALANCE.field;
const G = BALANCE.grid;
/** Seconds without touching the grid before a mergeable pair starts hopping. */
const HINT_AFTER = 5;
/** Seconds before a throw that the arm starts drawing back. */
const WIND_UP = 0.25;

/** What the view remembers about the hero in a cell, to animate its throws and arrival. */
interface CellAnim {
  id: number;
  shots: number;
  lastShot: number;
  born: number;
}

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
  private cellAnims: (CellAnim | null)[] = [];
  private readonly merges = new MergeAnims(this.fx);
  private readonly drag = new Graphics();
  private readonly wallText: Text;
  private readonly cmd = new CommanderArt();
  private readonly floaters = new Floaters();
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

  constructor() {
    super();
    this.wallText = label('', 40, { stroke: { color: P.umber, width: 6 } });
    this.addChild(this.field.ground, this.wall, this.enemies.marks.shadows, this.under, this.fx.ground, this.enemies.art, this.world, this.enemies.marks.bars, this.shots.art, this.fx.mid, this.grid, this.heroArt, this.potions, this.heroOver, this.fx.top, this.wallText, this.kills, this.floaters, this.drag, this.dragArt, this.dragPotions);
    this.addChildAt(this.cmd.count, this.children.indexOf(this.wallText));
    this.addChildAt(this.cmd.castTap, this.children.indexOf(this.wallText));
    this.field.build(this);
    this.eventMode = 'static';
    // the grid for the drags, and the commander for the casts
    const grid = new Rectangle(G.x0, G.y0, G.cellW * G.cols, G.cellH * G.rows);
    this.hitArea = { contains: (x: number, y: number) => grid.contains(x, y) || onCommander(x, y) };
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
    this.cellAnims = [];
    this.shots.clear();
    this.merges.clear();
    this.floaters.hideAll();
    this.kills.clear();
  }

  /** Grows the wall's numbers and the commander's count for a small board. */
  legible(k: number): void {
    this.wallText.scale.set(Math.min(k, 1.4));
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
          // the fire blast is wide, so it goes on the ground and the enemies in it stay visible
          this.fx.effect(HIT_TIME[ev.kind], (g, life) => hitEffect(g, ev.kind, ev.x, ev.y, ev.radius, 1 - life), ev.kind === 'fire');
          break;
        case 'chain': {
          const pts = ev.points;
          this.fx.effect(0.22, (g, life) => chainBolt(g, pts, life));
          break;
        }
        case 'shot': {
          const a = this.cellAnims[ev.slot];
          if (a) {
            a.shots++;
            a.lastShot = this.time;
            const h = this.battle?.slots[ev.slot];
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
          this.fx.burst(c.x, c.y, 80, COLORS.gold, 0.35);
          break;
        }
        case 'merge':
          // a dropped merge flashes once its potions have swirled together, see MergeAnims.swirls;
          // one the player did not drop (the bot's) flashes at once
          if (!this.merges.fusing(ev.slot)) this.merges.fused(this.battle, ev.slot);
          break;
        case 'cast': {
          // the commander draws back and flings a flask, or raises the brew over the wall
          const bomb = ev.skill === 'bomb';
          const color = bomb ? BOMB_COLOR : BREW_COLOR;
          this.cmd.cast = { at: this.time, skill: ev.skill };
          this.fx.burst(BADGE.x, BADGE.y, 110, color, 0.4);
          if (bomb) {
            this.cmd.thrown.push({ x: ev.x, y: ev.y, at: this.time, flight: ev.flight });
            landingMark(this.fx, ev.x, ev.y, BALANCE.commander.bomb.radius, ev.flight);
          } else {
            this.fx.effect(0.7, (g, life) => {
              g.circle(CMD.x, CMD.feet - CMD.height / 2, 120 + (1 - life) * 700).stroke({ width: 18 * life, color, alpha: life * 0.6 });
            }, true);
            const b = this.battle;
            if (b) brewLift(this.floaters, b.slots.flatMap((h, s) => (h && b.isOpen(s) ? [slotCenter(s)] : [])), Math.round(BALANCE.commander.brew.speed * 100));
          }
          this.floaters.show(tr(bomb ? 'castBomb' : 'castBrew'), DESIGN_W / 2, WALL_TOP - 60, color);
          break;
        }
        case 'flask': {
          // the flask bursts: a flash, a fireball, a ring, glass, and what each enemy took
          this.cmd.thrown.shift();
          flaskBurst(this.fx, this.floaters, ev.x, ev.y, ev.radius, ev.hits);
          this.shake = Math.max(this.shake, ev.hits.length > 0 ? 0.4 : 0.25);
          break;
        }
        case 'cellOpen': {
          this.cmd.pulse = 1;
          this.fx.burst(CMD.x, CMD.feet - CMD.height / 2, 150, COLORS.gold, 0.5);
          const c = slotCenter(ev.slot);
          this.fx.burst(c.x, c.y, 120, 0xffffff, 0.5);
          this.floaters.show(tr('cellOpen'), c.x, c.y, COLORS.gold);
          if (ev.last) this.floaters.show(tr('wallDone'), DESIGN_W / 2, WALL_TOP - 80, COLORS.gold);
          break;
        }
        case 'wallHit':
          this.shake = Math.max(this.shake, 0.08);
          break;
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
        case 'gust':
          this.fx.effect(0.5, (g, life) => gustWave(g, F.left, F.right, ev.y, ev.depth, 1 - life), true);
          break;
        case 'push': {
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
    const w = this.world.clear();
    const u = this.under.clear();
    this.enemies.draw(b, alpha, t, w, u);
    this.shots.draw(b, alpha, t, w);
    this.cmd.drawThrown(w, t, this.shots.art);
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
    this.wallText.position.set(DESIGN_W / 2, barY + BAR_H / 2);

    this.fx.update(dt);
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
    for (let s = 0; s < SLOT_COUNT; s++) {
      const h = b.slots[s];
      const c = slotCenter(s);
      const x = c.x - G.cellW / 2 + 8;
      const y = c.y - G.cellH / 2 + 8;
      const w = G.cellW - 16;
      const ht = G.cellH - 16;
      // while dragging, the heroes it can merge with glow and everything else steps back
      const match = from !== null && b.canMerge(from, s);
      const dim = from !== null && s !== from && !match;
      // cells not built yet are just ground
      if (!b.isOpen(s)) continue;
      if (match) g.roundRect(x - 10, y - 10, w + 20, ht + 20, 32).fill({ color: COLORS.gold, alpha: 0.3 + 0.2 * Math.sin(t * 10) });
      // the cell's slab is part of the wall (drawWall); an ultimate hero's is ringed in gold
      if (h && h.star >= BALANCE.maxStar) g.roundRect(x, y, w, ht, 12).stroke({ width: 6, color: COLORS.gold });
      if (match) g.roundRect(x, y, w, ht, 20).stroke({ width: 6, color: COLORS.gold });
      if (!h) {
        this.cellAnims[s] = null;
        continue;
      }
      // the commander's brew: every potion on the wall bubbles purple while it lasts
      if (b.brewTime > 0) {
        const fade = Math.min(1, b.brewTime / TICK_RATE / 0.5);
        g.ellipse(c.x, c.y + 38, 58 + 6 * Math.sin(t * 8 + s), 22).fill({ color: BREW_COLOR, alpha: 0.45 * fade });
        for (let i = 0; i < 3; i++) {
          const k = (t * 0.9 + i / 3 + s * 0.37) % 1;
          ho.circle(c.x + Math.sin(s * 3 + i * 2.1) * 40, c.y + 40 - k * 110, 7 * (1 - k) + 3).fill({ color: BREW_COLOR, alpha: (1 - k) * 0.8 * fade });
        }
      }
      let a = this.cellAnims[s];
      if (!a || a.id !== h.id) a = this.cellAnims[s] = { id: h.id, shots: 0, lastShot: -99, born: this.merges.bornAt(s, t) };
      // the figures of a cell take turns to throw; the next one draws back just before
      const cell = a;
      const n = h.star >= BALANCE.maxStar ? 1 : h.star;
      // the cooldown is in thousandths of a tick
      const left = h.cooldown / (TICK_RATE * 1000);
      // with nothing to shoot at the cooldown keeps resetting to a few hundredths: no wind-up then
      const wind = foes && left > 0 && left < WIND_UP ? 1 - left / WIND_UP : 0;
      const anim = (i: number): FigureAnim => ({
        wind: i === cell.shots % n ? wind : 0,
        since: cell.shots > 0 && i === (cell.shots - 1) % n ? t - cell.lastShot : Infinity,
        pop: t - cell.born,
      });
      const hop = hint?.includes(s) ? Math.abs(Math.sin(t * 7)) * 16 : 0;
      drawCell(this.time, g, ho, this.heroArt, this.potions, h.kind, h.star, c.x, c.y - 10 - hop, 1, s === from ? 0.35 : 1, s, dim, anim);
      if (h.stunTime) stunStars(ho, c.x, c.y - G.cellH / 2 - 6, t);
    }
    this.merges.swirls(g, ho, this.heroArt, this.potions, b, this.time);
    this.cmd.draw(g, ho, this.heroArt, b, dt, this.time);
    this.heroArt.end();
    this.potions.end();

    const d = this.drag.clear();
    this.dragArt.begin();
    this.dragPotions.begin();
    const held = from !== null ? b.slots[from] : null;
    if (held) drawCell(this.time, d, d, this.dragArt, this.dragPotions, held.kind, held.star, this.dragPos.x, this.dragPos.y, 1.15, 1, 0);
    this.merges.dives(d, this.dragArt, this.dragPotions, this.time);
    this.dragArt.end();
    this.dragPotions.end();
    keepUpright(this, this.wall);
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
    const p = this.toLocal(e.global);
    if (onCommander(p.x, p.y)) {
      if (this.battle?.canCast()) this.battle.cast();
      return;
    }
    const s = this.slotAt(e);
    this.idle = 0;
    if (s === null || !this.battle?.slots[s] || this.battle.paused) return;
    this.dragFrom = s;
    this.dragPos = this.toLocal(e.global);
  }

  private onMove(e: FederatedPointerEvent): void {
    if (this.dragFrom !== null) this.dragPos = this.toLocal(e.global);
  }

  private onUp(e: FederatedPointerEvent): void {
    if (this.dragFrom === null) return;
    const to = this.slotAt(e);
    const b = this.battle;
    if (to !== null && b) {
      const held = b.slots[this.dragFrom];
      if (held && b.canMerge(this.dragFrom, to)) this.merges.drop(this.dragFrom, to, held.kind, held.star, this.dragPos, this.time);
      b.move(this.dragFrom, to);
    }
    this.dragFrom = null;
  }
}
