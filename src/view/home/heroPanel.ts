// A potion's panel over the home screen: its level, its starting cards, its milestones and the
// level-up button.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { heroCost, heroDamage, heroUnlocked, type MetaSave } from '../../sim/meta';
import { baseSkills, MILESTONES, skillHeroes } from '../../sim/skills';
import { BALANCE, type HeroKind } from '../../sim/types';
import { bottle, fit as fitText, ink, inkWrapped, lightTile, lock, P, PillButton } from '../kit';
import { HERO_COLORS, label } from '../ui';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import { priced } from './shared';
import type { HomeActions } from './types';

/** One hero: its level, the skill cards it starts with and what each milestone unlocks. */
export function heroPanel(m: MetaSave, act: HomeActions, kind: HeroKind, fit: MenuFit): Container {
  const h = 1440;
  const { panel, box } = frame(act, t(`hero.${kind}`), h, fit);
  const lv = m.heroes[kind];
  const top = -h / 2;
  const bt = bottle(kind, 220);
  bt.position.set(-300, top + 250);
  box.addChild(new Graphics().circle(-300, top + 250, 120).fill({ color: HERO_COLORS[kind], alpha: 0.2 }), bt);
  const level = ink(`Lv ${lv} / ${BALANCE.meta.heroMax}`, 56);
  level.anchor.set(0, 0.5);
  level.position.set(-150, top + 210);
  const dmg = fitText(ink(t('heroDamage', { p: Math.round(BALANCE.meta.heroDamage * 100), n: Math.round((heroDamage(lv) - 1) * 100) }), 34, { fill: P.inkSoft }), 570);
  dmg.anchor.set(0, 0.5);
  dmg.position.set(-150, top + 290);
  box.addChild(level, dmg);

  const head = ink(t('baseCards'), 38, { fill: P.brassDark });
  head.position.set(0, top + 420);
  const base = baseSkills(kind).map((id) => t(`skill.${id}.name`)).join('  ·  ');
  const P2 = BALANCE.heroes.poison;
  const cards = base
    ? fitText(ink(base, 40), 860)
    : fitText(ink(kind === 'poison' ? t('rust', { p: Math.round(P2.rustStep * 100), n: P2.rustMax }) : '', 34), 860);
  cards.position.set(0, top + 480);
  box.addChild(head, cards);

  let y = top + 554;
  MILESTONES[kind].forEach((ms) => {
    const on = lv >= ms.level;
    const r = new Container();
    const lvTag = ink(`Lv.${ms.level}`, 38, { fill: on ? P.brassDark : P.inkSoft });
    lvTag.position.set(-350, 0);
    let what: string;
    let needs = '';
    let detail = '';
    if ('perk' in ms) {
      what = t(`perk.${ms.perk}`);
    } else {
      const other = skillHeroes(ms.skill).with;
      const name = t(`skill.${ms.skill}.name`);
      what = other ? t('unlockRecipe', { name }) : t('unlockSkill', { name });
      if (other) needs = t('recipeNeeds', { with: t(`hero.${other}`) });
      detail = t(`skill.${ms.skill}.desc`);
    }
    // the line, what a recipe needs and the detail as one block with even gaps, centred in the row
    const text = new Container();
    const a = inkWrapped(what, 34, 600, { align: 'left', lineHeight: 42 });
    a.anchor.set(0, 0);
    text.addChild(a);
    let ty = a.height + 6;
    if (needs) {
      const n = ink(needs, 26, { fill: P.brassDark });
      n.anchor.set(0, 0);
      n.y = ty;
      text.addChild(n);
      ty += n.height + 2;
    }
    if (detail) {
      const d = inkWrapped(detail, 26, 600, { fill: P.inkSoft, align: 'left', lineHeight: 32 });
      d.anchor.set(0, 0);
      d.y = ty;
      text.addChild(d);
    }
    // the row grows with a long recipe line
    const rh = Math.max(132, text.height + 32);
    r.position.set(0, y + rh / 2);
    y += rh + 18;
    r.addChild(lightTile(860, rh, 22));
    if (on) r.addChild(new Graphics().roundRect(-436, -rh / 2 - 6, 872, rh + 12, 26).stroke({ width: 7, color: P.brass }));
    // a CJK opening bracket carries its blank half on the left; pull it back to the column edge
    text.position.set(what.startsWith('「') ? -277 : -260, -text.height / 2);
    r.addChild(lvTag, text);
    if (on) {
      const tick = label('✓', 52, { fill: 0x5cc66a, stroke: { color: P.line, width: 8 } });
      tick.position.set(380, 0);
      r.addChild(tick);
    } else {
      const l = lock();
      l.position.set(380, 4);
      r.addChild(l);
      r.alpha = 0.8;
    }
    box.addChild(r);
  });

  // the next level and the button that buys it along the bottom; the panel stays open after
  const foot = h / 2 - 100;
  const cost = heroCost(lv);
  if (cost === null) {
    const max = ink(t('maxed'), 50, { fill: P.brassDark });
    max.y = foot;
    box.addChild(max);
    return panel;
  }
  if (!heroUnlocked(m, kind)) return panel;
  const next = ink(t('heroNext', { n: lv + 1, p: Math.round((heroDamage(lv + 1) - 1) * 100) }), 38, { fill: 0x2b6a33, fontWeight: '900' });
  next.anchor.set(0, 0.5);
  next.position.set(-410, foot);
  fitText(next, 450);
  const b = priced(
    new PillButton(String(cost), 340, 110, 'purple', () => {
      act.hero(kind);
      act.panel(kind);
    }, 48, true),
    m.crystals >= cost,
  );
  b.position.set(250, foot - 4);
  box.addChild(next, b);
  return panel;
}
