// On a wide screen the battle board leaves columns either side; these boards fill them with
// what a desktop player can use: the skills taken and each potion's damage on the left, the
// waves still to come on the right.

import { Container, Graphics, type Text } from 'pixi.js';
import { t } from '../i18n';
import type { Battle } from '../sim/battle';
import { SKILL_IDS, skillHeroes, skillMax, type SkillId } from '../sim/skills';
import { BALANCE, isBoss, type EnemyKind, type HeroKind } from '../sim/types';
import { isBossWave, waveKinds, type WaveMods } from '../sim/waves';
import { cardIcon } from './overlay/skillCard';
import { bossTag, bottle, enemySprite, fit, ink, P } from './kit';
import { REST_ALPHA, SIDE, sideHead, sidePanel, sideTile } from './sideLook';
import { HERO_COLORS, label } from './ui';
import type { MenuFit } from './viewport';

/** The narrowest column the boards are shown in, in page units. */
const MIN_COLUMN = 400;
const MAX_W = 560;
/** How often the damage shares are redrawn while they change, in seconds. */
const REFRESH = 0.25;

/** The left board's look while it has nothing to show yet. */
const EMPTY_ALPHA = 0.35;

/** The parts of the left board that change without a new layout. */
interface Live {
  /** Each taken skill's pips (or ×n), redrawn when its level changes. */
  skills: { id: SkillId; pips: Graphics | Text; level: number; x: number; y: number }[];
  /** Each potion's damage row, moved to its rank. */
  rows: Map<HeroKind, { bar: Graphics; bottle: Container; pct: Text }>;
  /** The damage chart's geometry: the first row's centre, the row height, the bars' span. */
  top: number;
  rh: number;
  iw: number;
  bx: number;
  bw: number;
}

export class SideInfo extends Container {
  private readonly left = new Container();
  private readonly right = new Container();
  private battle: Battle | null = null;
  /** The layout, wave and skills taken: a change rebuilds both boards. */
  private key = '';
  /** The skill levels and damage shares last drawn. */
  private shown = '';
  private levels = '';
  private wait = 0;
  private live: Live | null = null;
  /** The lineup by damage, reused for every redraw. */
  private readonly order: HeroKind[] = [];

  constructor() {
    super();
    this.addChild(this.left, this.right);
  }

  /** `boardX` is where the board starts, in page units; the columns are either side of it, ending
   *  `reserve` above the bottom when the gold and buttons sit under them. */
  update(b: Battle | null, boardX: number, m: MenuFit, show: boolean, dt: number, reserve = 0): void {
    const pw = Math.min(MAX_W, boardX - 64);
    this.visible = show && !!b && pw >= MIN_COLUMN - 64;
    if (!this.visible || !b) {
      this.key = '';
      return;
    }
    this.scale.set(m.scale);
    // the left board steps back until it has something to show: a skill taken or any damage done
    const empty = SKILL_IDS.every((id) => !(b.skills[id] > 0)) && Object.values(b.dealt).every((d) => d === 0);
    this.left.alpha = empty ? EMPTY_ALPHA : 1;
    this.wait -= dt;
    // a new layout, wave or skill at once; a new level at once, without a rebuild; the damage
    // shares at most every REFRESH
    const key = `${this.keyOf(b, boardX, m)}:${Math.round(reserve)}`;
    const levels = SKILL_IDS.map((id) => b.skills[id]).join('');
    const shown = `${levels}|${this.shares(b)}`;
    if (key !== this.key || b !== this.battle) {
      this.key = key;
      this.battle = b;
      // room above for the name plate that sits on the top edge
      const room = m.h - reserve;
      const ph = Math.min(room - 150, 1500);
      const left = skillsBoard(b, pw, ph);
      this.live = left.live;
      this.rebuild(this.left, left.board, boardX / 2, room / 2 + 30);
      this.rebuild(this.right, wavesBoard(b, pw, ph), m.w - boardX / 2, room / 2 + 30);
    } else if (shown === this.shown || (levels === this.levels && this.wait > 0)) {
      return;
    }
    this.shown = shown;
    this.levels = levels;
    this.wait = REFRESH;
    if (this.live) refresh(b, this.live, this.order);
  }

  /** The layout, the wave and which skills are taken. */
  private keyOf(b: Battle, boardX: number, m: MenuFit): string {
    const taken = SKILL_IDS.map((id) => (b.skills[id] > 0 ? 1 : 0)).join('');
    return `${Math.round(boardX)}x${Math.round(m.w)}x${Math.round(m.h)}:${b.wave}:${taken}:${b.setup.lineup.join(',')}`;
  }

  /** Each potion's share of the damage, in whole percent. */
  private shares(b: Battle): string {
    const total = Object.values(b.dealt).reduce((a, d) => a + d, 0) || 1;
    return b.setup.lineup.map((k) => Math.round((100 * b.dealt[k]) / total)).join(',');
  }

