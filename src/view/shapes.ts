// Placeholder art: every hero and enemy is drawn from plain shapes until real art arrives.

import type { Graphics } from 'pixi.js';
import { isBoss, type Enemy, type HeroKind } from '../sim/types';
import { COLORS, HERO_COLORS } from './ui';
import { LIGHT } from './kit/palette';
import { drawUpright, isLand } from './landView';

function polygon(cx: number, cy: number, r: number, sides: number, turn = -Math.PI / 2): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = turn + (i * Math.PI * 2) / sides;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

export function drawHero(g: Graphics, kind: HeroKind, x: number, y: number, r = 58, alpha = 1): void {
  const color = HERO_COLORS[kind];
  g.ellipse(x, y + r * 0.85, r * 0.8, r * 0.25).fill({ color: 0x000000, alpha: 0.3 * alpha });
  switch (kind) {
    case 'arcane':
      g.poly(polygon(x, y, r * 1.1, 3));
      break;
    case 'fire':
      g.circle(x, y, r * 0.9);
      break;
    case 'ice':
      g.poly(polygon(x, y, r, 4));
      break;
    case 'lightning':
      g.poly(polygon(x, y, r * 0.95, 6));
      break;
    case 'poison':
      g.roundRect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6, r * 0.35);
      break;
    case 'wind':
      g.ellipse(x, y, r * 0.95, r * 0.7);
      break;
  }
  g.fill({ color, alpha }).stroke({ width: 7, color: 0x0a1320, alpha });
  // eyes, so the shapes read as characters
  g.circle(x - r * 0.25, y - r * 0.05, r * 0.13).circle(x + r * 0.25, y - r * 0.05, r * 0.13).fill({ color: 0x0a1320, alpha });
}

export function heroShadow(g: Graphics, x: number, y: number, w: number, alpha = 1): void {
  drawUpright(g, x, y, (ox, oy) => g.ellipse(ox, oy, w / 2, w * 0.16).fill({ color: 0x000000, alpha: 0.3 * alpha }));
}

const ENEMY_COLORS = { grunt: 0x4f8a8b, runner: 0x7aa6c2, brute: 0x6b5b95, boss: 0x3d2c5e, flyer: 0xc9a24a, winder: 0x3f9a96, clock: 0x7a3b22, tripod: 0x3fa7b5, anvil: 0xd2602a, gear: 0x6a3d9a } as const;

/** Height of an enemy's art, where its feet go and how high a flyer hangs over its shadow,
 *  relative to its hit circle. */
export const ENEMY_ART = { height: 3.8, feet: 0.9, lift: 1.1 };

/** `art`: the body is a sprite drawn elsewhere, and so are its shadow and bars (sprites, in
 *  battleView/enemyMarks.ts): only an elite's ring under it (`under`) or its bar's frame over it
 *  (`over`) go here. */
