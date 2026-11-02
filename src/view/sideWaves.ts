// The right board beside a wide screen's battle: this wave and the next ones, each with the kinds
// it can bring. A row's tags sit beside its name while they fit and drop to a line of their own
// when they don't, so no words ever run into each other; the boss countdown is a tag on the boss
// wave's own row, or a line right under the rows while that wave is further off.

import { Container, Graphics } from 'pixi.js';
import { t } from '../i18n';
import type { Battle } from '../sim/battle';
import { BALANCE, isBoss, type EnemyKind } from '../sim/types';
import { waveKinds, type WaveMods } from '../sim/waves';
import { bossTag, enemySprite, fit, ink, P } from './kit';
import { REST_ALPHA, SIDE, sideHead, sidePanel, sideTile } from './sideLook';
import { label } from './ui';

/** The kinds' pictures: this big while they fit two lines, never under the floor. */
const ICON = 64;
const ICON_MIN = 48;
const GAP = 12;
/** A row's padding inside its tile, and the space between rows. */
const PAD = 22;
const ROW_GAP = 14;
/** A tag's height, and the line a row's name sits on. */
const CHIP_H = 40;
const LINE = 46;

/** A tag: words on a filled pill, `name` telling the tests which. */
export function sideChip(text: string, fill: number, name: string, maxW: number): Container {
  const c = new Container();
  c.label = name;
  const words = fit(label(text, 26, { fill: P.cream, stroke: { color: P.line, width: 4 } }), maxW - 24);
  const cw = Math.ceil(words.width) + 24;
  c.addChild(new Graphics().roundRect(-cw / 2, -CHIP_H / 2, cw, CHIP_H, 16).fill(fill).stroke({ width: 3, color: P.line }), words);
  return c;
}

/** Lays `items` out from `x0` on lines `step` apart, starting on the line at `y`, wrapping at
 *  `x1`; returns the last line's y. */
function flow(items: Container[], x0: number, x1: number, y: number, step: number, gap = 10): number {
  let x = x0;
  for (const it of items) {
    const w = it.width;
    if (x > x0 && x + w > x1) {
      x = x0;
      y += step;
    }
    it.position.set(x + w / 2, y);
    x += w + gap;
  }
  return y;
}

/** The wave the next boss comes on, and how many waves off it is from now. */
function nextBoss(b: Battle, first: number, endless: boolean, bossWaves: readonly number[]): { wave: number; n: number; text: string } | null {
  const every = BALANCE.endless.bossEvery;
  const wave = endless ? Math.ceil(first / every) * every : bossWaves.filter((n) => n >= first).sort((x, y) => x - y)[0];
  if (wave === undefined) return null;
  const n = wave - Math.max(1, b.wave);
  return { wave, n, text: n === 0 ? t('side.bossNow') : n === 1 ? t('side.bossNext') : t('side.bossIn', { n }) };
}

/** One wave's row, its top at 0: the name and its tags, then the kinds it can bring on light
 *  discs, a ring and one NEW tag at the row's end for those that are new in it. */
