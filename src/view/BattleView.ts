// Draws a battle (field, wall, enemies, shots, effects, the heroes on the wall) and turns drags
// between cells into moves and merges.

import { Container, Graphics, Rectangle, Sprite, type FederatedPointerEvent, type Text, type Texture } from 'pixi.js';
import { t as tr } from '../i18n';
import { SLOT_COUNT, slotCenter, type Battle } from '../sim/battle';
import { mergeablePair } from '../sim/tutorial';
import { FP, TICK_RATE, ticks, toFp } from '../sim/math/fixed';
import { BRAD_FULL } from '../sim/math/trig';
import { BALANCE, type BattleEvent, type Enemy, type HeroKind } from '../sim/types';
import { SpriteLayer, commanderTexture, enemyTexture, fieldTexture, figureTexture, potionLook, ultimateTexture } from './art';
import { HIT_TIME, chainBolt, gearBurst, glassShards, stunStars, gustWave, hitEffect, iceShell, pushLines, rewindWave, vortexSwirl } from './effects';
import { INK, PotionLayer, popScale, recoil, throwingHand } from './potion';
import { healthTube, innerFace, slab, summonCircle, wallTop, workshopFloor, type WallColumn } from './stone';
import { ENEMY_ART, drawEnemy, drawHero, drawProjectile, heroShadow } from './shapes';
import { COLORS, label } from './ui';
import { lerpX, lerpY } from './fixedStep';
import { DESIGN_H, DESIGN_W } from './viewport';

const F = BALANCE.field;
const G = BALANCE.grid;
const C = BALANCE.commander;
/** Where the commander stands: feet on this point, below the wall between the two buttons. */
const CMD = { x: C.x, feet: C.y, height: 180 };
/** Front of the thinnest wall (the bottom row only), and the wall's back edge. */
const WALL_TOP = G.y0 + G.cellH * (G.rows - 1) - F.parapet;
const WALL_BOTTOM = G.y0 + G.cellH * G.rows;
/** How far down the field art reaches; the wall covers its bottom. */
const FIELD_H = WALL_BOTTOM;
/** Design y where the wall's inner face ends and the workshop floor starts. */
const FLOOR_Y = 1672;
/** Where the figures of a level 1-3 cell stand, back to front, and how tall they are. */
const FIGURES: { spots: [number, number][]; height: number }[] = [
  { spots: [[0, 0]], height: 92 },
  { spots: [[-28, 0], [28, 0]], height: 80 },
  { spots: [[0, -22], [-30, 8], [30, 8]], height: 74 },
];
/** The wall's health bar, set into the wall's inner face. */
const BAR_H = 30;
const BAR_Y = WALL_BOTTOM + 16;
const ULTIMATE_HEIGHT = 150;
/** Wide ultimates (arms spread out) are drawn shorter so they stay inside their cell. */
const ULTIMATE_WIDTH = 155;
/** Seconds without touching the grid before a mergeable pair starts hopping. */
const HINT_AFTER = 5;
/** Seconds a merge spends pouring one potion into the other before the result pops out. */
const POUR = 0.35;
/** Seconds before a throw that the arm starts drawing back. */
const WIND_UP = 0.25;
/** Seconds a thrown vial takes to drift from the hand onto its true path. */
const LEAVE_HAND = 0.15;

/** Farther enemies first, so nearer ones overlap them. */
const byDepth = (p: Enemy, q: Enemy): number => p.y - q.y;

/** How a figure is moving: drawing back to throw (0-1), seconds since it threw, since it appeared. */
interface FigureAnim {
  wind: number;
  since: number;
  pop: number;
}
const STILL: FigureAnim = { wind: 0, since: Infinity, pop: Infinity };

/** What the view remembers about the hero in a cell, to animate its throws and arrival. */
interface CellAnim {
  id: number;
  shots: number;
  lastShot: number;
  born: number;
}

interface Effect {
  ttl: number;
  max: number;
  draw: (g: Graphics, life: number) => void;
  /** Drawn above the heroes instead of under them. */
  top?: boolean;
  /** Drawn on the ground, under the enemies. */
  ground?: boolean;
}

