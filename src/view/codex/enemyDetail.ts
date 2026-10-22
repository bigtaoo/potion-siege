// One enemy's panel over the page: the big art, what it is, its numbers on the picked stage, what
// it does, and every element's damage.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { enemyStats, resistLabel, resists } from '../../sim/enemies';
import type { MetaSave } from '../../sim/meta';
import { isBoss, type EnemyKind } from '../../sim/types';
import { bottle, fit, ink, inkWrapped, P } from '../kit';
import { codexStage } from '../nudges';
import { HERO_COLORS, label } from '../ui';
import { STRONG, WEAK } from './common';
import { art, meet, tag } from './enemies';

/** The kinds with a line on what they do, in their panel. */
type TraitKind = Exclude<EnemyKind, 'grunt' | 'runner' | 'brute' | 'boss'>;
const TRAITS: readonly EnemyKind[] = ['flyer', 'winder', 'clock', 'tripod', 'anvil', 'gear'] satisfies TraitKind[];

/** One enemy over the page: the big art, what it is, its numbers on the picked stage, what it
 *  does, and every element's damage. `frame` is the home's panel frame. */
export function enemyPanel(m: MetaSave, kind: EnemyKind, frame: (title: string, h: number) => { panel: Container; box: Container }): Container {
  meet(m);
  const stage = m.stage;
  const long = TRAITS.includes(kind) ? inkWrapped(t(`codex.trait.${kind as TraitKind}`), 32, 820, { fill: P.ink, lineHeight: 42 }) : null;
  const h = 960 + (long ? long.height + 40 : 0);
  const { panel, box } = frame(t(`enemy.${kind}`), h);
  const top = -h / 2;
  box.addChild(new Graphics().roundRect(-440, top + 100, 400, 400, 30).fill({ color: P.paperDark, alpha: 0.55 }));
  box.addChild(art(kind, stage, 360, 360, -240, top + 300, true));
  const x = -10;
  const boss = isBoss(kind);
  const what = fit(boss ? label(tag(kind), 40, { fill: P.cream, stroke: { color: STRONG, width: 7 } }) : ink(tag(kind), 40, { fill: P.brassDark }), 440);
  what.anchor.set(0, 0.5);
  what.position.set(x, top + 150);
  box.addChild(what);
  statLines(kind, stage).forEach((s, i) => {
    const l = fit(ink(s, 36), 440);
    l.anchor.set(0, 0.5);
    l.position.set(x, top + 240 + i * 64);
    box.addChild(l);
  });
  const note = fit(ink(t('codex.stage', { n: stage }), 28, { fill: P.inkSoft }), 440);
  note.anchor.set(0, 0.5);
  note.position.set(x, top + 460);
  box.addChild(note);
  let y = top + 560;
  if (long) {
    long.anchor.set(0.5, 0);
    long.y = y;
    box.addChild(long);
    y += long.height + 40;
  }
  box.addChild(new Graphics().rect(-410, y - 10, 820, 3).fill({ color: P.inkSoft, alpha: 0.5 }));
  const head = ink(t('codex.resist'), 34, { fill: P.inkSoft });
  head.y = y + 40;
  const table = chips(kind, 3);
  table.scale.set(2);
  table.y = y + 200;
  box.addChild(head, table);
  return panel;
}

/** Hit points on the first wave it comes in on this stage, speed and how hard it hits the wall.
 *  A kind the picked stage does not send yet is quoted at the stage it first comes on, and says so. */
function statLines(kind: EnemyKind, stage: number): string[] {
  const at = codexStage(kind, stage);
  const e = enemyStats(kind, at);
  const hp = Math.round(e.hp);
  return [
    at === stage ? t('codex.hpWave', { n: hp, w: e.wave }) : t('codex.hpStageWave', { n: hp, s: at, w: e.wave }),
    t('codex.speed', { n: e.speed }),
    t('codex.wallDps', { n: e.wallDps }),
  ];
}

const CHIP_W = 106;

/** One chip per element, potions not in the game yet too: its potion and how much more or
 *  less it hurts. */
function chips(kind: EnemyKind, cols: number): Container {
  const c = new Container();
  const cw = CHIP_W;
  const all = resists(kind);
  const rows = Math.ceil(all.length / cols);
  all.forEach(({ element: el, value: v }, i) => {
    const chip = new Container();
    chip.position.set(((i % cols) - (cols - 1) / 2) * cw, (Math.floor(i / cols) - (rows - 1) / 2) * 56);
    const color = v > 1 ? WEAK : v < 1 ? STRONG : P.inkSoft;
    chip.addChild(new Graphics().roundRect(-cw / 2 + 4, -24, cw - 8, 48, 24).fill({ color: v === 1 ? P.paperDark : color, alpha: v === 1 ? 0.6 : 0.18 }).stroke({ width: 3, color: v === 1 ? P.inkSoft : color }));
    chip.addChild(new Graphics().circle(-cw / 2 + 22, 0, 17).fill(HERO_COLORS[el]).stroke({ width: 3, color: P.line }));
    const b = bottle(el, 28);
    b.position.set(-cw / 2 + 22, 0);
    const text = ink(resistLabel(v), 26, { fill: color });
    text.anchor.set(0, 0.5);
    text.position.set(-cw / 2 + 41, 0);
    fit(text, cw - 41 - 14); // clear of the pill's round end
    chip.addChild(b, text);
    c.addChild(chip);
  });
  return c;
}
