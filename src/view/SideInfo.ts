// On a wide screen the battle board leaves columns either side; these boards fill them with
// what a desktop player can use: the skills taken and each potion's damage on the left, the
// waves still to come on the right.

import { Container, Graphics } from 'pixi.js';
import { t } from '../i18n';
import type { Battle } from '../sim/battle';
import { SKILL_IDS, skillHeroes, skillMax } from '../sim/skills';
import { BALANCE, type EnemyKind } from '../sim/types';
import { isBossWave, waveKinds } from '../sim/waves';
import { cardIcon } from './Overlay';
import { bossTag, bottle, enemySprite, fit, ink, inset, LIGHT, lightPanel, lightTile, P, plate } from './kit';
import { HERO_COLORS, label } from './ui';
import type { MenuFit } from './viewport';

/** The narrowest column the boards are shown in, in page units. */
const MIN_COLUMN = 400;
const MAX_W = 560;
/** How often the boards look for a change, in seconds. */
const REFRESH = 0.25;

export class SideInfo extends Container {
  private readonly left = new Container();
  private readonly right = new Container();
  private key = '';
  private wait = 0;

  constructor() {
    super();
    this.addChild(this.left, this.right);
  }

  /** `boardX` is where the board starts, in page units; the columns are either side of it. */
  update(b: Battle | null, boardX: number, m: MenuFit, show: boolean, dt: number): void {
    const pw = Math.min(MAX_W, boardX - 64);
    this.visible = show && !!b && pw >= MIN_COLUMN - 64;
    if (!this.visible || !b) {
      this.key = '';
      return;
    }
    this.scale.set(m.scale);
    this.wait -= dt;
    const key = this.keyOf(b, boardX, m);
    // a new layout, wave or skill at once; the damage shares at most every REFRESH
    const sameLayout = this.key.split('|')[0] === key.split('|')[0];
    if (key === this.key || (sameLayout && this.wait > 0)) return;
    this.key = key;
    this.wait = REFRESH;
    // room above for the name plate that sits on the top edge
    const ph = Math.min(m.h - 150, 1500);
    this.rebuild(this.left, skillsBoard(b, pw, ph), boardX / 2, m.h / 2 + 30);
    this.rebuild(this.right, wavesBoard(b, pw, ph), m.w - boardX / 2, m.h / 2 + 30);
  }

  /** What the boards show: the layout and wave first, the live numbers after the bar. */
  private keyOf(b: Battle, boardX: number, m: MenuFit): string {
    const skills = SKILL_IDS.map((id) => b.skills[id]).join('');
    const total = Object.values(b.dealt).reduce((a, d) => a + d, 0) || 1;
    const shares = b.setup.lineup.map((k) => Math.round((100 * b.dealt[k]) / total)).join(',');
    return `${Math.round(boardX)}x${Math.round(m.w)}x${Math.round(m.h)}:${b.wave}:${skills}|${shares}`;
  }

  private rebuild(side: Container, board: Container, x: number, y: number): void {
    side.removeChildren().forEach((c) => c.destroy({ children: true }));
    side.position.set(x, y);
    side.addChild(board);
  }
}

/** The left board: the skills taken with their pips, then each potion's share of the damage. */
function skillsBoard(b: Battle, w: number, h: number): Container {
  const c = new Container();
  c.addChild(lightPanel(w, h));
  const top = -h / 2;
  const iw = w - 90;
  const head = plate(t('side.skills'), 38, Math.min(320, w - 120));
  head.y = top + 4;
  c.addChild(head);

  // the damage chart takes what the lineup needs at the bottom, the skills the rest
  const rh = 64;
  const dmgH = 70 + b.setup.lineup.length * rh;
  const listTop = top + 80;
  const listBottom = h / 2 - 50 - dmgH;
  const taken = SKILL_IDS.filter((id) => b.skills[id] > 0);
  if (taken.length === 0) {
    const none = fit(ink(t('side.noSkills'), 28, { fill: P.inkSoft, wordWrap: true, wordWrapWidth: iw - 20, align: 'center' }), iw);
    none.y = (listTop + listBottom) / 2;
    c.addChild(none);
  }
  const row = Math.min(78, (listBottom - listTop) / Math.max(1, taken.length));
  taken.forEach((id, i) => {
    const y = listTop + row * i + row / 2;
    const tile = lightTile(iw, row - 10, 18);
    tile.y = y;
    // a potion's own skill shows that potion, a recipe both, like on the cards
    const { hero, with: other } = skillHeroes(id);
    const icon = cardIcon(id, hero, other);
    const size = row - 18;
    if (icon) {
      icon.scale.set(size / (hero ? 200 : 160));
      icon.position.set(-iw / 2 + 12 + size / 2, y - 3);
    }
    const name = fit(ink(t(`skill.${id}.name`), Math.min(30, row * 0.42)), iw - size - 170);
    name.anchor.set(0, 0.5);
    name.position.set(-iw / 2 + size + 28, y - 3);
    c.addChild(tile, ...(icon ? [icon] : []), name);
    c.addChild(pips(b.skills[id], skillMax(id), iw / 2 - 18, y - 3));
  });

  // each potion of the lineup: its bottle, a bar in its colour against the best, the share
  const dTop = h / 2 - 40 - dmgH;
  const title = ink(t('damage'), 32, { fill: P.brassDark });
  title.y = dTop + 24;
  c.addChild(title, inset(iw, dmgH - 56, dTop + 50, 22));
  const total = b.setup.lineup.reduce((a, k) => a + b.dealt[k], 0);
  const best = Math.max(1, ...b.setup.lineup.map((k) => b.dealt[k]));
  const rows = [...b.setup.lineup].sort((x, y) => b.dealt[y] - b.dealt[x]);
  const bx = -iw / 2 + 74;
  const bw = iw - 74 - 96;
  rows.forEach((kind, i) => {
    const y = dTop + 56 + i * rh + rh / 2;
    const bt = bottle(kind, rh - 8);
    bt.position.set(-iw / 2 + 38, y);
    const g = new Graphics().roundRect(bx, y - 14, bw, 28, 14).fill({ color: P.ink, alpha: 0.12 });
    if (b.dealt[kind] > 0) g.roundRect(bx, y - 14, Math.max(28, (bw * b.dealt[kind]) / best), 28, 14).fill(HERO_COLORS[kind]).stroke({ width: 3, color: LIGHT.edge });
    const pct = ink(total > 0 ? `${Math.round((100 * b.dealt[kind]) / total)}%` : '–', 30);
    pct.anchor.set(1, 0.5);
    pct.position.set(iw / 2 - 16, y);
    c.addChild(g, bt, pct);
  });
  return c;
}

