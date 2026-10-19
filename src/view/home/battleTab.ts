// The home screen's battle tab: the stage between its arrows with its chapter, enemies and
// twist, the commander with the fielded potions, and the fight button with today's challenge and
// endless mode beside it.

import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { t } from '../../i18n';
import { canPlayFree, CHALLENGE_TIERS } from '../../sim/challenge';
import { CHAPTER_SIZE, chapterOf, chapterProgress, chapterStages, isFinale, stageTwists } from '../../sim/chapters';
import { endlessOpen } from '../../sim/endless';
import { maxStage, type MetaSave } from '../../sim/meta';
import { ENEMY_KINDS, isBoss } from '../../sim/types';
import { onStage } from '../../sim/waves';
import { commanderTexture } from '../art';
import type { HomeActions } from './types';
import { bossTag, bottle, calendarIcon, enemySprite, fit as fitText, infinityIcon, ink, LIGHT, medal, P, PillButton, plate, redDot, tappable } from '../kit';
import { anyChestWaiting, challengeShown } from '../nudges';
import { gem, label } from '../ui';
import { chapterTitle, type Area } from './shared';

/** The main line, top to bottom: the stage between its arrows and what it sends, the commander
 *  with the four fielded potions in front, and the big button into battle low down where a
 *  thumb reaches it, today's challenge and endless mode as round buttons beside it once they
 *  are open. A wide page keeps the same column in the middle. */
export function battleTab(root: Container, m: MetaSave, act: HomeActions, a: Area, today: string): void {
  const cx = a.x + a.w / 2;
  const sy = a.y + (a.wide ? 70 : 80);
  stageCard(root, m, act, cx, sy);
  // clear of the battle medallion that rises out of the tab bar
  const by = a.wide ? a.y + a.h - 110 : a.y + a.h - 50 - START_H / 2;
  const challenge = challengeShown(m);
  const endless = endlessOpen(m);
  startButton(root, act, cx, by, challenge || endless ? SIDE_START_W : START_W);
  const off = SIDE_START_W / 2 + 40 + SIDE_R;
  if (challenge) challengeButton(root, m, act, today, cx - off, by);
  if (endless) endlessButton(root, act, cx + off, by);
  commander(root, m, act, cx, sy + CARD_BOTTOM + 20, by - START_H / 2 - 30);
}

const START_H = 180;
const START_W = 720;
/** The fight button between the two round ones, and their radius. */
const SIDE_START_W = 560;
const SIDE_R = 64;

/** How far below the plate's middle the chapter line, the enemies and the twist tag reach. */
const CARD_BOTTOM = 268;

/** The stage plate between its arrows; under it one light line with the stage's chapter (its
 *  name, a pip a stage and the progress), a row of the enemies it sends and its twist as one
 *  small tag. Tapping the line or the enemies opens the chapters. */
function stageCard(root: Container, m: MetaSave, act: HomeActions, x: number, y: number, ax = 340): void {
  const arrow = (dx: number, text: string, on: boolean, d: number) => {
    const c = tappable(new Container(), () => on && act.stage(d));
    c.position.set(x + dx, y);
    const sign = label(text, 46, { fill: on ? P.cream : P.inkSoft, stroke: { color: P.line, width: 6 } });
    c.addChild(medal(52), sign);
    if (!on) c.alpha = 0.6;
    root.addChild(c);
  };
  const kinds = ENEMY_KINDS.filter((k) => onStage(k, m.stage));
  const size = 66;
  const step = size + 12;
  const ch = chapterOf(m.stage);
  const card = tappable(new Container(), () => act.panel('chapters'));
  card.position.set(x, y);
  const cw = 2 * ax + 40;
  const ly = 100;
  card.hitArea = new Rectangle(-cw / 2, ly - 30, cw, CARD_BOTTOM - ly + 30);
  // the chapter line: its name on the left, a pip a stage, the count on the right
  card.addChild(new Graphics().roundRect(-cw / 2, ly - 28, cw, 56, 28).fill({ color: LIGHT.face, alpha: 0.6 }).stroke({ width: 3, color: LIGHT.insetEdge }));
  const count = ink(t('chapter.progress', { n: chapterProgress(m, ch), total: CHAPTER_SIZE }), 28, { fill: P.inkSoft, fontWeight: '900' });
  count.anchor.set(1, 0.5);
  count.position.set(cw / 2 - 26, ly);
  const name = fitText(ink(chapterTitle(ch), 30, { fontWeight: '900' }), cw - 52 - count.width - 24);
  name.anchor.set(0, 0.5);
  name.position.set(-cw / 2 + 26, ly);
  card.addChild(name, count);
  const [first] = chapterStages(ch);
  const right = count.x - count.width - 24;
  const pstep = Math.min(28, (right - (name.x + name.width + 24)) / CHAPTER_SIZE);
  if (pstep >= 18) {
    const pips = new Graphics();
    for (let i = 0; i < CHAPTER_SIZE; i++) {
      const stage = first + i;
      const px = right - (CHAPTER_SIZE - 1 - i) * pstep - pstep / 2;
      pips.circle(px, ly, isFinale(stage) ? 9 : 6).fill(stage <= m.cleared ? P.brass : LIGHT.face).stroke({ width: stage === m.stage ? 4 : 3, color: stage === m.stage ? P.red : P.line });
    }
    card.addChild(pips);
  }
  if (anyChestWaiting(m)) redDot(card, cw / 2 - 6, ly - 26);
  const row = new Container();
  row.position.set(0, ly + 74);
  kinds.forEach((kind, i) => {
    const s = enemySprite(kind, size);
    s.x = (i - (kinds.length - 1) / 2) * step;
    row.addChild(s);
    if (isBoss(kind)) {
      const tag = bossTag(14);
      tag.position.set(s.x, size / 2 + 2);
      row.addChild(tag);
    }
  });
  card.addChild(row);
  const twists = stageTwists(m.stage);
  if (twists.length > 0) {
    // one twist says what it does; two only name themselves, in one tag
    const text = twists.length === 1 ? `${t(`twist.${twists[0]}.name`)} · ${t(`twist.${twists[0]}.desc`)}` : twists.map((id) => t(`twist.${id}.name`)).join(' · ');
    const tag = twistTag(text, twists.some((id) => id === 'finale' || id === 'elite') ? P.red : P.brassDark, cw - 40);
    tag.y = CARD_BOTTOM - 20;
    card.addChild(tag);
  }
  const p = plate(t('stage', { n: m.stage }), 64, 420);
  p.position.set(x, y);
  root.addChild(card, p);
  arrow(-ax, '◀', m.stage > 1, -1);
  arrow(ax, '▶', m.stage < maxStage(m), 1);
}


