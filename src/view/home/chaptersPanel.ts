// The chapters panel over the home screen: a row per chapter with its chest, its stages and its
// star chests, in a list that scrolls once the page is too short for all five at full size.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import {
  CHAPTER_COUNT, chapterChest, CHAPTER_SIZE, chapterOpen, chapterProgress, chapterStages, chestWaiting, isFinale, stageTwists,
} from '../../sim/chapters';
import type { MetaSave } from '../../sim/meta';
import { starChestsWaiting } from '../../sim/starChest';
import { chapterStars, hardOpen, STARS, stageOpen, stageStars } from '../../sim/stars';
import { chestIcon, fit as fitText, ink, LIGHT, lightTile, lock, P, PillButton, redDot, starRow, tappable } from '../kit';
import { gem, label } from '../ui';
import { scrollList } from '../scroll';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import { leadIcon, starChestBar } from './starChestBar';
import { chapterTitle } from './shared';
import type { HomeActions } from './types';

const ROW_H = 300;
/** A chapter not open yet: its name and what opens it. */
const LOCKED_H = 170;
const GAP = 18;
/** The list's window: as wide as a row and the scroll thumb, from under the title plate to the
 *  board's foot. */
const VIEW_W = 900;
const HEAD = 90;
const FOOT = 30;

/** How far down the list is scrolled, kept over a rebuild (a chest claimed); null opens it at the
 *  first chapter with a chest waiting, else at the chosen stage's chapter. */
let scrolled: number | null = null;

/** The next chapters panel opens where a fresh one does. */
export function scrollChapters(): void {
  scrolled = null;
}

/** The five chapters, a row each: the name, the one-time chest (its button once every stage is
 *  cleared) and a tile a stage - cleared ones brass, the finale red, the chosen one ringed, a dot
 *  on a stage with a twist; a chapter not open yet says what opens it. Tapping an open stage
 *  picks it. Each stage shows its stars; on hard mode the tiles are the hard stages, and a
 *  chapter whose hard mode is not open yet says what opens it. Under the stages of an open
 *  chapter, its star chests (starChestBar.ts). */
