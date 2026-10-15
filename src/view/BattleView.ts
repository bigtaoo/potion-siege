// Draws a battle (field, wall, enemies, shots, effects, the heroes on the wall) and turns drags
// between cells into moves and merges.

import { Container, Graphics, Rectangle, Sprite, type FederatedPointerEvent, type Text, type Texture } from 'pixi.js';
import { t as tr } from '../i18n';
import { SLOT_COUNT, WALL_ROW, slotCenter, type Battle } from '../sim/battle';
import { BALANCE, type BattleEvent, type HeroKind } from '../sim/types';
import { SpriteLayer, commanderTexture, enemyTexture, fieldTexture, figureTexture, potionLook, ultimateTexture } from './art';
import { HIT_TIME, chainBolt, gearBurst, hitEffect, iceShell } from './effects';
import { INK, PotionLayer, popScale, recoil, throwingHand } from './potion';
import { ENEMY_ART, drawEnemy, drawHero, drawProjectile, heroShadow } from './shapes';
import { COLORS, label } from './ui';
import { DESIGN_W } from './viewport';

const F = BALANCE.field;
const G = BALANCE.grid;
const C = BALANCE.commander;
/** Where the commander stands: feet on this point, below the wall between the two buttons. */
const CMD = { x: C.x, feet: C.y, height: 180 };
/** Top and bottom of the stone band the wall row sits on. */
const WALL_TOP = G.y0 + G.cellH * WALL_ROW - 14;
const WALL_BOTTOM = G.y0 + G.cellH * G.rows + 10;
/** Where the figures of a level 1-3 cell stand, back to front, and how tall they are. */
const FIGURES: { spots: [number, number][]; height: number }[] = [
  { spots: [[0, 0]], height: 92 },
  { spots: [[-28, 0], [28, 0]], height: 80 },
  { spots: [[0, -22], [-30, 8], [30, 8]], height: 74 },
];
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
  private readonly cmdNext = label('', 34);
  private cmdPulse = 0;
  private readonly floaters = new Container();
  private fxList: Effect[] = [];
  private dragFrom: number | null = null;
  private dragPos = { x: 0, y: 0 };
  private shake = 0;
  private battle: Battle | null = null;
  private time = 0;
  private idle = 0;

  constructor() {
    super();
    this.wallText = label('', 40);
    this.addChild(this.ground, this.under, this.fxGround, this.enemyArt, this.world, this.shotArt, this.fx, this.grid, this.heroArt, this.potions, this.heroOver, this.fxTop, this.wallText, this.floaters, this.drag, this.dragArt, this.dragPotions);
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
    this.floaters.removeChildren().forEach((c) => c.destroy());
  }

  /** Turns battle events into short-lived effects. */
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
      }
    }
  }

  update(dt: number): void {
    const b = this.battle;
    if (!b) return;
    this.shake = Math.max(0, this.shake - dt);
    this.position.set((Math.random() - 0.5) * this.shake * 40, (Math.random() - 0.5) * this.shake * 40);

    this.time += dt;
    const t = this.time;
    const w = this.world.clear();
    const u = this.under.clear();
    this.enemyArt.begin();
    // farther enemies first, so nearer ones overlap them
    for (const e of [...b.enemies].sort((p, q) => p.y - q.y)) {
      const tex = enemyTexture(e.kind);
      if (!tex) {
        drawEnemy(w, e);
        continue;
      }
      drawEnemy(u, e, 'under');
      drawEnemy(w, e, 'over');
      // waddle: hop and sway, out of step with each other
      const step = t * 9 + e.id * 1.7;
      const hop = Math.abs(Math.sin(step));
      const s = this.enemyArt.put(tex, e.x, e.y + e.radius * ENEMY_ART.feet - hop * 8, e.radius * ENEMY_ART.height);
      s.rotation = Math.cos(step) * 0.07;
      s.scale.y *= 0.96 + hop * 0.06;
      if (e.freezeTime > 0) iceShell(w, e.x, e.y + e.radius * ENEMY_ART.feet, e.radius * 2.3, e.radius * ENEMY_ART.height * 0.92);
      s.tint = e.freezeTime > 0 ? 0x9fe8ff : e.slowTime > 0 ? 0xc4dcff : e.poisonTime > 0 ? 0xc8f0a0 : 0xffffff;
    }
    this.enemyArt.end();
    this.shotArt.begin();
    for (const shot of b.projectiles) {
      let p = shot;
      const look = potionLook(p.kind);
      if (!look) {
        drawProjectile(w, p.kind, p.x, p.y);
        continue;
      }
      // a thrown vial tumbling end over end, trailing fire; it leaves from the thrower's hand
      const launch = this.launches.get(p.id);
      if (launch) {
        const k = 1 - (t - launch.at) / LEAVE_HAND;
        if (k <= 0) this.launches.delete(p.id);
        else p = { ...p, x: p.x + launch.dx * k * k, y: p.y + launch.dy * k * k };
      }
      const len = Math.hypot(p.tx - p.x, p.ty - p.y) || 1;
      const dx = (p.x - p.tx) / len;
      const dy = (p.y - p.ty) / len;
      // the trail: one inked outline under all three blobs, so it reads as a single streak
      for (let i = 3; i >= 1; i--) w.circle(p.x + dx * i * 16, p.y + dy * i * 16, 20 - i * 3 + 4).fill(INK);
      for (let i = 3; i >= 1; i--) w.circle(p.x + dx * i * 16, p.y + dy * i * 16, 20 - i * 3).fill(look.glow[i - 1]);
      const s = this.shotArt.put(look.body, p.x, p.y, 44 + p.star * 4);
      s.anchor.set(0.5);
      s.rotation = t * 14 + p.id;
    }
    this.shotArt.end();
    // wall health
    const frac = Math.max(0, b.wall / b.wallMax);
    const barY = WALL_BOTTOM + 14;
    w.roundRect(F.left, barY, F.right - F.left, 30, 15).fill(COLORS.hpBack);
    w.roundRect(F.left, barY, Math.max(30, (F.right - F.left) * frac), 30, 15).fill(frac > 0.3 ? 0x4cd964 : COLORS.hp);
    this.wallText.text = `${Math.ceil(Math.max(0, b.wall))} / ${Math.round(b.wallMax)}`;
    this.wallText.position.set(DESIGN_W / 2, barY + 15);

    const fx = this.fx.clear();
    const fxTop = this.fxTop.clear();
    const fxGround = this.fxGround.clear();
    this.fxList = this.fxList.filter((e) => (e.ttl -= dt) > 0);
    for (const e of this.fxList) e.draw(e.top ? fxTop : e.ground ? fxGround : fx, e.ttl / e.max);
    for (const f of [...this.floaters.children]) {
      f.y -= 120 * dt;
      f.alpha -= dt * 1.2;
      if (f.alpha <= 0) f.destroy();
    }

    const g = this.grid.clear();
    const ho = this.heroOver.clear();
    this.heroArt.begin();
    this.potions.begin();
    const from = this.dragFrom;
    this.idle = from !== null || b.paused ? 0 : this.idle + dt;
    const hint = this.idle > HINT_AFTER ? mergeablePair(b) : null;
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
      // a built cell is a stone block standing on the one below; wall cells sit in the wall
      if (Math.floor(s / G.cols) !== WALL_ROW) g.rect(x + 6, y + ht - 10, w - 12, 26).fill(COLORS.wall);
      // an ultimate hero's cell is framed in gold
      g.roundRect(x, y, w, ht, 20).fill(COLORS.cell).stroke({ width: 6, color: h && h.star >= BALANCE.maxStar ? COLORS.gold : COLORS.wallTop });
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
      const wind = h.cooldown > 0 && h.cooldown < WIND_UP ? 1 - h.cooldown / WIND_UP : 0;
      const anim = (i: number): FigureAnim => ({
        wind: i === cell.shots % n ? wind : 0,
        since: cell.shots > 0 && i === (cell.shots - 1) % n ? t - cell.lastShot : Infinity,
        pop: t - cell.born,
      });
      const hop = hint?.includes(s) ? Math.abs(Math.sin(t * 7)) * 16 : 0;
      this.hero(g, ho, this.heroArt, this.potions, h.kind, h.star, c.x, c.y - 10 - hop, 1, s === from ? 0.35 : 1, s, dim, anim);
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
    under.ellipse(CMD.x, CMD.feet, 104, 22).fill(0x10233a).stroke({ width: 6, color: COLORS.gold });
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
    over.roundRect(CMD.x - 56, CMD.feet - CMD.height - 44, 112, 44, 22).fill({ color: 0x0a1320, alpha: 0.7 });
    this.cmdNext.text = tr('commanderNext', { n: per - next, total: per });
  }

  private drawGround(): void {
    const g = this.ground;
    // the field runs right down to the wall, so built cells stand out on it
    const bg = fieldTexture();
    if (bg) {
      const s = new Sprite(bg);
      s.width = DESIGN_W;
      s.height = WALL_TOP;
      this.addChildAt(s, this.getChildIndex(g));
    } else {
      g.rect(F.left - 20, 0, F.right - F.left + 40, WALL_TOP).fill(COLORS.fieldEdge);
      g.rect(F.left, 0, F.right - F.left, WALL_TOP).fill(COLORS.field);
      for (let y = 120; y < WALL_TOP; y += 160) g.rect(F.left, y, F.right - F.left, 4).fill({ color: 0xffffff, alpha: 0.04 });
    }
    // the wall: a stone band with towers at both ends, the bottom row of cells set into it
    const x0 = G.x0 - 30;
    const x1 = G.x0 + G.cellW * G.cols + 30;
    g.rect(x0, WALL_TOP, x1 - x0, WALL_BOTTOM - WALL_TOP).fill(COLORS.wall).stroke({ width: 4, color: 0x5c5040 });
    for (const tx of [x0 - 10, x1 - 40]) {
      g.rect(tx, WALL_TOP - 50, 50, WALL_BOTTOM - WALL_TOP + 50).fill(COLORS.wallTop).stroke({ width: 4, color: 0x5c5040 });
      g.rect(tx, WALL_TOP - 70, 20, 24).rect(tx + 30, WALL_TOP - 70, 20, 24).fill(COLORS.wallTop).stroke({ width: 4, color: 0x5c5040 });
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

  private floater(text: string, x: number, y: number, color: number): void {
    if (this.floaters.children.length > 30) return;
    const t = label(text, 40, { fill: color });
    t.position.set(x, y - 30);
    this.floaters.addChild(t);
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

/** The first two slots that could merge, or null. */
function mergeablePair(b: Battle): [number, number] | null {
  for (let i = 0; i < SLOT_COUNT; i++) for (let j = i + 1; j < SLOT_COUNT; j++) if (b.canMerge(i, j)) return [i, j];
  return null;
}
