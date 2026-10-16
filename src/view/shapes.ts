// Placeholder art: every hero and enemy is drawn from plain shapes until real art arrives.

import type { Graphics } from 'pixi.js';
import type { Enemy, HeroKind } from '../sim/types';
import { COLORS, HERO_COLORS } from './ui';

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
  g.ellipse(x, y, w / 2, w * 0.16).fill({ color: 0x000000, alpha: 0.3 * alpha });
}

const ENEMY_COLORS = { grunt: 0x4f8a8b, runner: 0x7aa6c2, brute: 0x6b5b95, boss: 0x3d2c5e, flyer: 0xc9a24a, winder: 0x3f9a96 } as const;

/** Height of an enemy's art, where its feet go and how high a flyer hangs over its shadow,
 *  relative to its hit circle. */
export const ENEMY_ART = { height: 3.8, feet: 0.9, lift: 1.1 };

/** `art`: the body is a sprite drawn elsewhere, so only the shadow (`under`) or the bars and rings go here. */
export function drawEnemy(g: Graphics, e: Enemy, art: 'under' | 'over' | null = null): void {
  const { x, y, radius: r } = e;
  const fly = e.kind === 'flyer';
  // a flyer's shadow is smaller and fainter, cast from up in the air
  if (art !== 'over') g.ellipse(x, y + r * 0.8, r * (fly ? 0.7 : 0.9), r * (fly ? 0.22 : 0.3)).fill({ color: 0x000000, alpha: fly ? 0.2 : 0.3 });
  if (art === 'under') return;
  if (art) {
    enemyBars(g, e, y - r * (ENEMY_ART.height - ENEMY_ART.feet + (fly ? ENEMY_ART.lift : 0)) - 18);
    return;
  }
  if (e.kind === 'runner') g.poly(polygon(x, y, r * 1.1, 3, Math.PI / 2));
  else if (e.kind === 'brute') g.roundRect(x - r, y - r, r * 2, r * 2, r * 0.4);
  else g.circle(x, y, r);
  const frozen = e.freezeTime > 0;
  g.fill(frozen ? 0xbfefff : ENEMY_COLORS[e.kind]).stroke({ width: e.kind === 'boss' ? 9 : 6, color: 0x0a1320 });
  if (e.kind === 'boss') {
    g.poly([x - r * 0.6, y - r * 0.8, x - r * 0.6, y - r * 1.25, x - r * 0.3, y - r * 1.0, x, y - r * 1.35, x + r * 0.3, y - r * 1.0, x + r * 0.6, y - r * 1.25, x + r * 0.6, y - r * 0.8])
      .fill(COLORS.gold)
      .stroke({ width: 5, color: 0x0a1320 });
  }
  g.circle(x - r * 0.3, y, r * 0.16).circle(x + r * 0.3, y, r * 0.16).fill(0xff3344);
  if (e.burnTime > 0) g.circle(x, y, r + 6).stroke({ width: 5, color: HERO_COLORS.fire, alpha: 0.8 });
  if (e.poisonTime > 0) g.circle(x, y, r + 6).stroke({ width: 5, color: HERO_COLORS.poison, alpha: 0.8 });
  if (e.slowTime > 0 && !frozen) g.circle(x, y, r + 12).stroke({ width: 4, color: HERO_COLORS.ice, alpha: 0.7 });
  enemyBars(g, e, y - r - (e.kind === 'boss' ? 60 : 22));
}

function enemyBars(g: Graphics, e: Enemy, top: number): void {
  const { x, radius: r } = e;
  const w = Math.max(60, r * 1.6);
  top = Math.max(104, top); // never over the wave title in the top bar
  g.rect(x - w / 2, top, w, 10).fill(COLORS.hpBack);
  g.rect(x - w / 2, top, (w * Math.max(0, e.hp)) / e.maxHp, 10).fill(COLORS.hp);
}

export function drawProjectile(g: Graphics, kind: HeroKind, x: number, y: number): void {
  const color = HERO_COLORS[kind];
  g.circle(x, y, kind === 'fire' ? 16 : 11).fill(color).stroke({ width: 3, color: 0xffffff, alpha: 0.6 });
}