export function drawEnemy(g: Graphics, e: Enemy, art: 'under' | 'over' | null = null): void {
  const { x, y, radius: r } = e;
  const fly = e.kind === 'flyer';
  // a flyer's shadow is smaller and fainter, cast from up in the air
  if (!art) g.ellipse(x, y + r * 0.8, r * (fly ? 0.7 : 0.9), r * (fly ? 0.22 : 0.3)).fill({ color: 0x000000, alpha: fly ? 0.2 : 0.3 });
  // an elite stands in a gold ring
  if (e.elite && art !== 'over') {
    drawUpright(g, x, y, (ox, oy) => g.ellipse(ox, oy + r * 0.8, r * 1.15, r * 0.4).stroke({ width: 6, color: COLORS.gold, alpha: 0.9 }));
  }
  if (art === 'under') return;
  if (art) {
    if (e.elite) {
      const box = enemyBarBox(e, artBarTop(e));
      drawUpright(g, x, y, (ox, oy) => eliteFrame(g, { ...box, x: box.x - x + ox, top: box.top - y + oy }));
    }
    return;
  }
  if (e.kind === 'runner') g.poly(polygon(x, y, r * 1.1, 3, Math.PI / 2));
  else if (e.kind === 'brute') g.roundRect(x - r, y - r, r * 2, r * 2, r * 0.4);
  else g.circle(x, y, r);
  const frozen = e.freezeTime > 0;
  g.fill(frozen ? 0xbfefff : ENEMY_COLORS[e.kind]).stroke({ width: isBoss(e.kind) ? 9 : 6, color: 0x0a1320 });
  if (isBoss(e.kind)) {
    g.poly([x - r * 0.6, y - r * 0.8, x - r * 0.6, y - r * 1.25, x - r * 0.3, y - r * 1.0, x, y - r * 1.35, x + r * 0.3, y - r * 1.0, x + r * 0.6, y - r * 1.25, x + r * 0.6, y - r * 0.8])
      .fill(COLORS.gold)
      .stroke({ width: 5, color: 0x0a1320 });
  }
  g.circle(x - r * 0.3, y, r * 0.16).circle(x + r * 0.3, y, r * 0.16).fill(0xff3344);
  if (e.burnTime > 0) g.circle(x, y, r + 6).stroke({ width: 5, color: HERO_COLORS.fire, alpha: 0.8 });
  if (e.poisonTime > 0) g.circle(x, y, r + 6).stroke({ width: 5, color: HERO_COLORS.poison, alpha: 0.8 });
  if (e.slowTime > 0 && !frozen) g.circle(x, y, r + 12).stroke({ width: 4, color: HERO_COLORS.ice, alpha: 0.7 });
  enemyBars(g, e, y - r - (isBoss(e.kind) ? 60 : 22));
}

/** Where the bars go over an enemy drawn in its art. */
export function artBarTop(e: Enemy): number {
  return e.y - e.radius * (ENEMY_ART.height - ENEMY_ART.feet + (e.kind === 'flyer' ? ENEMY_ART.lift : 0)) - 18;
}

/** An untouched enemy shows no bars, so a full road is not a wall of them; an elite always does,
 *  in its gold frame. */
export function barsShown(e: Enemy): boolean {
  return !!e.elite || e.hp < e.maxHp || (!!e.shieldMax && (e.shield ?? 0) < e.shieldMax);
}

/** The HP bar's centre, width and top, for an enemy whose bars would start at `top`. */
export function enemyBarBox(e: Enemy, top: number): { x: number; w: number; top: number } {
  // never over the wave title in the top bar (upright: on a lying field the top bar is beside it)
  return { x: e.x, w: Math.max(60, e.radius * 1.6), top: isLand() ? top : Math.max(104, top) };
}

function eliteFrame(g: Graphics, { x, w, top }: { x: number; w: number; top: number }): void {
  g.roundRect(x - w / 2 - 5, top - 5, w + 10, 20, 6).fill(COLORS.gold).stroke({ width: 2, color: LIGHT.edge });
}

function enemyBars(g: Graphics, e: Enemy, at: number): void {
  if (!barsShown(e)) return;
  const box = enemyBarBox(e, at);
  const { x, w, top } = box;
  // an elite's bar is framed in gold
  if (e.elite) eliteFrame(g, box);
  g.rect(x - w / 2, top, w, 10).fill(COLORS.hpBack);
  g.rect(x - w / 2, top, (w * Math.max(0, e.hp)) / e.maxHp, 10).fill(COLORS.hp);
  // the tripod's bell jar takes the hits first: its own glassy bar just above
  if (e.shieldMax) {
    g.rect(x - w / 2, top - 14, w, 10).fill(COLORS.hpBack);
    g.rect(x - w / 2, top - 14, (w * Math.max(0, e.shield ?? 0)) / e.shieldMax, 10).fill(0x8fe6f0);
  }
}

export function drawProjectile(g: Graphics, kind: HeroKind, x: number, y: number): void {
  const color = HERO_COLORS[kind];
  g.circle(x, y, kind === 'fire' ? 16 : 11).fill(color).stroke({ width: 3, color: 0xffffff, alpha: 0.6 });
}