  private rebuild(side: Container, board: Container, x: number, y: number): void {
    side.removeChildren().forEach((c) => c.destroy({ children: true }));
    side.position.set(x, y);
    side.addChild(board);
  }
}

/** The left board: the skills taken with their pips, then each potion's share of the damage.
 *  The pips and the damage rows are left empty for refresh() to fill. */
function skillsBoard(b: Battle, w: number, h: number): { board: Container; live: Live } {
  const c = new Container();
  c.addChild(sidePanel(w, h));
  const top = -h / 2;
  const iw = w - 90;
  const head = sideHead(t('side.skills'));
  head.y = top + 4;
  c.addChild(head);

  // the damage chart takes what the lineup needs at the bottom, the skills the rest
  const rh = 64;
  const dmgH = 70 + b.setup.lineup.length * rh;
  const listTop = top + 80;
  const listBottom = h / 2 - 50 - dmgH;
  const taken = SKILL_IDS.filter((id) => b.skills[id] > 0);
  if (taken.length === 0) {
    const none = fit(ink(t('side.noSkills'), 28, { fill: SIDE.soft, wordWrap: true, wordWrapWidth: iw - 20, align: 'center' }), iw);
    none.y = (listTop + listBottom) / 2;
    c.addChild(none);
  }
  const skills: Live['skills'] = [];
  const row = Math.min(78, (listBottom - listTop) / Math.max(1, taken.length));
  taken.forEach((id, i) => {
    const y = listTop + row * i + row / 2;
    const tile = sideTile(iw, row - 10, 18);
    tile.y = y;
    // a potion's own skill shows that potion, a recipe both, like on the cards
    const { hero, with: other } = skillHeroes(id);
    const icon = cardIcon(id, hero, other);
    const size = row - 18;
    if (icon) {
      icon.scale.set(size / (hero ? 200 : 160));
      icon.position.set(-iw / 2 + 12 + size / 2, y - 3);
    }
    const name = fit(ink(t(`skill.${id}.name`), Math.min(30, row * 0.42), { fill: SIDE.ink }), iw - size - 170);
    name.anchor.set(0, 0.5);
    name.position.set(-iw / 2 + size + 28, y - 3);
    c.addChild(tile, ...(icon ? [icon] : []), name);
    const p = { id, pips: pips(skillMax(id)), level: -1, x: iw / 2 - 18, y: y - 3 };
    skills.push(p);
    c.addChild(p.pips);
  });

  // each potion of the lineup: its bottle, a bar in its colour against the best, the share
  const dTop = h / 2 - 40 - dmgH;
  const title = ink(t('damage'), 32, { fill: SIDE.accent });
  title.y = dTop + 24;
  const well = new Graphics().roundRect(-iw / 2, dTop + 50, iw, dmgH - 56, 22).fill(SIDE.inset).stroke({ width: 4, color: SIDE.insetEdge });
  c.addChild(title, well);
  const rows: Live['rows'] = new Map();
  for (const kind of b.setup.lineup) {
    const r = { bar: new Graphics(), bottle: bottle(kind, rh - 8), pct: ink('', 30, { fill: SIDE.ink }) };
    r.bottle.x = -iw / 2 + 38;
    r.pct.anchor.set(1, 0.5);
    r.pct.x = iw / 2 - 16;
    rows.set(kind, r);
    c.addChild(r.bar, r.bottle, r.pct);
  }
  const bx = -iw / 2 + 74;
  return { board: c, live: { skills, rows, top: dTop + 56 + rh / 2, rh, iw, bx, bw: iw - 74 - 96 } };
}

/** Brings the left board's pips and damage rows up to date, in place. */
function refresh(b: Battle, live: Live, order: HeroKind[]): void {
  for (const s of live.skills) {
    const level = b.skills[s.id];
    if (level === s.level) continue;
    s.level = level;
    drawPips(s.pips, level, skillMax(s.id), s.x, s.y);
  }
  const lineup = b.setup.lineup;
  const total = lineup.reduce((a, k) => a + b.dealt[k], 0);
  let best = 1;
  for (const k of lineup) best = Math.max(best, b.dealt[k]);
  order.length = 0;
  order.push(...lineup);
  order.sort((x, y) => b.dealt[y] - b.dealt[x]);
  const { bx, bw } = live;
  order.forEach((kind, i) => {
    const r = live.rows.get(kind);
    if (!r) return;
    const y = live.top + i * live.rh;
    const g = r.bar.clear().roundRect(bx, y - 14, bw, 28, 14).fill({ color: SIDE.track, alpha: 0.12 });
    if (b.dealt[kind] > 0) g.roundRect(bx, y - 14, Math.max(28, (bw * b.dealt[kind]) / best), 28, 14).fill(HERO_COLORS[kind]).stroke({ width: 3, color: P.line });
    r.bottle.y = y;
    const pct = total > 0 ? `${Math.round((100 * b.dealt[kind]) / total)}%` : '–';
    if (r.pct.text !== pct) r.pct.text = pct;
    r.pct.y = y;
  });
}

