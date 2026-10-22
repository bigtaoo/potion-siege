// The achievements page: every track a row on one board, big enough to read on a phone, so the
// list scrolls. The tracks with a tier to claim come first, then the ones under way (the closest
// to their next tier first), then the finished ones, dimmed. A claim keeps the list where it was
// scrolled to and slides the rows to their new places.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { nextTier, TRACK_IDS, TRACKS, trackProgress, trackReady, type TrackId } from '../../sim/achievements';
import { CHALLENGE_TIERS } from '../../sim/challenge';
import type { MetaSave } from '../../sim/meta';
import {
  bottle, calendarIcon, enemySprite, fit, flask, gearIcon, infinityIcon, ink, LIGHT, lightTile, P, PillButton, starIcon, stopwatchIcon, swordsIcon, wallIcon,
} from '../kit';
import { scrollList } from '../scroll';
import { COLORS, HERO_COLORS, label } from '../ui';
import { board, FOOT, GAP, HEAD, type CodexArea } from './common';

/** A row's height on a portrait page and on a landscape one; how long the rows take to slide to
 *  their new places after a claim, and how soon after the tap the rebuild must come to slide. */
const ROW = 200;
const ROW_WIDE = 180;
const SLIDE = 320;
const FRESH = 1500;

/** Kept over the rebuild a claim brings: how far down the list is scrolled, where each row sat
 *  (in the list's units) and in which row size, and when the last claim was tapped. */
let scrolled = 0;
let placed = new Map<TrackId, { x: number; y: number }>();
let placedIn = '';
let claimedAt = -Infinity;

/** Scrolls the list `y` px down for its next build: back to the top when the page is turned to
 *  (the layout test also tries the far end). */
export function scrollFeats(y = 0): void {
  scrolled = y;
}

/** The tracks in the list's order: a tier to claim, then under way by how close the next tier is,
 *  then every tier claimed; the track list's own order between equals. */
export function featOrder(m: MetaSave): TrackId[] {
  const rank = (id: TrackId): number => (nextTier(m, id) === null ? 2 : trackReady(m, id) ? 0 : 1);
  const near = (id: TrackId): number => {
    const tier = nextTier(m, id);
    if (tier === null) return 1;
    const goal = TRACKS[id][tier].goal;
    return Math.min(goal, trackProgress(m, id, tier)) / goal;
  };
  // the sort keeps equals in TRACK_IDS order
  return [...TRACK_IDS].sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? near(b) - near(a) : 0));
}

/** Every track on one board: a column of rows on a portrait page, two on a landscape one (left
 *  to right, so the order reads along the lines). */
