// The rebrew panel (sim/rebrew.ts), opened from the workshop tab once the campaign is cleared or a
// rebrew is done: the essence held and the rebrews done, what a rebrew keeps and what it pours
// back, the four lasting perks with their buttons, and the rebrew button, which asks a second tap.

import { Container } from 'pixi.js';
import { t } from '../../i18n';
import { BALANCE } from '../../sim/types';
import type { MetaSave } from '../../sim/meta';
import { canRebrew, essenceFor, perkCost, perkValue, PERK_IDS, type PerkId } from '../../sim/rebrew';
import { fit as fitText, ink, inkWrapped, lightTile, P, PillButton } from '../kit';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import type { HomeActions } from './types';

/** What a perk gives at `level`, in its own words. */
export function perkText(id: PerkId, level: number): string {
  const v = perkValue(id, level);
  return t(`alchemy.rebrew.perk.${id}`, { p: Math.round(v * 100), n: v });
}

/** `sure`: the rebrew button was tapped once and waits for the second tap. */
export function rebrewPanel(m: MetaSave, act: HomeActions, fit: MenuFit, sure: boolean): Container {
  const h = 1360;
  const { panel, box } = frame(act, t('alchemy.rebrew.button'), h, fit);
  const r = m.alchemy.rebrew;
  let y = -h / 2 + 130;
  const line = (text: string, size: number, fill: number) => {
    const l = fitText(ink(text, size, { fill, fontWeight: '900' }), 840);
    l.y = y;
    box.addChild(l);
  };
  line(t('alchemy.rebrew.essence', { n: r.essence }), 48, P.brassDark);
  y += 60;
  line(t('alchemy.rebrew.count', { n: r.count }), 32, P.inkSoft);
  y += 50;
  const what = inkWrapped(t('alchemy.rebrew.what'), 30, 840, { fill: P.ink, lineHeight: 40 });
  what.anchor.set(0.5, 0);
  what.y = y;
  if (what.height > 220) what.scale.set(220 / what.height);
  box.addChild(what);
  y += Math.min(220, what.height) + 60;
  line(t('alchemy.rebrew.perks'), 40, P.ink);
  y += 50;
  const RW = 860;
  const RH = 130;
  for (const id of PERK_IDS) {
    const lv = r.perks[id];
    const max = BALANCE.alchemy.rebrew.perks[id].max;
    const row = new Container();
    row.label = `perk_${id}`;
    row.position.set(0, y + RH / 2);
    row.addChild(lightTile(RW, RH, 22));
    const name = fitText(ink(lv > 0 ? perkText(id, lv) : perkText(id, 1), 36, { fill: lv > 0 ? P.greenInk : P.inkSoft, fontWeight: '900' }), 520);
    name.anchor.set(0, 0.5);
    name.position.set(-RW / 2 + 30, -18);
    const lvTag = ink(t('levelOf', { n: lv, max }), 28, { fill: P.inkSoft });
    lvTag.anchor.set(0, 0.5);
    lvTag.position.set(-RW / 2 + 30, 30);
    row.addChild(name, lvTag);
    const cost = perkCost(id, lv);
    if (cost === null) {
      const done = ink(t('maxed'), 38, { fill: P.brassDark });
      done.x = RW / 2 - 130;
      row.addChild(done);
    } else {
      const b = new PillButton(`${cost} ✦`, 200, 86, 'purple', () => act.perk(id), 38).setEnabled(r.essence >= cost);
      b.position.set(RW / 2 - 130, 0);
      b.label = `buyPerk_${id}`;
      row.addChild(b);
    }
    box.addChild(row);
    y += RH + 18;
  }
  y += 40;
  const open = canRebrew(m);
  const go = new PillButton(
    open ? (sure ? t('alchemy.rebrew.sure') : t('alchemy.rebrew.go', { n: essenceFor(m) })) : t('alchemy.rebrew.locked', { n: BALANCE.alchemy.rebrew.from }),
    760,
    130,
    sure ? 'red' : 'green',
    () => (sure ? act.rebrew() : act.panel('rebrewSure')),
    44,
  ).setEnabled(open);
  go.label = 'rebrewGo';
  go.y = Math.min(y + 65, h / 2 - 100);
  box.addChild(go);
  return panel;
}