/** What a skill's level is drawn on: pips, or ×n for the repair that has no real cap. */
function pips(max: number): Graphics | Text {
  if (max <= 6) return new Graphics();
  const n = ink('', 30, { fill: SIDE.accent });
  n.anchor.set(1, 0.5);
  return n;
}

/** A skill's level as pips, right-aligned at `x`; the repair as ×n. */
function drawPips(on: Graphics | Text, level: number, max: number, x: number, y: number): void {
  if (!(on instanceof Graphics)) {
    on.text = `×${level}`;
    on.position.set(x, y);
    return;
  }
  on.clear();
  for (let i = 0; i < max; i++) {
    const px = x - 10 - (max - 1 - i) * 24;
    on.circle(px, y, 9).fill(i < level ? P.brass : SIDE.pip).stroke({ width: 3, color: P.brassDark });
  }
}

/** The right board: this wave and the next ones, each with the kinds it can bring, a NEW chip
 *  on a kind's first wave and the boss tag; the boss countdown along the bottom. */
function wavesBoard(b: Battle, w: number, h: number): Container {
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
  const shown = Array.from({ length: Math.min(4, count - first + 1) }, (_, i) => first + i);
  const listTop = top + 84;
  const listBottom = h / 2 - 120;
  const rh = Math.min(200, (listBottom - listTop) / 4);
  shown.forEach((wave, i) => {
    const y = listTop + rh * i + rh / 2;
    const now = wave === b.wave;
    // this wave in full, the ones still to come a step back
    const row = new Container();
    row.alpha = now ? 1 : REST_ALPHA;
    c.addChild(row);
    const tile = sideTile(iw, rh - 14, 22);
    tile.y = y;
    row.addChild(tile);
    if (now) row.addChild(new Graphics().roundRect(-iw / 2 - 6, y - (rh - 14) / 2 - 6, iw + 12, rh - 2, 26).stroke({ width: 6, color: P.brass }));
    const name = ink(t('side.wave', { n: wave }), 32, { fill: now ? SIDE.ink : SIDE.soft });
    name.anchor.set(0, 0.5);
    name.position.set(-iw / 2 + 22, y - rh / 2 + 34);
    row.addChild(name);
    const tag = wave === count ? t('side.last') : now ? t('side.now') : '';
    if (tag) {
      const note = ink(tag, 28, { fill: SIDE.accent });
      note.anchor.set(1, 0.5);
      note.position.set(iw / 2 - 22, y - rh / 2 + 34);
      row.addChild(note);
    }
    const before = new Set<EnemyKind>(wave > 1 ? waveKinds(wave - 1, stage, mods, endless) : []);
    const kinds = waveKinds(wave, stage, mods, endless);
    const size = Math.min(86, rh - 80, (iw - 40) / kinds.length - 8);
    kinds.forEach((kind, k) => {
      const x = -iw / 2 + 24 + size / 2 + k * (size + 8);
      const ey = y + 22;
      row.addChild(placed(enemySprite(kind, size, size), x, ey));
      if (isBoss(kind)) {
        const bt = bossTag(14);
        bt.position.set(x, ey + size / 2 - 4);
        row.addChild(bt);
      } else if (wave > 1 && !before.has(kind)) {
        const chip = label(t('side.fresh'), 24, { fill: P.cream, stroke: { color: P.line, width: 4 } });
        const cw = chip.width + 16;
        const bg = new Graphics().roundRect(-cw / 2, -14, cw, 28, 12).fill(P.greenOn).stroke({ width: 3, color: P.line });
        const ch = new Container();
        ch.addChild(bg, chip);
        ch.position.set(x + size / 2 - 10, ey - size / 2 + 6);
        row.addChild(ch);
      }
    });
  });

  // when the next boss comes
  const every = BALANCE.endless.bossEvery;
  const next = endless ? Math.ceil(first / every) * every : bossWaves.filter((n) => n >= first).sort((x, y) => x - y)[0];
  if (next !== undefined) {
    const n = next - Math.max(1, b.wave);
    const text = n === 0 ? t('side.bossNow') : n === 1 ? t('side.bossNext') : t('side.bossIn', { n });
    const line = ink(text, 32, { fill: isBossWave(b.wave, bossWaves, endless) ? P.red : SIDE.accent });
    line.y = h / 2 - 80;
    c.addChild(line);
  }
  return c;
}

function placed<T extends Container>(c: T, x: number, y: number): T {
  c.position.set(x, y);
  return c;
}