/** A skill's level as pips, right-aligned at `x`; the repair that has no real cap as ×n. */
function pips(level: number, max: number, x: number, y: number): Container {
  if (max > 6) {
    const n = ink(`×${level}`, 30, { fill: P.brassDark });
    n.anchor.set(1, 0.5);
    n.position.set(x, y);
    return n;
  }
  const g = new Graphics();
  for (let i = 0; i < max; i++) {
    const px = x - 10 - (max - 1 - i) * 24;
    g.circle(px, y, 9).fill(i < level ? P.brass : LIGHT.inset).stroke({ width: 3, color: LIGHT.edge });
  }
  return g;
}

/** The right board: this wave and the next ones, each with the kinds it can bring, a NEW chip
 *  on a kind's first wave and the boss tag; the boss countdown along the bottom. */
function wavesBoard(b: Battle, w: number, h: number): Container {
  const c = new Container();
  c.addChild(lightPanel(w, h));
  const top = -h / 2;
  const iw = w - 90;
  const head = plate(t('side.waves'), 38, Math.min(320, w - 120));
  head.y = top + 4;
  c.addChild(head);

  const count = BALANCE.waves.count;
  const stage = b.setup.stage;
  const bossWaves = b.setup.modifiers?.bossWaves ?? BALANCE.waves.bossWaves;
  const first = Math.max(1, b.wave);
  const shown = Array.from({ length: Math.min(4, count - first + 1) }, (_, i) => first + i);
  const listTop = top + 84;
  const listBottom = h / 2 - 120;
  const rh = Math.min(200, (listBottom - listTop) / 4);
  shown.forEach((wave, i) => {
    const y = listTop + rh * i + rh / 2;
    const now = wave === b.wave;
    const tile = lightTile(iw, rh - 14, 22);
    tile.y = y;
    c.addChild(tile);
    if (now) c.addChild(new Graphics().roundRect(-iw / 2 - 6, y - (rh - 14) / 2 - 6, iw + 12, rh - 2, 26).stroke({ width: 6, color: P.brass }));
    const name = ink(t('side.wave', { n: wave }), 32, { fill: now ? P.ink : P.inkSoft });
    name.anchor.set(0, 0.5);
    name.position.set(-iw / 2 + 22, y - rh / 2 + 34);
    c.addChild(name);
    const tag = wave === count ? t('side.last') : now ? t('side.now') : '';
    if (tag) {
      const s = ink(tag, 26, { fill: P.brassDark });
      s.anchor.set(1, 0.5);
      s.position.set(iw / 2 - 22, y - rh / 2 + 34);
      c.addChild(s);
    }
    const before = new Set<EnemyKind>(wave > 1 ? waveKinds(wave - 1, stage, bossWaves) : []);
    const kinds = waveKinds(wave, stage, bossWaves);
    const size = Math.min(86, rh - 80, (iw - 40) / kinds.length - 8);
    kinds.forEach((kind, k) => {
      const x = -iw / 2 + 24 + size / 2 + k * (size + 8);
      const ey = y + 22;
      c.addChild(placed(enemySprite(kind, size, size), x, ey));
      if (kind === 'boss') {
        const bt = bossTag(14);
        bt.position.set(x, ey + size / 2 - 4);
        c.addChild(bt);
      } else if (wave > 1 && !before.has(kind)) {
        const chip = label(t('side.fresh'), 18, { fill: P.cream, stroke: { color: P.line, width: 4 } });
        const cw = chip.width + 16;
        const bg = new Graphics().roundRect(-cw / 2, -14, cw, 28, 12).fill(0x3f9b4c).stroke({ width: 3, color: P.line });
        const ch = new Container();
        ch.addChild(bg, chip);
        ch.position.set(x + size / 2 - 10, ey - size / 2 + 6);
        c.addChild(ch);
      }
    });
  });

  // when the next boss comes
  const next = bossWaves.filter((n) => n >= Math.max(1, b.wave)).sort((x, y) => x - y)[0];
  if (next !== undefined) {
    const n = next - Math.max(1, b.wave);
    const text = n === 0 ? t('side.bossNow') : n === 1 ? t('side.bossNext') : t('side.bossIn', { n });
    const line = ink(text, 32, { fill: isBossWave(b.wave, bossWaves) ? P.red : P.brassDark });
    line.y = h / 2 - 80;
    c.addChild(line);
  }
  return c;
}

function placed<T extends Container>(c: T, x: number, y: number): T {
  c.position.set(x, y);
  return c;
}
