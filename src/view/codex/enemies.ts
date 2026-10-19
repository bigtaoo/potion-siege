// The clockwork army page: a card per enemy with its art, what it is in a word and the one
// element it fears and the one it shrugs off most. A tap opens its panel (enemyDetail.ts).

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../../i18n';
import { extremes } from '../../sim/enemies';
import type { MetaSave } from '../../sim/meta';
import { BOSS_KINDS, ENEMY_KINDS, isBoss, type EnemyKind, type HeroKind } from '../../sim/types';
import { endlessBossesMet, FIRST_STAGE } from '../../sim/waves';
import { bossTag, bottle, enemySprite, fit, ink, lightTile, P, tappable } from '../kit';
import { INK } from '../potion';
import { HERO_COLORS, label } from '../ui';
import { board, FOOT, HEAD, STRONG, WEAK, type CodexArea } from './common';

/** The army in the order of the cards: the rank and file as they join, then the bosses (the
 *  second row of a landscape page). */
const ARMY: readonly EnemyKind[] = ['grunt', 'runner', 'brute', 'flyer', 'winder', ...BOSS_KINDS];
/** The bosses the best endless run has met: shown in full, whatever stage is picked. */
let met: readonly EnemyKind[] = [];

/** Notes the bosses `m`'s best endless run has met, before its enemies are drawn. */
export function meet(m: MetaSave): void {
  met = endlessBossesMet(m.endless.best);
}

/** A home panel that is an enemy's. */
export function isEnemy(p: string | null): p is EnemyKind {
  return (ENEMY_KINDS as readonly (string | null)[]).includes(p);
}

/** What the enemy is in a word; every boss just says so. */
export function tag(kind: EnemyKind): string {
  return isBoss(kind) ? t('codex.tag.boss') : t(`codex.tag.${kind as 'grunt' | 'runner' | 'brute' | 'flyer' | 'winder'}`);
}

/** Every kind as a card, two to a row on a portrait page, five on a landscape one. */
export function enemiesPage(root: Container, m: MetaSave, a: CodexArea, top: number, open: (kind: EnemyKind) => void): void {
  meet(m);
  const w = a.wide ? a.w - 80 : Math.min(1000, a.w - 60);
  const h = a.y + a.h - 24 - top;
  const c = board(t('codex.monsters'), w, h);
  c.position.set(a.x + a.w / 2, top + h / 2);
  const cols = a.wide ? 5 : 2;
  const rows = Math.ceil(ARMY.length / cols);
  const gap = 18;
  const cw = (w - 80 - gap * (cols - 1)) / cols;
  const ch = Math.min(a.wide ? 420 : 360, (h - HEAD - FOOT - gap * (rows - 1)) / rows);
  ARMY.forEach((kind, i) => {
    const card = tappable(enemyCard(kind, m.stage, cw, ch), () => open(kind));
    card.position.set(-w / 2 + 40 + cw / 2 + (i % cols) * (cw + gap), -h / 2 + HEAD + ch / 2 + Math.floor(i / cols) * (ch + gap));
    c.addChild(card);
  });
  root.addChild(c);
}

/** The art with the element it fears most (+) and the one it shrugs off most (−) in its top
 *  corners, then the name and what it is in a word; a boss ringed red. */
function enemyCard(kind: EnemyKind, stage: number, cw: number, ch: number): Container {
  const c = new Container();
  c.addChild(lightTile(cw, ch, 22));
  const boss = isBoss(kind);
  if (boss) c.addChild(new Graphics().roundRect(-cw / 2 - 3, -ch / 2 - 3, cw + 6, ch + 6, 25).stroke({ width: 6, color: STRONG }));
  const artH = ch - 112;
  c.addChild(art(kind, stage, cw - 40, artH, 0, -ch / 2 + 12 + artH / 2, false));
  const name = fit(ink(t(`enemy.${kind}`), 34), cw - 28);
  name.y = ch / 2 - 74;
  const what = fit(boss ? label(tag(kind), 28, { fill: P.cream, stroke: { color: STRONG, width: 6 } }) : ink(tag(kind), 28, { fill: P.inkSoft }), cw - 28);
  what.y = ch / 2 - 32;
  c.addChild(name, what);
  const { weak, strong } = extremes(kind);
  const r = Math.min(34, cw * 0.08);
  if (weak) c.addChild(element(weak, true, r, -cw / 2 + 14 + r, -ch / 2 + 14 + r));
  if (strong) c.addChild(element(strong, false, r, cw / 2 - 18 - r, -ch / 2 + 14 + r));
  return c;
}

/** An element's potion in a disc of its colour, badged + (it hurts more) or − (less). */
function element(el: HeroKind, weak: boolean, r: number, x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  const b = bottle(el, r * 1.5);
  const badge = new Container();
  badge.position.set(r * 0.75, r * 0.75);
  const bar = r * 0.6;
  const sign = new Graphics().roundRect(-bar / 2, -bar / 8, bar, bar / 4, bar / 8);
  if (weak) sign.roundRect(-bar / 8, -bar / 2, bar / 4, bar, bar / 8);
  badge.addChild(new Graphics().circle(0, 0, r * 0.55).fill(weak ? WEAK : STRONG).stroke({ width: 3, color: P.line }), sign.fill(P.cream));
  c.addChild(new Graphics().circle(0, 0, r).fill(HERO_COLORS[el]).stroke({ width: 4, color: P.line }), b, badge);
  return c;
}

/** The enemy's art fitted into a box centred on (x, y), a boss tagged when `tagged`, a kind the
 *  picked `stage` does not send yet darkened. */
export function art(kind: EnemyKind, stage: number, bw: number, bh: number, x: number, y: number, tagged: boolean): Container {
  const c = new Container();
  c.position.set(x, y);
  const sprite = enemySprite(kind, bw, bh);
  c.addChild(new Graphics().ellipse(0, bh * 0.4, bw * 0.34, bh * 0.07).fill({ color: 0x000000, alpha: 0.2 }), sprite);
  if (tagged && isBoss(kind)) {
    const tag = bossTag(26);
    tag.position.set(bw / 2 - 54, -bh / 2 + 20);
    c.addChild(tag);
  }
  if (stage < FIRST_STAGE[kind] && !met.includes(kind)) {
    // not on the picked stage yet, nor met in endless mode: a dark shape, and the stage it first comes on
    for (const s of sprite.children) if (s instanceof Sprite) s.tint = 0x4a4038;
    const tag = fit(label(t('codex.from', { n: FIRST_STAGE[kind] }), Math.min(30, bh * 0.16), { fill: P.cream, stroke: { color: INK, width: 6 } }), bw);
    tag.y = bh * 0.3;
    c.addChild(tag);
  }
  return c;
}