/** The stage's twist: small cream words on a coloured pill, at most `max` across. */
function twistTag(text: string, color: number, max: number): Container {
  const c = new Container();
  const tx = label(text, 24, { stroke: { color: P.line, width: 4 } });
  fitText(tx, max - 36);
  const w = tx.width + 36;
  c.addChild(new Graphics().roundRect(-w / 2, -20, w, 40, 20).fill(color).stroke({ width: 3, color: P.line }), tx);
  return c;
}

/** The commander on its shadow, as tall as the room from `top` to `bottom` allows and in the
 *  middle of it, the four fielded potions standing in front in a shallow arc. Tapping them goes
 *  to the potions tab, where the lineup is changed. */
function commander(root: Container, m: MetaSave, act: HomeActions, x: number, top: number, bottom: number): void {
  const room = bottom - top;
  const h = Math.min(760, room * 0.84);
  // the bottles reach this far below the commander's feet
  const size = Math.max(84, Math.min(150, h * 0.22));
  const below = size * 0.45;
  const feet = top + (room - below + h) / 2;
  const tex = commanderTexture();
  if (tex && h >= 160) {
    const s = new Sprite(tex);
    s.anchor.set(0.5, 1);
    s.scale.set(h / tex.height);
    s.position.set(x, feet);
    root.addChild(new Graphics().ellipse(x, feet - 6, h * 0.36, h * 0.07).fill({ color: 0x000000, alpha: 0.2 }), s);
  }
  const team = tappable(new Container(), () => act.tab('potions'));
  team.label = 'lineupRow';
  team.position.set(x, feet);
  const gap = size * 1.12;
  m.lineup.forEach((kind, i) => {
    const off = i - (m.lineup.length - 1) / 2;
    // the outer two a step back, so the four stand around the commander's feet
    const py = Math.abs(off) > 1 ? -size * 0.2 : 0;
    team.addChild(new Graphics().ellipse(off * gap, py + size * 0.42, size * 0.32, size * 0.08).fill({ color: 0x000000, alpha: 0.2 }));
    const b = bottle(kind, size);
    b.position.set(off * gap, py);
    team.addChild(b);
  });
  root.addChild(team);
}

function startButton(root: Container, act: HomeActions, x: number, y: number, w: number): void {
  const b = new PillButton(t('start'), w, START_H, 'green', act.play, 86);
  b.position.set(x, y);
  root.addChild(b);
}

/** A round button beside the fight button: its icon on a medal, a short name on a plate below. */
function sideButton(root: Container, icon: Container, name: string, x: number, y: number, onTap: () => void): Container {
  const c = tappable(new Container(), onTap);
  c.position.set(x, y - 14);
  const cap = fitText(ink(name, 24), 2 * SIDE_R + 40);
  const pw = cap.width + 24;
  const capPlate = new Graphics().roundRect(-pw / 2, -17, pw, 34, 17).fill(LIGHT.face).stroke({ width: 3, color: LIGHT.edge });
  capPlate.y = cap.y = SIDE_R + 14;
  c.addChild(medal(SIDE_R), icon, capPlate, cap);
  root.addChild(c);
  return c;
}

/** Today's challenge as a round button that opens its details, the top reward on a badge while
 *  the free attempt is still there to win it. */
function challengeButton(root: Container, m: MetaSave, act: HomeActions, today: string, x: number, y: number): void {
  const cal = calendarIcon();
  cal.scale.set(0.8);
  const c = sideButton(root, cal, t('challenge.title'), x, y, () => act.panel('challenge'));
  if (!canPlayFree(m, today)) return;
  const n = label(String(CHALLENGE_TIERS[CHALLENGE_TIERS.length - 1].reward), 26, { stroke: { color: P.line, width: 5 } });
  const bw = n.width + 50;
  const badge = new Container();
  badge.position.set(SIDE_R * 0.55, -SIDE_R * 0.95);
  badge.addChild(new Graphics().roundRect(-bw / 2, -19, bw, 38, 19).fill(LIGHT.crystal).stroke({ width: 4, color: P.line }), gem(new Graphics(), -bw / 2 + 18, 0, 11));
  n.x = 12;
  badge.addChild(n);
  c.addChild(badge);
}

/** Endless mode as a round button straight into a run. */
function endlessButton(root: Container, act: HomeActions, x: number, y: number): void {
  const loop = infinityIcon();
  loop.scale.set(0.95);
  sideButton(root, loop, t('endless.title'), x, y, act.endless);
}