export function featsBoard(root: Container, m: MetaSave, a: CodexArea, top: number, claim: (id: TrackId, at: Container) => void): void {
  const bottom = a.y + a.h - 24;
  const w = a.wide ? a.w - 80 : Math.min(1000, a.w - 60);
  const h = bottom - top;
  const c = board(t('ach.title'), w, h);
  c.position.set(a.x + a.w / 2, top + h / 2);
  const tiers = TRACK_IDS.reduce((n, id) => n + TRACKS[id].length, 0);
  const got = TRACK_IDS.reduce((n, id) => n + m.achievements.claimed[id], 0);
  const note = ink(t('ach.count', { n: got, total: tiers }), 30, { fill: P.inkSoft });
  note.anchor.set(1, 0.5);
  note.position.set(w / 2 - 34, -h / 2 + 58);
  fit(note, w / 2 - 34 - (c.children[1] as Container).width / 2 - 6);
  c.addChild(note);

  const cols = a.wide ? 2 : 1;
  const rw = (w - 60 - (cols - 1) * 30) / cols;
  const rh = a.wide ? ROW_WIDE : ROW;
  // the window runs from under the count to the board's foot, the rows 10 px in from its sides
  // and 8 down from its top, room for a ready row's ring
  const vw = w - 40;
  const list = scrollList(vw, h - HEAD - FOOT + 12, scrolled, (y) => (scrolled = y));
  list.view.position.set(-w / 2 + 20, -h / 2 + HEAD + 2);
  const now = performance.now();
  // a resize in between moves every row anyway: no slide then
  const shape = `${rw}x${rh}`;
  const slide = now - claimedAt < FRESH && shape === placedIn;
  claimedAt = -Infinity;
  placedIn = shape;
  const was = placed;
  placed = new Map();
  const moving: { r: Container; from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
  const order = featOrder(m);
  order.forEach((id, i) => {
    const r = featRow(m, id, rw, rh, (b) => {
      claimedAt = performance.now();
      claim(id, b);
    });
    const to = { x: 10 + rw / 2 + (i % cols) * (rw + 30), y: 8 + rh / 2 + Math.floor(i / cols) * (rh + GAP) };
    const from = slide ? was.get(id) : undefined;
    r.position.set(from?.x ?? to.x, from?.y ?? to.y);
    if (from && (from.x !== to.x || from.y !== to.y)) moving.push({ r, from, to });
    placed.set(id, to);
    list.content.addChild(r);
  });
  const lines = Math.ceil(order.length / cols);
  list.fill(16 + lines * rh + (lines - 1) * GAP);
  if (moving.length) {
    list.content.onRender = () => {
      const k = Math.min(1, (performance.now() - now) / SLIDE);
      const e = 1 - (1 - k) ** 3;
      for (const { r, from, to } of moving) r.position.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
      if (k >= 1) list.content.onRender = null;
    };
  }
  c.addChild(list.view);
  root.addChild(c);
}

/** A track: its icon over a pip per tier, its name and next goal over how far along it is, and
 *  the button that claims the tier (a gold tick once every tier is claimed). */
function featRow(m: MetaSave, id: TrackId, rw: number, rh: number, claim: (at: Container) => void): Container {
  const r = new Container();
  const tiers = TRACKS[id];
  const next = nextTier(m, id);
  const ready = trackReady(m, id);
  r.addChild(lightTile(rw, rh, 24));
  if (ready) r.addChild(new Graphics().roundRect(-rw / 2 - 3, -rh / 2 - 3, rw + 6, rh + 6, 27).stroke({ width: 6, color: P.brass }));
  const ir = rh * 0.3;
  const ix = -rw / 2 + 24 + ir;
  const icon = new Container();
  icon.position.set(ix, -rh * 0.08);
  icon.addChild(new Graphics().circle(0, 0, ir).fill(next === null ? COLORS.gold : LIGHT.inset).stroke({ width: 5, color: LIGHT.edge }), trackIcon(id, ir * 1.3));
  r.addChild(icon);
  const pips = new Graphics();
  tiers.forEach((_, i) => {
    pips.circle(ix + (i - (tiers.length - 1) / 2) * 22, rh / 2 - 18, 7).fill(i < m.achievements.claimed[id] ? P.brass : LIGHT.inset).stroke({ width: 2, color: LIGHT.edge });
  });
  r.addChild(pips);

  const bw = Math.min(230, rw * 0.26);
  const bh = rh * 0.52;
  const bx = rw / 2 - 22 - bw / 2;
  const tx = ix + ir + 26;
  const room = bx - bw / 2 - 26 - tx;
  const tier = next ?? tiers.length - 1;
  const goal = tiers[tier].goal;
  const name = fit(ink(t(`ach.${id}.name`), rh * 0.22), room);
  name.anchor.set(0, 0.5);
  name.position.set(tx, -rh * 0.27);
  const desc = fit(ink(featDesc(id, tier, goal), rh * 0.16, { fill: P.inkSoft }), room);
  desc.anchor.set(0, 0.5);
  desc.position.set(tx, -rh * 0.03);
  r.addChild(name, desc);

  const have = Math.min(goal, trackProgress(m, id, tier));
  const frac = next === null ? 1 : have / goal;
  const barH = rh * 0.23;
  const barY = rh * 0.27 - barH / 2;
  const bar = new Graphics().roundRect(tx, barY, room, barH, barH / 2).fill(LIGHT.inset);
  if (frac > 0) bar.roundRect(tx, barY, Math.max(barH, room * frac), barH, barH / 2).fill(P.green);
  r.addChild(bar.roundRect(tx, barY, room, barH, barH / 2).stroke({ width: 4, color: P.line }));
  const count = fit(label(next === null ? t('ach.done') : `${have}/${goal}`, barH * 0.65, { stroke: { color: P.line, width: 6 } }), room - 30);
  count.position.set(tx + room / 2, rh * 0.27);
  r.addChild(count);

  if (next === null) {
    r.addChild(tick(bx, 0, bh * 0.46));
    r.alpha = 0.65;
  } else {
    const b: PillButton = new PillButton(String(tiers[next].reward), bw, bh, 'green', () => claim(b), rh * 0.2, true).setEnabled(ready);
    b.position.set(bx, 0);
    r.addChild(b);
  }
  return r;
}

/** A gold disc with a tick: every tier of the track claimed. */
function tick(x: number, y: number, r: number): Graphics {
  return new Graphics()
    .circle(x, y, r)
    .fill(COLORS.gold)
    .stroke({ width: 5, color: P.line })
    .moveTo(x - r * 0.45, y + r * 0.02)
    .lineTo(x - r * 0.12, y + r * 0.35)
    .lineTo(x + r * 0.48, y - r * 0.32)
    .stroke({ width: r * 0.2, color: P.line, cap: 'round', join: 'round' });
}

/** The goal of a track's tier in words. */
function featDesc(id: TrackId, tier: number, goal: number): string {
  if (id === 'enemies') return tier === 0 ? t('ach.enemies.boss') : t('ach.enemies.all', { n: goal });
  // the challenge counts reward tiers; the player knows them by their wave
  if (id === 'challenge') return t('ach.challenge.desc', { n: CHALLENGE_TIERS[goal - 1].wave });
  return t(`ach.${id}.desc`, { n: goal });
}

/** A track's picture, about `size` across. */
function trackIcon(id: TrackId, size: number): Container {
  const c = new Container();
  const add = (g: Container, across = 100) => {
    g.scale.set(size / across);
    c.addChild(g);
  };
  switch (id) {
    case 'stages':
      add(swordsIcon());
      break;
    case 'level':
      add(flask(new Graphics(), 0, 45, 90, HERO_COLORS.fire, true), 90);
      break;
    case 'ultimates':
      add(bottle('fire', 100));
      break;
    case 'unlock':
      add(bottle('wind', 100));
      break;
    case 'enemies':
      c.addChild(enemySprite('boss', size * 1.15, size * 1.15));
      break;
    case 'merges':
      add(flask(new Graphics(), 0, 45, 90, HERO_COLORS.arcane, true), 90);
      break;
    case 'kills':
      c.addChild(enemySprite('grunt', size * 1.15, size * 1.15));
      break;
    case 'battles':
      add(wallIcon());
      break;
    case 'challenge':
      add(stopwatchIcon());
      break;
    case 'endless':
      add(infinityIcon());
      break;
    case 'login':
      add(calendarIcon());
      break;
    case 'workshop':
      add(gearIcon());
      break;
    case 'stars':
      add(starIcon());
      break;
    case 'hard':
      add(starIcon(true));
      break;
  }
  return c;
}
