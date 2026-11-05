// A potion's talents (sim/talents.ts) in a panel of their own, opened from its potion panel: a
// row for each of Lv 10, 20 and 30, two cards a row. A tap picks a card, a tap on the one picked
// takes it back; switching costs nothing. Rows the potion has not reached show locked.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import type { MetaSave } from '../../sim/meta';
import { talentGrant, talentTiers, TALENT_LEVELS, type Grant } from '../../sim/talents';
import type { HeroKind } from '../../sim/types';
import { fit as fitText, ink, inkWrapped, lightTile, lock, P, tappable } from '../kit';
import { label } from '../ui';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import type { HomeActions } from './types';

const CW = 410;
const CH = 270;
const GAP = 24;

/** The card names a grant puts on, "×2" on one given twice. */
export function grantName(g: Grant): string {
  return g.map(([id, n]) => t(`skill.${id}.name`) + (n > 1 ? ` ×${n}` : '')).join(' + ');
}

export function talentPanel(m: MetaSave, act: HomeActions, kind: HeroKind, fit: MenuFit): Container {
  const h = 1340;
  const { panel, box } = frame(act, t('alchemy.talents.title', { name: t(`hero.${kind}`) }), h, fit);
  const lv = m.heroes[kind];
  const open = talentTiers(lv);
  const picks = m.alchemy.talents[kind] ?? [];
  const top = -h / 2 + 130;
  TALENT_LEVELS.forEach((level, tier) => {
    const y = top + tier * (CH + 110);
    const tag = ink(t('level', { n: level }), 40, { fill: tier < open ? P.brassDark : P.inkSoft });
    tag.position.set(0, y + 20);
    box.addChild(tag);
    ([0, 1] as const).forEach((pick) => {
      const on = picks[tier] === pick;
      const c = new Container();
      c.label = `talent_${tier}_${pick}`;
      c.position.set((pick === 0 ? -1 : 1) * (CW + GAP) / 2, y + 70 + CH / 2);
      c.addChild(lightTile(CW, CH, 22));
      if (on) c.addChild(new Graphics().roundRect(-CW / 2 - 6, -CH / 2 - 6, CW + 12, CH + 12, 26).stroke({ width: 8, color: P.brass }));
      const g = talentGrant(kind, tier, pick);
      const name = tier < 2 ? grantName(g) : t('alchemy.talents.both', { n: TALENT_LEVELS[pick] });
      const n = fitText(ink(name, 36, { fill: on ? P.brassDark : P.ink, fontWeight: '900' }), CW - 50);
      n.y = -CH / 2 + 48;
      const descText = tier < 2 ? t(`skill.${g[0]![0]}.desc`) : g.map(([id]) => t(`skill.${id}.name`)).join(' · ');
      const d = inkWrapped(descText, 28, CW - 50, { fill: P.inkSoft, lineHeight: 36 });
      d.anchor.set(0.5, 0);
      d.y = -CH / 2 + 90;
      if (d.height > CH - 110) d.scale.set((CH - 110) / d.height);
      c.addChild(n, d);
      if (tier >= open) {
        const l = lock();
        l.position.set(CW / 2 - 40, -CH / 2 + 40);
        c.addChild(l);
        c.alpha = 0.6;
      } else {
        if (on) {
          const tick = label('✓', 44, { fill: P.green, stroke: { color: P.line, width: 7 } });
          tick.position.set(CW / 2 - 36, -CH / 2 + 36);
          c.addChild(tick);
        }
        tappable(c, () => act.talent(kind, tier, on ? -1 : pick));
      }
      box.addChild(c);
    });
  });
  const free = fitText(ink(t('alchemy.talents.free'), 32, { fill: P.inkSoft }), 820);
  free.y = h / 2 - 70;
  box.addChild(free);
  return panel;
}