export function chaptersPanel(m: MetaSave, act: HomeActions, fit: MenuFit): Container {
  const chapters = Array.from({ length: CHAPTER_COUNT }, (_, i) => i + 1);
  const rowH = (ch: number) => (chapterOpen(m, ch) ? ROW_H : LOCKED_H);
  // each row's top, the rows above it and their gaps down
  const tops = chapters.map((ch) => 8 + chapters.slice(0, ch - 1).reduce((y, c) => y + rowH(c) + GAP, 0));
  const rowY = (ch: number) => tops[ch - 1];
  const full = 16 + chapters.reduce((y, ch) => y + rowH(ch), 0) + (CHAPTER_COUNT - 1) * GAP;
  // as tall as the rows need, or as the page has room for at full size; the rows scroll in it
  const h = Math.min(full + HEAD + FOOT, Math.max(700, fit.h - 140));
  const { panel, box } = frame(act, t('chapter.panel'), h, fit);
  const chest = chapters.find((ch) => chestWaiting(m, ch) || starChestsWaiting(m, ch) > 0);
  const at = chest ?? Math.min(CHAPTER_COUNT, Math.ceil(m.stage / CHAPTER_SIZE));
  const list = scrollList(VIEW_W, h - HEAD - FOOT, scrolled ?? rowY(at) - 8, (y) => (scrolled = y));
  list.view.position.set(-VIEW_W / 2, -h / 2 + HEAD);
  box.addChild(list.view);
  const hard = m.stars.hardMode;
  for (let ch = 1; ch <= CHAPTER_COUNT; ch++) {
    const open = chapterOpen(m, ch);
    const rh = rowH(ch);
    // the name line, the stage tiles (or what opens them) and the star chests, down the row
    const ny = -rh / 2 + 48;
    const ty = open ? ny + 100 : ny + 72;
    const sy = rh / 2 - 50;
    const r = new Container();
    r.position.set(VIEW_W / 2, rowY(ch) + rh / 2);
    list.content.addChild(r);
    r.addChild(lightTile(860, rh, 26));
    const [first] = chapterStages(ch);
    const name = ink(chapterTitle(ch), 38, { fontWeight: '900' });
    name.anchor.set(0, 0.5);
    name.position.set(-400, ny);
    // the chapter's stars, in the mode the switch is on, before the chest
    const stars = ink(`★${chapterStars(m, ch, hard)}/${3 * CHAPTER_SIZE}`, 30, { fill: hard ? P.redInk : P.brassDark, fontWeight: '900' });
    stars.anchor.set(1, 0.5);
    stars.position.set(95, ny);
    fitText(name, 475 - stars.width - 20);
    r.addChild(name);
    if (open) r.addChild(stars);
    const waiting = chestWaiting(m, ch);
    const opened = m.chapterChests.includes(ch);
    const icon = chestIcon();
    icon.scale.set(0.5);
    icon.position.set(130, ny + 4);
    if (!waiting && !opened) icon.alpha = 0.55;
    r.addChild(icon);
    if (waiting) {
      const b: PillButton = new PillButton(t('chapter.chestOpen'), 210, 72, 'green', () => act.claimChapter(ch, b), 36);
      // a chest on it, where the star chests' button has a star
      leadIcon(b, chestIcon(), 210, 72, 0.4);
      b.label = 'chapter_chest';
      b.position.set(290, ny);
      r.addChild(b);
      redDot(r, 392, ny - 32);
    } else if (opened) {
      const done = ink(t('chapter.chestDone'), 32, { fill: P.inkSoft, fontWeight: '900' });
      done.anchor.set(0, 0.5);
      done.position.set(180, ny);
      r.addChild(done);
    } else {
      const g = gem(new Graphics(), 196, ny, 22);
      const n = ink(String(chapterChest(ch)), 32, { fill: LIGHT.crystal, fontWeight: '900' });
      n.anchor.set(0, 0.5);
      n.position.set(224, ny);
      const c = ink(`${chapterProgress(m, ch)}/${CHAPTER_SIZE}`, 32, { fill: P.inkSoft, fontWeight: '900' });
      c.anchor.set(1, 0.5);
      c.position.set(400, ny);
      r.addChild(g, n, c);
    }
    if (open) {
      const bar = starChestBar(m, act, ch);
      bar.y = sy;
      r.addChild(bar);
    }
    if (!open || (hard && !hardOpen(m, ch))) {
      name.alpha = 0.6;
      const text = ink(open ? t('stars.locked', { n: STARS.unlock }) : t('chapter.locked', { n: first - 1 }), 34, { fill: P.inkSoft, fontWeight: '900' });
      text.position.set(24, ty);
      const l = lock();
      l.scale.set(0.6);
      l.position.set(text.x - text.width / 2 - 36, ty);
      r.addChild(text, l);
      continue;
    }
    for (let i = 0; i < CHAPTER_SIZE; i++) {
      const stage = first + i;
      const can = stageOpen(m, stage);
      const tile = tappable(new Container(), () => can && act.pickStage(stage));
      tile.position.set(-351 + i * 78, ty);
      const finale = isFinale(stage);
      const won = stageStars(m, stage, hard);
      const cleared = hard ? won > 0 : stage <= m.cleared;
      const g = new Graphics().roundRect(-34, -34, 68, 68, 16).fill(cleared ? (finale || hard ? 0xd0644f : P.brass) : LIGHT.face).stroke({ width: 4, color: P.line });
      if (stage === m.stage) g.roundRect(-42, -42, 84, 84, 22).stroke({ width: 6, color: P.red });
      const n = cleared ? label(String(stage), 30, { stroke: { color: P.line, width: 5 } }) : ink(String(stage), 30, { fill: P.inkSoft, fontWeight: '900' });
      n.y = -9;
      const row = starRow(won, 8, hard);
      row.y = 19;
      tile.addChild(g, n, row);
      if (stageTwists(stage).length > 0) tile.addChild(new Graphics().circle(26, -26, 9).fill(finale ? P.red : P.brassDark).stroke({ width: 3, color: P.line }));
      if (!can) tile.alpha = 0.45;
      r.addChild(tile);
    }
  }
  list.fill(full);
  scrolled = list.offset;
  return panel;
}