export class BattleView extends Container {
  private readonly ground = new Graphics();
  private readonly grid = new Graphics();
  private readonly under = new Graphics();
  /** The wall's top, under the enemies so they stand behind its merlons' shadows. */
  private readonly wall = new Graphics();
  private wallKey = '';
  private readonly enemyArt = new SpriteLayer();
  private readonly world = new Graphics();
  private readonly heroArt = new SpriteLayer();
  private readonly potions = new PotionLayer();
  private readonly shotArt = new SpriteLayer();
  private readonly heroOver = new Graphics();
  private readonly dragArt = new SpriteLayer();
  private readonly dragPotions = new PotionLayer();
  private readonly fx = new Graphics();
  private readonly fxGround = new Graphics();
  private readonly fxTop = new Graphics();
  private cellAnims: (CellAnim | null)[] = [];
  /** Thrown vials still leaving the hand: how far the hand was from where the sim spawned them. */
  private launches = new Map<number, { dx: number; dy: number; at: number }>();
  /** Merges still pouring: the potion poured, into which slot, when it started. */
  private pours: { slot: number; kind: HeroKind; star: number; start: number }[] = [];
  private readonly drag = new Graphics();
  private readonly wallText: Text;
  private readonly cmdNext = label('', 34, { stroke: { color: 0x3e3128, width: 5 } });
  private cmdPulse = 0;
  /** The small words' growth on a small board (see textBoost). */
  private boost = 1;
  /** The gold and notes that float up; hidden ones are reused. */
  private readonly floaters = new Container();
  /** The enemies in drawing order, refilled every frame. */
  private readonly depth: Enemy[] = [];
  /** The enemies as drawn: world units, between their last two ticks; reused every frame. */
  private readonly drawn: Enemy[] = [];
  private fxList: Effect[] = [];
  private dragFrom: number | null = null;
  private dragPos = { x: 0, y: 0 };
  private shake = 0;
  private battle: Battle | null = null;
  private time = 0;
  private idle = 0;

  constructor() {
    super();
    this.wallText = label('', 40, { stroke: { color: 0x3e3128, width: 6 } });
    this.addChild(this.ground, this.wall, this.under, this.fxGround, this.enemyArt, this.world, this.shotArt, this.fx, this.grid, this.heroArt, this.potions, this.heroOver, this.fxTop, this.wallText, this.floaters, this.drag, this.dragArt, this.dragPotions);
    this.cmdNext.position.set(CMD.x, CMD.feet - CMD.height - 22);
    this.addChildAt(this.cmdNext, this.children.indexOf(this.wallText));
    this.drawGround();
    this.eventMode = 'static';
    this.hitArea = new Rectangle(G.x0, G.y0, G.cellW * G.cols, G.cellH * G.rows);
    this.on('pointerdown', (e) => this.onDown(e));
    this.on('globalpointermove', (e) => this.onMove(e));
    this.on('pointerup', (e) => this.onUp(e));
    this.on('pointerupoutside', (e) => this.onUp(e));
  }

  attach(battle: Battle): void {
    this.battle = battle;
    this.fxList = [];
    this.dragFrom = null;
    this.cmdPulse = 0;
    this.cellAnims = [];
    this.launches.clear();
    this.pours = [];
    for (const f of this.floaters.children) f.visible = false;
  }

  /** Turns battle events into short-lived effects. */
  /** Grows the wall's numbers and the commander's count for a small board. */
  legible(k: number): void {
    this.boost = k;
    this.wallText.scale.set(Math.min(k, 1.4));
    this.cmdNext.scale.set(k);
  }