function waveRow(wave: number, now: boolean, tags: Container[], kinds: EnemyKind[], fresh: Set<EnemyKind>, iw: number): Container {
  const row = new Container();
  row.alpha = now ? 1 : REST_ALPHA;
  const x0 = -iw / 2 + PAD;
  const x1 = iw / 2 - PAD;
  const name = fit(ink(t('side.wave', { n: wave }), 32, { fill: now ? SIDE.ink : SIDE.soft }), x1 - x0);
  name.anchor.set(0, 0.5);
  name.position.set(x0, PAD + LINE / 2 - 4);
  row.addChild(name, ...tags);
  // the tags beside the name while they all fit there, else on lines of their own under it
  const tagsW = tags.reduce((a, c) => a + c.width + 10, 0) - 10;
  let y = name.y;
  if (tags.length > 0) {
    if (name.width + 18 + tagsW <= x1 - x0) flow(tags, x1 - tagsW, x1, y, LINE);
    else y = flow(tags, x0, x1, y + LINE, LINE);
  }
  // the pictures: as big as fits in two lines, never under the floor
  const room = x1 - x0;
  let size = ICON;
  while (size > ICON_MIN && Math.ceil(kinds.length / Math.floor((room + GAP) / (size + GAP))) > 2) size -= 4;
  const cells: Container[] = kinds.map((kind) => {
    const c = new Container();
    const isNew = fresh.has(kind);
    const disc = new Graphics().circle(0, 0, size / 2 + 4).fill({ color: P.paper, alpha: 0.88 });
    disc.stroke(isNew ? { width: 5, color: P.greenOn } : { width: 3, color: P.line, alpha: 0.6 });
    c.addChild(disc, enemySprite(kind, size - 6, size - 6));
    if (isBoss(kind)) {
      const bt = bossTag(14);
      bt.y = size / 2 + 2;
      c.addChild(bt);
    }
    return c;
  });
  if (fresh.size > 0) cells.push(sideChip(t('side.fresh'), P.greenOn, 'chip-new', room));
  // pictures are laid out by their discs (a boss tag may hang below)
  let x = x0;
  let iy = y + LINE / 2 + 12 + size / 2;
  cells.forEach((c, i) => {
    const w = i < kinds.length ? size + 8 : c.width;
    if (x > x0 && x + w > x1) {
      x = x0;
      iy += size + GAP + 4;
    }
    c.position.set(x + w / 2, iy);
    x += w + GAP;
  });
  row.addChild(...cells);
  const bottom = (cells.length ? iy + size / 2 + (kinds.some(isBoss) ? 14 : 4) : y + LINE / 2) + PAD - 6;
  // the tile under it all, the current wave framed in brass
  const tile = sideTile(iw, bottom, 22);
  tile.y = bottom / 2;
  row.addChildAt(tile, 0);
  if (now) row.addChildAt(new Graphics().roundRect(-iw / 2 - 6, -6, iw + 12, bottom + 12, 26).stroke({ width: 6, color: P.brass }), 1);
  return row;
}

/** The right board: this wave and the next ones while they fit, at most four. */
export function wavesBoard(b: Battle, w: number, h: number): Container {
  const c = new Container();
  c.addChild(sidePanel(w, h));
  const top = -h / 2;
  const iw = w - 90;
  const head = sideHead(t('side.waves'));
  head.y = top + 4;
  c.addChild(head);

  // endless mode has no last wave, and a boss every few for as long as it lasts
  const endless = b.setup.endless === true;
  const count = endless ? Infinity : BALANCE.waves.count;
  const stage = b.setup.stage;
  const mods: WaveMods = b.setup.modifiers ?? {};
  const bossWaves = mods.bossWaves ?? BALANCE.waves.bossWaves;
  const first = Math.max(1, b.wave);
  const boss = nextBoss(b, first, endless, bossWaves);
  const bottom = h / 2 - 40;
  let y = top + 92;
  let bossShown = false;
  for (let wave = first, i = 0; i < 4 && wave <= count; wave++, i++) {
    const now = wave === b.wave;
    const tags: Container[] = [];
    const tag = wave === count ? t('side.last') : now ? t('side.now') : '';
    if (tag) tags.push(sideChip(tag, P.brassDark, wave === count ? 'chip-last' : 'chip-now', iw - 2 * PAD));
    if (boss?.wave === wave) tags.push(sideChip(boss.text, P.red, 'chip-boss', iw - 2 * PAD));
    const before = new Set<EnemyKind>(wave > 1 ? waveKinds(wave - 1, stage, mods, endless) : []);
    const kinds = waveKinds(wave, stage, mods, endless);
    const fresh = new Set(wave > 1 ? kinds.filter((k) => !isBoss(k) && !before.has(k)) : []);
    const row = waveRow(wave, now, tags, kinds, fresh, iw);
    // a row that would run off the board is left out; the first always shows
    if (i > 0 && y + row.height > bottom - (boss && !bossShown && boss.wave !== wave ? 60 : 0)) {
      row.destroy({ children: true });
      break;
    }
    row.y = y;
    c.addChild(row);
    y += row.height + ROW_GAP;
    bossShown ||= boss?.wave === wave;
  }
  // a boss further off: when, right under the rows
  if (boss && !bossShown) {
    const line = fit(ink(boss.text, 30, { fill: SIDE.accent }), iw);
    line.y = y + 22;
    c.addChild(line);
  }
  return c;
}
