// The enemies as the battle draws them: between their last two ticks, farther ones first, each
// in its art (rimmed, in the chapter's metal, posed, tinted by what is on it) or its placeholder
// shape, lit up white as a blow lands and left a moment as a wreck when it dies.

import type { Graphics } from 'pixi.js';
import type { Battle } from '../../sim/battle';
import { chapterOf } from '../../sim/chapters';
import { FP } from '../../sim/math/fixed';
import { BALANCE, isBoss, type Enemy, type EnemyKind } from '../../sim/types';
import { SpriteLayer, enemyTexture } from '../art';
import { iceShell } from '../effects';
import { enemyLook, statusTint } from '../enemyLooks';
import { poseEnemy } from '../enemyPose';
import { endlessChapter } from '../../sim/waves';
import { lerpX, lerpY } from '../fixedStep';
import { hordeFade } from '../hordeFx';
import { drawUpright, isLand } from '../landView';
import { ENEMY_ART, drawEnemy, eliteCore } from '../shapes';
import { EnemyMarks } from './enemyMarks';
import { EnemyTracks, keep } from './enemyTracks';
import { Wrecks, flashOver } from './wrecks';

/** Farther enemies first (higher on the screen), so nearer ones overlap them. */
const byDepth = (p: Enemy, q: Enemy): number => p.y - q.y;
const byDepthLand = (p: Enemy, q: Enemy): number => p.x - q.x;

/** The chapter whose metal the enemies of `b` wear: its stage's, or in endless mode its band's. */
export function battleChapter(b: Battle): number {
  return b.setup.endless ? endlessChapter(b.wave) : chapterOf(b.setup.stage);
}

/** How a whirlwind turns `e` (as drawn) at view time `now`: back and forth while it has hold. */
function whirl(b: Battle, e: Enemy, now: number): number {
  if (isBoss(e.kind)) return 0;
  const r = BALANCE.skills.vortexRadius;
  for (const v of b.vortices) {
    if ((e.x - v.x / FP) ** 2 + (e.y - v.y / FP) ** 2 < r * r) return Math.sin(now * 12 + e.id) * 0.18;
  }
  return 0;
}

export class EnemyLayer {
  /** The enemies' art; goes into the view at its place in the drawing order. */
  readonly art = new SpriteLayer();
  /** The wrecks of the ones just killed; goes right under the art. */
  readonly dead = new SpriteLayer();
  /** The white of the blows on them, added over the art; goes right above it. */
  readonly flash = new SpriteLayer();
  /** Their shadows (under the art) and HP bars (over it); BattleView places both. */
  readonly marks = new EnemyMarks();
  /** What happens to each from frame to frame; BattleView tells it of blows, kills and pushes. */
  readonly tracks = new EnemyTracks();
  /** Each blow an enemy brings down on the wall, where it lands. */
  onBlow: (x: number, y: number, radius: number, kind: EnemyKind) => void = () => {};
  /** Whether wrecks go quickly and still (reduced motion). */
  soft = false;
  private readonly wrecks = new Wrecks();
  private battle: Battle | null = null;
  /** The enemies in drawing order, refilled every frame. */
  private readonly depth: Enemy[] = [];
  /** The enemies as drawn: world units, between their last two ticks; reused every frame. */
  private readonly drawn: Enemy[] = [];

  /** The enemies of `b` `alpha` of the way through its last tick, posed for battle time `bt`
   *  (seconds) at view time `now`: shapes and ice on `w`, what goes under the art on `u`. */
  draw(b: Battle, alpha: number, bt: number, now: number, w: Graphics, u: Graphics): void {
    if (b !== this.battle) {
      this.battle = b;
      this.tracks.clear();
      this.wrecks.clear();
    }
    this.art.begin();
    this.dead.begin();
    this.flash.begin();
    this.marks.begin();
    this.tracks.begin(now);
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
    depth.sort(isLand() ? byDepthLand : byDepth);
    const chapter = battleChapter(b);
    for (const e of depth) {
      const track = this.tracks.see(e, isBoss(e.kind));
      const fade = hordeFade(e);
      if (fade <= 0) continue;
      const art = enemyTexture(e.kind, e);
      if (!art) {
        drawEnemy(w, e);
        continue;
      }
      if (fade >= 1) {
        this.marks.shadow(e);
        this.marks.hp(e, track.trail);
        if (e.elite) {
          drawEnemy(u, e, 'under');
          drawEnemy(w, e, 'over');
        }
      }
      const react = this.tracks.reaction(track, whirl(b, e, now));
      // a boss keeps its own colours; the rest wear the chapter's metal, or their own grey while
      // something is on them, so the tint of that reads on every chapter
      const boss = isBoss(e.kind);
      const tint = statusTint(e);
      const tex = boss ? art : enemyLook(art, BALANCE.enemies[e.kind].radius, tint === 0xffffff ? chapter : 0);
      const s = poseEnemy(this.art, tex, e, bt, react);
      if (e.freezeTime > 0) {
        drawUpright(w, e.x, e.y, (ox, oy) => iceShell(w, ox, oy + e.radius * ENEMY_ART.feet, e.radius * 2.3, e.radius * ENEMY_ART.height * 0.92));
      }
      s.alpha = fade;
      s.tint = tint;
      // an elite carries a glowing core in its chest
      if (e.elite && !boss && fade >= 1) eliteCore(w, s.x, s.y, e.radius * ENEMY_ART.height, now + e.id);
      keep(s, track.snap);
      if (react.hit > 0) flashOver(this.flash, track.snap, react.hit * 0.7 * fade);
      const bashing = e.atWall && e.freezeTime <= 0 && e.kind !== 'anvil';
      if (this.tracks.blow(track, e, bt, bashing)) this.onBlow(e.x, e.y, e.radius, e.kind);
    }
    depth.length = 0;
    this.tracks.end((snap, boss) => this.wrecks.add(snap, now, boss));
    this.wrecks.draw(this.dead, this.flash, now, this.soft);
    this.art.end();
    this.dead.end();
    this.flash.end();
    this.marks.end();
  }
}