  react(events: BattleEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'hit':
          // the fire blast is wide, so it goes on the ground and the enemies in it stay visible
          this.effect(HIT_TIME[ev.kind], (g, life) => hitEffect(g, ev.kind, ev.x, ev.y, ev.radius, 1 - life), ev.kind === 'fire');
          break;
        case 'chain': {
          const pts = ev.points;
          this.effect(0.22, (g, life) => chainBolt(g, pts, life));
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
              for (const [id, l] of this.launches) if (this.time - l.at > LEAVE_HAND) this.launches.delete(id);
              this.launches.set(ev.projectile, { dx: sx + hand.x, dy: 40 + sy + hand.y, at: this.time });
            }
          }
          break;
        }
        case 'kill':
          this.effect(ev.boss ? 0.9 : 0.6, (g, life) => gearBurst(g, ev.x, ev.y, ev.boss, 1 - life));
          this.floater(`+${ev.gold}`, ev.x, ev.y, COLORS.gold);
          if (ev.boss) this.shake = 0.5;
          break;
        case 'summon':
        case 'merge': {
          const c = slotCenter(ev.slot);
          // a poured merge bursts when the pour ends, see drawPours()
          if (!this.pours.some((p) => p.slot === ev.slot)) this.burst(c.x, c.y, ev.type === 'merge' ? 110 : 80, COLORS.gold, 0.35);
          break;
        }
        case 'cellOpen': {
          this.cmdPulse = 1;
          this.burst(CMD.x, CMD.feet - CMD.height / 2, 150, COLORS.gold, 0.5);
          const c = slotCenter(ev.slot);
          this.burst(c.x, c.y, 120, 0xffffff, 0.5);
          this.floater(tr('cellOpen'), c.x, c.y, COLORS.gold);
          if (ev.last) this.floater(tr('wallDone'), DESIGN_W / 2, WALL_TOP - 80, COLORS.gold);
          break;
        }
        case 'wallHit':
          this.shake = Math.max(this.shake, 0.08);
          break;
        case 'rewind':
          this.effect(0.7, (g, life) => rewindWave(g, ev.x, ev.y, ev.radius, 1 - life), true);
          break;
        case 'brood':
          // the pendulum door bangs open and the mice tumble out at its feet
          this.burst(ev.x, ev.y + 40, 110, 0xd9a441, 0.4);
          break;
        case 'jar':
          if (ev.up) this.burst(ev.x, ev.y - 120, 170, 0x8fe6f0, 0.5);
          else {
            // the bell jar bursts into glass
            const { x, y } = ev;
            this.effect(0.6, (g, life) => glassShards(g, x, y - 120, 1 - life));
            this.shake = Math.max(this.shake, 0.15);
          }
          break;
        case 'leap':
          this.burst(ev.x, ev.y + 60, 90, 0xb8a07a, 0.35);
          break;
        case 'slam': {
          // the anvil comes down on the wall: the potions under it see stars
          this.shake = Math.max(this.shake, 0.35);
          this.burst(ev.x, ev.y + 60, 160, 0xff7a2a, 0.4);
          for (const slot of ev.slots) {
            const c = slotCenter(slot);
            this.burst(c.x, c.y, 100, 0xffe25a, 0.35);
          }
          break;
        }
        case 'crack': {
          // the rim shatters off the gear king and the crowned core runs on
          const { x, y } = ev;
          this.effect(0.9, (g, life) => gearBurst(g, x, y, true, 1 - life));
          this.burst(x, y - 100, 200, 0xb58cff, 0.5);
          this.shake = Math.max(this.shake, 0.4);
          break;
        }
        case 'gust':
          this.effect(0.5, (g, life) => gustWave(g, F.left, F.right, ev.y, ev.depth, 1 - life), true);
          break;
        case 'push': {
          // the lines trail the enemy as it flies back
          const e = this.battle?.enemies.find((o) => o.id === ev.id);
          const r = e ? e.radius / FP : 36;
          this.effect(0.35, (g, life) => pushLines(g, e ? e.x / FP : ev.x, e ? e.y / FP : ev.y, r, 1 - life));
          break;
        }
      }
    }
  }

  /** Draws the battle `alpha` of the way through its last tick (see FixedStep). */
  update(dt: number, alpha = 1): void {
    const b = this.battle;
    if (!b) return;
    this.shake = Math.max(0, this.shake - dt);
    this.position.set((Math.random() - 0.5) * this.shake * 40, (Math.random() - 0.5) * this.shake * 40);

    this.time += dt;
    const t = this.time;
    const w = this.world.clear();
    const u = this.under.clear();
    this.enemyArt.begin();
    const depth = this.depth;
    depth.length = 0;
    for (let i = 0; i < b.enemies.length; i++) {
      const e = b.enemies[i];
      // a fresh copy for a new enemy: a boss's optional fields (shield, core...) must not linger
      let o = this.drawn[i];
      if (!o || o.id !== e.id) o = this.drawn[i] = { ...e };
      else Object.assign(o, e);
      o.x = lerpX(e, alpha);
      o.y = lerpY(e, alpha);
      o.radius = e.radius / FP;
      depth.push(o);
    }
    depth.sort(byDepth);
    for (const e of depth) {
      const tex = enemyTexture(e.kind, e);
      if (!tex) {
        drawEnemy(w, e);
        continue;
      }
      drawEnemy(u, e, 'under');
      drawEnemy(w, e, 'over');
      // waddle: hop and sway, out of step with each other, faster walkers taking quicker steps
      const step = t * 9 * Math.sqrt(BALANCE.enemies[e.kind].speed / BALANCE.enemies.grunt.speed) + e.id * 1.7;
      const feet = e.y + e.radius * ENEMY_ART.feet;
      let s: Sprite;
      if (e.kind === 'flyer') {
        // up in the air over its shadow: it bobs with the wingbeat and leans into its swing
        const beat = Math.sin(t * 14 + e.id * 1.7);
        s = this.enemyArt.put(tex, e.x, feet - e.radius * ENEMY_ART.lift - beat * 6, e.radius * ENEMY_ART.height);
        s.scale.y *= 0.97 + beat * 0.03;
        s.rotation = e.atWall ? 0 : Math.cos((((e.phase ?? 0) / BRAD_FULL) * 2 * Math.PI) + b.seconds * BALANCE.flyer.weaveRate) * 0.14;
      } else if (e.kind === 'winder') {
        // eight legs: a quick low scuttle, and a jolt each time it winds the others back
        const jolt = Math.max(0, (e.windTime ?? 0) / TICK_RATE - (BALANCE.winder.every - 0.3)) / 0.3;
        const hop = Math.abs(Math.sin(step * 2)) * 0.35;
        s = this.enemyArt.put(tex, e.x, feet - hop * 8, e.radius * ENEMY_ART.height * (1 + jolt * 0.12));
        s.rotation = Math.sin(step * 2) * 0.03;
      } else if (e.kind === 'anvil') {
        // on its spring: it crouches before a leap, sails up in an arc, and squashes as it lands
        const A = BALANCE.bosses.anvil;
        const flight = ticks(A.leapTime);
        const up = e.leapTime ? Math.sin(Math.PI * (1 - e.leapTime / flight)) : 0;
        const crouch = !e.leapTime && !e.atWall && e.hopTime !== undefined && e.hopTime < 8 ? 1 - e.hopTime / 8 : 0;
        const bob = Math.abs(Math.sin(step * 1.5)) * 0.4;
        s = this.enemyArt.put(tex, e.x, feet - up * 130 - bob * 6, e.radius * ENEMY_ART.height);
        s.scale.y *= 1 - crouch * 0.18 + up * 0.1;
        s.scale.x *= 1 + crouch * 0.1 - up * 0.05;
        s.rotation = 0;
      } else if (e.kind === 'gear') {
        // the cog rolls from side to side; the bare core scurries on its legs
        const core = !!e.core;
        const hop = Math.abs(Math.sin(step * (core ? 2 : 1)));
        s = this.enemyArt.put(tex, e.x, feet - hop * (core ? 10 : 4), e.radius * ENEMY_ART.height * (core ? 0.8 : 1));
        s.rotation = core ? Math.sin(step * 2) * 0.06 : Math.sin(step * 0.8) * 0.12;
      } else {
        // the tank rolls on tracks: no steps, only a rumble
        const tracks = e.kind === 'boss';
        const hop = tracks ? Math.abs(Math.sin(step * 3)) * 0.3 : Math.abs(Math.sin(step));
        s = this.enemyArt.put(tex, e.x, feet - hop * 8, e.radius * ENEMY_ART.height);
        s.rotation = tracks ? 0 : Math.cos(step) * 0.07;
        s.scale.y *= tracks ? 1 : 0.96 + hop * 0.06;
      }
      if (e.freezeTime > 0) iceShell(w, e.x, e.y + e.radius * ENEMY_ART.feet, e.radius * 2.3, e.radius * ENEMY_ART.height * 0.92);
      s.tint = e.freezeTime > 0 ? 0x9fe8ff : e.slowTime > 0 ? 0xc4dcff : e.burnTime > 0 ? 0xffb27a : e.chargeTime > 0 ? 0xfff2a0 : e.markTime > 0 ? 0xdcb8ff : e.rust > 0 ? 0xe0a878 : e.poisonTime > 0 ? 0xc8f0a0 : 0xffffff;
    }
    depth.length = 0;
    this.enemyArt.end();
    this.shotArt.begin();
    for (const p of b.projectiles) {
      const look = potionLook(p.kind);
      if (!look) {
        drawProjectile(w, p.kind, lerpX(p, alpha), lerpY(p, alpha));
        continue;
      }
      // a thrown vial tumbling end over end, trailing fire; it leaves from the thrower's hand
      let px = lerpX(p, alpha);
      let py = lerpY(p, alpha);
      const tx = p.tx / FP;
      const ty = p.ty / FP;
      const launch = this.launches.get(p.id);
      if (launch) {
        const k = 1 - (t - launch.at) / LEAVE_HAND;
        if (k <= 0) this.launches.delete(p.id);
        else {
          px += launch.dx * k * k;
          py += launch.dy * k * k;
        }
      }
      const len = Math.hypot(tx - px, ty - py) || 1;
      const dx = (px - tx) / len;
      const dy = (py - ty) / len;
      // the trail: one inked outline under all three blobs, so it reads as a single streak
      for (let i = 3; i >= 1; i--) w.circle(px + dx * i * 16, py + dy * i * 16, 20 - i * 3 + 4).fill(INK);
      for (let i = 3; i >= 1; i--) w.circle(px + dx * i * 16, py + dy * i * 16, 20 - i * 3).fill(look.glow[i - 1]);
      const s = this.shotArt.put(look.body, px, py, 44 + p.star * 4);
      s.anchor.set(0.5);
      s.rotation = t * 14 + p.id;
    }
    this.shotArt.end();
    // wall health
    const frac = Math.max(0, b.wall / b.wallMax);
    const barY = BAR_Y;
    healthTube(w, F.left, barY, F.right - F.left, BAR_H, frac);
    this.wallText.text = `${Math.ceil(Math.max(0, b.wall) / FP)} / ${Math.round(b.wallMax / FP)}`;
    this.wallText.position.set(DESIGN_W / 2, barY + BAR_H / 2);

    const fx = this.fx.clear();
    const fxTop = this.fxTop.clear();
    const fxGround = this.fxGround.clear();
    this.fxList = this.fxList.filter((e) => (e.ttl -= dt) > 0);
    for (const e of this.fxList) e.draw(e.top ? fxTop : e.ground ? fxGround : fx, e.ttl / e.max);
    for (const v of b.vortices) vortexSwirl(fxGround, v.x / FP, v.y / FP, BALANCE.skills.vortexRadius, t, Math.min(1, v.time / TICK_RATE / 0.4));
    for (const f of this.floaters.children) {
      if (!f.visible) continue;
      f.y -= 120 * dt;
      f.alpha -= dt * 1.2;
      if (f.alpha <= 0) f.visible = false;
    }

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
      let a = this.cellAnims[s];
      if (!a || a.id !== h.id) {
        const pour = this.pours.find((p) => p.slot === s);
        a = this.cellAnims[s] = { id: h.id, shots: 0, lastShot: -99, born: pour ? pour.start + POUR : t };
      }
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
      this.hero(g, ho, this.heroArt, this.potions, h.kind, h.star, c.x, c.y - 10 - hop, 1, s === from ? 0.35 : 1, s, dim, anim);
      if (h.stunTime) stunStars(ho, c.x, c.y - G.cellH / 2 - 6, t);
    }
    this.drawPours(ho);
    this.drawCommander(g, ho, b, dt);
    this.heroArt.end();
    this.potions.end();

    const d = this.drag.clear();
    this.dragArt.begin();
    this.dragPotions.begin();
    const held = from !== null ? b.slots[from] : null;
    if (held) this.hero(d, d, this.dragArt, this.dragPotions, held.kind, held.star, this.dragPos.x, this.dragPos.y, 1.15, 1, 0);
    this.dragArt.end();
    this.dragPotions.end();
  }

  /** The heroes of one cell centred on (x, y): levels 1-3 show that many small figures, the top
   *  level one big hero in a golden aura. */
  private hero(under: Graphics, over: Graphics, layer: SpriteLayer, potions: PotionLayer, kind: HeroKind, star: number, x: number, y: number, size: number, alpha: number, phase: number, dim = false, anim: (i: number) => FigureAnim = () => STILL): void {
    const feet = y + 50 * size;
    if (star >= BALANCE.maxStar) {
      const a = anim(0);
      if (a.pop < 0) return;
      const grow = popScale(a.pop);
      const pulse = 0.8 + 0.2 * Math.sin(this.time * 4 + phase);
      under.circle(x, y - 10 * size, 64 * size * pulse * grow).fill({ color: COLORS.gold, alpha: 0.5 * alpha });
      under.circle(x, y - 10 * size, 46 * size * grow).fill({ color: 0xfff3c0, alpha: 0.5 * alpha });
      const tex = ultimateTexture(kind);
      const h = tex ? Math.min(ULTIMATE_HEIGHT, (ULTIMATE_WIDTH * tex.height) / tex.width) : ULTIMATE_HEIGHT;
      this.figure(under, over, layer, tex, kind, x, feet, h * size, alpha, phase, dim, a);
      return;
    }
    const { spots, height } = FIGURES[star - 1];
    const look = potionLook(kind);
    spots.forEach(([dx, dy], i) => {
      const a = anim(i);
      // still being poured in
      if (a.pop < 0) return;
      const fx = x + dx * size;
      const ff = feet + dy * size;
      if (!look) {
        this.figure(under, over, layer, figureTexture(kind), kind, fx, ff, height * size, alpha, phase + i, dim, a);
        return;
      }
      heroShadow(under, fx, ff - 4, height * size * 0.6 * popScale(a.pop), alpha);
      potions.put(look, { x: fx, feet: ff, height: height * size * 1.05, alpha, dim, phase: phase + i, time: this.time, ...a });
    });
  }

  /** A merge pours the dragged potion into the target, then the result pops out with a splash. */
  private drawPours(over: Graphics): void {
    const t = this.time;
    for (const p of this.pours) {
      const look = potionLook(p.kind);
      const k = (t - p.start) / POUR;
      if (!look || k >= 1) continue;
      const c = slotCenter(p.slot);
      // the potion it lands on waits underneath until the pour is done
      this.hero(this.grid, over, this.heroArt, this.potions, p.kind, p.star, c.x, c.y - 10, 1, 1, p.slot);
      // the poured one swoops in above the cell and tips over, its neck pointing down into it
      const h = FIGURES[0].height;
      const tip = Math.min(1, k * 3.5);
      const tilt = tip * 2.0;
      const reach = h * 1.05;
      const mouthX = c.x - 6;
      const mouthY = c.y - 100 - (1 - tip) * 40;
      const px = mouthX - Math.sin(tilt) * reach;
      const py = mouthY + Math.cos(tilt) * reach;
      this.potions.put(look, { x: px, feet: py, height: h, alpha: 1, dim: false, phase: 0, time: t, wind: 0, since: Infinity, pop: Infinity, tilt });
      if (tip >= 1) {
        const wob = Math.sin(t * 40) * 3;
        for (const [width, color] of [[16, 0x0e0c12], [9, look.lid]]) {
          over.moveTo(mouthX, mouthY).quadraticCurveTo(mouthX + wob, mouthY + 30, c.x + wob, c.y - 62).stroke({ width, color, cap: 'round' });
        }
      }
    }
    for (const p of this.pours.filter((q) => t - q.start >= POUR)) {
      const c = slotCenter(p.slot);
      this.burst(c.x, c.y, 110, COLORS.gold, 0.35);
      this.splash(c.x, c.y + 10, potionLook(p.kind)?.lid ?? COLORS.gold);
    }
    this.pours = this.pours.filter((q) => t - q.start < POUR);
  }

  /** Droplets flying out in arcs and puffs of coloured smoke rising. */
  private splash(x: number, y: number, color: number): void {
    const drops = Array.from({ length: 9 }, (_, i) => ({ a: -Math.PI / 2 + (i - 4) * 0.3 + (Math.random() - 0.5) * 0.2, v: 380 + Math.random() * 260 }));
    const puffs = Array.from({ length: 5 }, (_, i) => ({ dx: (i - 2) * 26 + (Math.random() - 0.5) * 12, r: 22 + Math.random() * 12 }));
    const ttl = 0.6;
    this.fxList.push({
      ttl,
      max: ttl,
      top: true,
      draw: (g, life) => {
        const s = (1 - life) * ttl;
        for (const p of puffs) g.circle(x + p.dx, y - 20 - s * 140, p.r * (1 + s * 2)).fill({ color, alpha: life * 0.35 });
        for (const d of drops) {
          const dx = x + Math.cos(d.a) * d.v * s;
          const dy = y + Math.sin(d.a) * d.v * s + 900 * s * s;
          g.circle(dx, dy, 6 * life + 2).fill(color).stroke({ width: 2, color: 0x0e0c12 });
        }
      },
    });
  }

  /** One figure with its feet on (x, feet): its art if there is any, else the placeholder shape.
   *  Breathes gently. */
  private figure(under: Graphics, over: Graphics, layer: SpriteLayer, tex: Texture | undefined, kind: HeroKind, x: number, feet: number, height: number, alpha: number, phase: number, dim: boolean, anim: FigureAnim = STILL): void {
    if (!tex) {
      drawHero(over, kind, x, feet - height * 0.42, height * 0.4, dim ? alpha * 0.35 : alpha);
      return;
    }
    // narrow art stands a little taller, so it does not look smaller than its neighbours
    const h = height * Math.max(1, (0.85 * tex.height) / tex.width);
    heroShadow(under, x, feet - 4, h * 0.7, alpha);
    const s = layer.put(tex, x, feet, h);
    s.alpha = alpha;
    if (dim) s.tint = 0x5a5a5a;
    // breathes; squashes as it draws back, stretches as it throws, pops in when it appears
    const r = recoil(anim.since);
    const grow = popScale(anim.pop);
    s.scale.x *= grow * (1 + anim.wind * 0.06 - r * 0.06);
    s.scale.y *= grow * (1 + Math.sin(this.time * 3 + phase) * 0.025 - anim.wind * 0.08 + r * 0.1);
  }

  /** The commander under the wall, and how far it is through the summons that build the next cell. */
  private drawCommander(under: Graphics, over: Graphics, b: Battle, dt: number): void {
    this.cmdPulse = Math.max(0, this.cmdPulse - dt * 1.5);
    const pop = 1 + this.cmdPulse * 0.25;
    summonCircle(under, CMD.x, CMD.feet, 124, 30);
    const tex = commanderTexture();
    if (tex) {
      heroShadow(under, CMD.x, CMD.feet - 4, CMD.height * 0.6);
      const s = this.heroArt.put(tex, CMD.x, CMD.feet, CMD.height * pop);
      s.scale.y *= 1 + Math.sin(this.time * 2.2) * 0.03;
    } else {
      drawHero(over, 'arcane', CMD.x, CMD.feet - CMD.height / 2, 80 * pop);
    }
    const next = b.summonsToNextCell();
    this.cmdNext.visible = next !== null;
    if (next === null) return;
    const per = C.summonsPerCell;
    const k = this.boost;
    over.roundRect(CMD.x - 56 * k, CMD.feet - CMD.height - 22 - 22 * k, 112 * k, 44 * k, 22 * k).fill({ color: 0x6e4c2f, alpha: 0.85 });
    this.cmdNext.text = tr('commanderNext', { n: per - next, total: per });
  }

  private drawGround(): void {
    const g = this.ground;
    // the field runs right down to the wall, so built cells stand out on it
    const bg = fieldTexture();
    if (bg) {
      const s = new Sprite(bg);
      s.width = DESIGN_W;
      s.height = FIELD_H;
      this.addChildAt(s, this.getChildIndex(g));
    } else {
      g.rect(F.left - 20, 0, F.right - F.left + 40, WALL_TOP).fill(COLORS.fieldEdge);
      g.rect(F.left, 0, F.right - F.left, WALL_TOP).fill(COLORS.field);
      for (let y = 120; y < WALL_TOP; y += 160) g.rect(F.left, y, F.right - F.left, 4).fill({ color: 0xffffff, alpha: 0.04 });
    }
    // the wall's inner face with the health bar's tube set into it, and the workshop floor
    if (bg) {
      innerFace(g, DESIGN_W, WALL_BOTTOM, FLOOR_Y, { x: F.left, y: BAR_Y, w: F.right - F.left, h: BAR_H });
      workshopFloor(g, DESIGN_W, FLOOR_Y, DESIGN_H + 40);
      return;
    }
    // without the art: a stone band with towers at both ends, the bottom row of cells set into it
    const x0 = G.x0 - 30;
    const x1 = G.x0 + G.cellW * G.cols + 30;
    g.rect(x0, WALL_TOP, x1 - x0, WALL_BOTTOM - WALL_TOP).fill(COLORS.wall).stroke({ width: 4, color: 0x5c5040 });
    for (const tx of [x0 - 10, x1 - 40]) {
      g.rect(tx, WALL_TOP - 50, 50, WALL_BOTTOM - WALL_TOP + 50).fill(COLORS.wallTop).stroke({ width: 4, color: 0x5c5040 });
      g.rect(tx, WALL_TOP - 70, 20, 24).rect(tx + 30, WALL_TOP - 70, 20, 24).fill(COLORS.wallTop).stroke({ width: 4, color: 0x5c5040 });
    }
  }

  /** The wall from above, redrawn only when a cell is built: a slab for every built cell, each
   *  column as thick as its cells, with the parapet along its front. */
  private drawWall(b: Battle): void {
    const key = b.open.map(Number).join('');
    if (key === this.wallKey) return;
    this.wallKey = key;
    const g = this.wall.clear();
    const columns: WallColumn[] = [];
    for (let col = 0; col < G.cols; col++) {
      const x0 = col === 0 ? 0 : G.x0 + G.cellW * col;
      const x1 = col === G.cols - 1 ? DESIGN_W : G.x0 + G.cellW * (col + 1);
      columns.push({ x0, x1, front: b.wallFront(toFp(G.x0 + G.cellW * (col + 0.5))) / FP + F.parapet });
    }
    wallTop(g, columns, WALL_BOTTOM);
    for (let s = 0; s < SLOT_COUNT; s++) {
      if (!b.isOpen(s)) continue;
      const c = slotCenter(s);
      slab(g, c.x - G.cellW / 2 + 8, c.y - G.cellH / 2 + 10, G.cellW - 16, G.cellH - 22, s);
    }
  }

  private effect(ttl: number, draw: Effect['draw'], ground = false): void {
    this.fxList.push({ ttl, max: ttl, draw, ground });
  }

  private burst(x: number, y: number, r: number, color: number, ttl: number): void {
    this.effect(ttl, (g, life) => {
      g.circle(x, y, r * (1.2 - life * 0.5)).fill({ color, alpha: life * 0.45 });
    });
  }

  /** A note floating up from (x, y) and fading, on a hidden one when there is one; at most 31. */
  private floater(text: string, x: number, y: number, color: number): void {
    let shown = 0;
    let free: Text | null = null;
    for (const f of this.floaters.children as Text[]) {
      if (f.visible) shown++;
      else if (!free) free = f;
    }
    if (shown > 30) return;
    if (!free) free = label(text, 40, { fill: color });
    else {
      if (free.text !== text) free.text = text;
      if (free.style.fill !== color) free.style.fill = color;
      free.alpha = 1;
      free.visible = true;
    }
    free.position.set(x, y - 30);
    // the newest on top, as when each was new
    this.floaters.addChild(free);
  }

  private slotAt(e: FederatedPointerEvent): number | null {
    const p = this.toLocal(e.global);
    const col = Math.floor((p.x - G.x0) / G.cellW);
    const row = Math.floor((p.y - G.y0) / G.cellH);
    if (col < 0 || col >= G.cols || row < 0 || row >= G.rows) return null;
    return row * G.cols + col;
  }

  private onDown(e: FederatedPointerEvent): void {
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
      if (held && b.canMerge(this.dragFrom, to) && potionLook(held.kind)) this.pours.push({ slot: to, kind: held.kind, star: held.star, start: this.time });
      b.move(this.dragFrom, to);
    }
    this.dragFrom = null;
  }
}
