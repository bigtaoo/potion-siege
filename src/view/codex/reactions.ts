// The reactions page: every potion reaction (sim/reactions.ts) a row with the two potions that set
// it off. The pair shows from the start, as the hint of what to try; the name and what it does
// only once the player has set it off, with three mastery stars for how often (at 100, 1000 and
// 10000) and the count.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { REACTION_MASTERY } from '../../sim/achievements';
import type { MetaSave } from '../../sim/meta';
import { REACTION_IDS, type HeroKind, type ReactionId } from '../../sim/types';
import { bottle, fit, ink, lightTile, P } from '../kit';
import { INK, star } from '../potion';
import { REACTION_COLORS } from '../battleView/reactionFx';
import { HERO_COLORS, label } from '../ui';
import { board, FOOT, GAP, GREY, HEAD, type CodexArea } from './common';

/** The two potions of each reaction; resonance's second is any element (null). */
export const REACTION_PAIRS: Record<ReactionId, readonly [HeroKind, HeroKind | null]> = {
  steam: ['fire', 'ice'],
  superconduct: ['ice', 'lightning'],
  overload: ['fire', 'lightning'],
  electrolysis: ['lightning', 'poison'],
  combustion: ['fire', 'poison'],
  firestorm: ['wind', 'fire'],
  blizzard: ['wind', 'ice'],
  resonance: ['arcane', null],
};

/** The stars a reaction set off `n` times has earned. */
export function masteryStars(n: number): number {
  return REACTION_MASTERY.filter((goal) => n >= goal).length;
}

/** A column of rows on a portrait page, two on a wide one. */
export function reactionsPage(root: Container, m: MetaSave, a: CodexArea, top: number): void {
  const cols = a.wide ? 2 : 1;
  const w = a.wide ? Math.min(1500, a.w - 80) : Math.min(1000, a.w - 60);
  const per = Math.ceil(REACTION_IDS.length / cols);
  const rh = Math.min(200, (a.y + a.h - 24 - top - HEAD - FOOT - GAP * (per - 1)) / per);
  const h = HEAD + per * rh + (per - 1) * GAP + FOOT;
  const c = board(t('codex.page.reactions'), w, h);
  c.position.set(a.x + a.w / 2, top + h / 2);
  const rw = (w - 60 - (cols - 1) * 24) / cols;
  REACTION_IDS.forEach((id, i) => {
    const col = Math.floor(i / per);
    const r = reactionRow(id, m.achievements.stats.reactions[id], rw, rh);
    r.position.set(-w / 2 + 30 + rw / 2 + col * (rw + 24), -h / 2 + HEAD + rh / 2 + (i % per) * (rh + GAP));
    c.addChild(r);
  });
  root.addChild(c);
}

/** One reaction: its pair, its name and what it does (a hint while never set off), its stars. */
function reactionRow(id: ReactionId, count: number, rw: number, rh: number): Container {
  const known = count > 0;
  const r = new Container();
  r.addChild(lightTile(rw, rh, 22));
  // the pair, on a plate in the reaction's colour once it is known
  const pw = Math.min(rh * 1.7, rw * 0.3);
  const ph = rh - 20;
  const px = -rw / 2 + 10 + pw / 2;
  r.addChild(new Graphics().roundRect(-rw / 2 + 10, -ph / 2, pw, ph, 16).fill(known ? REACTION_COLORS[id][0] : P.paperDark));
  const [one, two] = REACTION_PAIRS[id];
  const bh = Math.min(ph * 0.8, pw * 0.42);
  const left = bottle(one, bh);
  left.position.set(px - pw * 0.27, 0);
  r.addChild(left);
  if (two) {
    const right = bottle(two, bh);
    right.position.set(px + pw * 0.27, 0);
    r.addChild(right);
  } else r.addChild(anyElement(px + pw * 0.27, 0, bh * 0.36));
  const plus = label('+', bh * 0.4, { fill: P.cream, stroke: { color: INK, width: 6 } });
  plus.position.set(px, 0);
  r.addChild(plus);

  // the stars and the count at the right end
  const sw = Math.min(170, rw * 0.2);
  const sx = rw / 2 - 14 - sw / 2;
  if (known) {
    const g = new Graphics();
    const got = masteryStars(count);
    const sr = Math.min(22, sw / 7);
    for (let s = 0; s < REACTION_MASTERY.length; s++) {
      const glow: [number, number, number] = s < got ? [P.brass, P.brass, P.brassLight] : [GREY, GREY, GREY];
      star(g, sx + (s - 1) * sr * 2.3, -rh * 0.14, sr, 0, glow, 3);
    }
    const n = fit(ink(t('codex.rxCount', { n: count }), Math.min(26, rh * 0.17), { fill: P.inkSoft }), sw);
    n.position.set(sx, rh * 0.2);
    r.addChild(g, n);
  }

  // the name and what it does (or the hint) between the two
  const tx0 = -rw / 2 + 10 + pw + 18;
  const tw = (known ? sx - sw / 2 - 28 : rw / 2 - 14) - tx0;
  const ns = Math.min(40, rh * 0.26);
  // the unknown name plain, as a thick outline runs the question marks together
  const name = fit(known ? label(t(`codex.rx.${id}`), ns, { fill: P.cream, stroke: { color: P.line, width: 7 } }) : ink('? ? ?', ns, { fill: GREY }), tw);
  name.anchor.set(0, 0.5);
  name.position.set(tx0, -rh * 0.17);
  const does = fit(ink(known ? t(`codex.rxDo.${id}`) : t('codex.rxHint'), Math.min(27, rh * 0.17), { fill: P.inkSoft }), tw);
  does.anchor.set(0, 0.5);
  does.position.set(tx0, rh * 0.2);
  r.addChild(name, does);
  if (!known) r.alpha = 0.8;
  return r;
}

/** "Any element": a ring of the four elements' colours, for resonance's second potion. */
function anyElement(x: number, y: number, r: number): Graphics {
  const g = new Graphics();
  const kinds = ['fire', 'ice', 'lightning', 'poison'] as const;
  kinds.forEach((k, i) => {
    const a0 = (i * Math.PI) / 2 - Math.PI / 2;
    g.moveTo(x, y).arc(x, y, r, a0, a0 + Math.PI / 2).closePath().fill(HERO_COLORS[k]);
  });
  g.circle(x, y, r).stroke({ width: 4, color: INK });
  return g;
}
