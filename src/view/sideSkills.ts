// The left board beside a wide screen's battle: the skills taken, each name on a line of its own
// with its pips under it (so the name never shrinks to make room for them), then each potion's
// share of the damage.

import { Container, Graphics, type Text } from 'pixi.js';
import { t } from '../i18n';
import type { Battle } from '../sim/battle';
import { SKILL_IDS, skillHeroes, skillMax, type SkillId } from '../sim/skills';
import type { HeroKind } from '../sim/types';
import { cardIcon } from './overlay/skillCard';
import { bottle, ink, P } from './kit';
import { SIDE, sideHead, sidePanel, sideTile } from './sideLook';
import { HERO_COLORS } from './ui';

/** The smallest a skill's name is ever drawn; a longer one wraps instead. */
export const NAME_FLOOR = 24;
/** A skill's row: this tall while there is room, and from COMPACT down, its name at the floor. */
const ROW = 100;
const COMPACT = 84;

/** The parts of the left board that change without a new layout. */
export interface Live {
  /** Each taken skill's pips (or ×n), redrawn when its level changes. */
  skills: { id: SkillId; pips: Graphics | Text; level: number; x: number; y: number; r: number }[];
  /** Each potion's damage row, moved to its rank. */
  rows: Map<HeroKind, { bar: Graphics; bottle: Container; pct: Text }>;
  /** The damage chart's geometry: the first row's centre, the row height, the bars' span. */
  top: number;
  rh: number;
  iw: number;
  bx: number;
  bw: number;
}

/** A skill's name in `w`: at `size`, shrunk no further than the floor, wrapped past it. */
function skillName(text: string, size: number, w: number): Text {
  const name = ink(text, size, { fill: SIDE.ink });
  if (name.width <= w || size === NAME_FLOOR) {
    if (name.width > w) Object.assign(name.style, { wordWrap: true, wordWrapWidth: w, breakWords: true, align: 'left' });
    return name;
  }
  name.destroy();
  return skillName(text, NAME_FLOOR, w);
}

/** The left board: the skills taken with their pips, then each potion's share of the damage.
 *  The pips and the damage rows are left empty for refresh() to fill. */
export function skillsBoard(b: Battle, w: number, h: number): { board: Container; live: Live } {
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
  const listTop = top + 84;
  const listBottom = h / 2 - 50 - dmgH;
  const taken = SKILL_IDS.filter((id) => b.skills[id] > 0);
  if (taken.length === 0) {
    // nothing yet: a quiet note where the first skill will go
    const tile = sideTile(iw, 120, 18);
    tile.alpha = 0.6;
    tile.y = listTop + 60;
    const none = ink(t('side.noSkills'), 28, { fill: SIDE.soft, wordWrap: true, wordWrapWidth: iw - 40, align: 'center' });
    none.y = tile.y;
    if (none.height > 110) none.scale.set(110 / none.height);
    c.addChild(tile, none);
  }
  const skills: Live['skills'] = [];
  const row = Math.min(ROW, (listBottom - listTop) / Math.max(1, taken.length));
  const compact = row < COMPACT;
  taken.forEach((id, i) => {
    const y = listTop + row * i + row / 2;
    const tile = sideTile(iw, row - 8, 18);
    tile.y = y;
    // a potion's own skill shows that potion, a recipe both, like on the cards
    const { hero, with: other } = skillHeroes(id);
    const icon = cardIcon(id, hero, other);
    const size = Math.min(76, row - 20);
    if (icon) {
      icon.scale.set(size / (hero ? 200 : 160));
      icon.position.set(-iw / 2 + 12 + size / 2, y - 2);
    }
    // the name on its line, the pips under it
    const nx = -iw / 2 + size + 28;
    const name = skillName(t(`skill.${id}.name`), compact ? NAME_FLOOR : 28, iw / 2 - 14 - nx);
    const r = compact ? 6 : 9;
    const lines = name.style.wordWrap ? 2 : 1;
    const nameH = lines === 2 ? name.height : Math.min(name.height, 36);
    const block = nameH + 4 + 2 * r;
    name.anchor.set(0, 0.5);
    name.position.set(nx, y - block / 2 + nameH / 2);
    c.addChild(tile, ...(icon ? [icon] : []), name);
    const p = { id, pips: pips(skillMax(id), compact), level: -1, x: nx + 2, y: y + block / 2 - r, r };
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
export function refresh(b: Battle, live: Live, order: HeroKind[]): void {
  for (const s of live.skills) {
    const level = b.skills[s.id];
    if (level === s.level) continue;
    s.level = level;
    drawPips(s.pips, level, skillMax(s.id), s.x, s.y, s.r);
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
function pips(max: number, compact: boolean): Graphics | Text {
  if (max <= 6) return new Graphics();
  const n = ink('', compact ? NAME_FLOOR : 28, { fill: SIDE.accent });
  n.anchor.set(0, 0.5);
  return n;
}

/** A skill's level as pips of radius `r` from `x` on; the repair as ×n. */
function drawPips(on: Graphics | Text, level: number, max: number, x: number, y: number, r: number): void {
  if (!(on instanceof Graphics)) {
    on.text = `×${level}`;
    on.position.set(x, y);
    return;
  }
  on.clear();
  const step = Math.round((r * 8) / 3);
  for (let i = 0; i < max; i++) on.circle(x + r + i * step, y, r).fill(i < level ? P.brass : SIDE.pip).stroke({ width: 3, color: P.brassDark });
}
