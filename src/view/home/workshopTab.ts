// The home screen's workshop tab: a card per upgrade with its level, what it gives and its price.

import { openWorkshop } from '../../sim/workshopOpen';
import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { workshopCost, workshopValue, type MetaSave, type WorkshopId } from '../../sim/meta';
import { BALANCE } from '../../sim/types';
import { canRebrew } from '../../sim/rebrew';
import { coinsIcon, redDot, fit as fitText, flask, ink, LIGHT, medal, P, paperCard, PillButton, plate, wallIcon } from '../kit';
import { gem } from '../ui';
import { priced, type Area } from './shared';
import type { HomeActions } from './types';

/** A card per upgrade: its level as pips, what it gives now and what the next level adds, and
 *  the button that buys it. The cards share the page's height, centred in it. */
export function workshopTab(root: Container, m: MetaSave, act: HomeActions, a: Area): void {
  const head = plate(t('workshop'), 52);
  // clear of the top bar's captions
  head.position.set(a.x + a.w / 2, a.y + 76);
  root.addChild(head);
  // the rebrew, once the campaign is cleared or one is done: a pill beside the heading
  const r = m.alchemy.rebrew;
  if (canRebrew(m) || r.count > 0) {
    const text = r.count > 0 ? `${t('alchemy.rebrew.button')} ×${r.count}` : t('alchemy.rebrew.button');
    const b = new PillButton(text, 280, 84, 'purple', () => act.panel('rebrew'), 34);
    b.label = 'rebrewOpen';
    b.position.set(a.x + a.w - 170, a.y + 76);
    root.addChild(b);
    if (canRebrew(m) && r.count === 0) redDot(b, 120, -34);
  }
  // big cards, together centred in the room under the heading: one column, or two on wide screens
  const ids = openWorkshop(m);
  const cols = a.wide ? 2 : 1;
  const rows = Math.ceil(ids.length / cols);
  const gap = 36;
  const rw = Math.min(1000, (a.w - 60 - (cols - 1) * gap) / cols);
  const rh = Math.max(230, Math.min(a.wide ? 300 : 360, (a.h - 186 - gap * (rows - 1)) / rows));
  const y0 = a.y + 156 + rh / 2 + Math.max(0, (a.h - 186 - rows * rh - (rows - 1) * gap) / 2);
  const xc = (c: number) => a.x + a.w / 2 + (c - (cols - 1) / 2) * (rw + gap);
  ids.forEach((id, i) => {
    const lv = m.workshop[id];
    const max = BALANCE.meta.workshop[id].max;
    const cost = workshopCost(id, lv);
    const effect = (level: number) => {
      const v = workshopValue(id, level);
      return t(`shop.${id}.desc`, { p: Math.round(v * 100), n: v });
    };
    const r = new Container();
    r.position.set(xc(i % cols), y0 + Math.floor(i / cols) * (rh + gap));
    r.addChild(paperCard(rw, rh));
    const icon = new Container();
    icon.addChild(medal(62, P.paperDark), shopIcon(id));
    icon.x = -rw / 2 + 90;
    icon.scale.set(rh >= 320 ? 1.3 : rh >= 280 ? 1.15 : 1);
    const x0 = -rw / 2 + 190;
    const bx = rw / 2 - 150;
    const room = bx - 125 - 24 - x0;
    // the name and level, the level pips, then what it gives now and what the next level gives
    const top = -104;
    const n = ink(t(`shop.${id}.name`), 46);
    n.anchor.set(0, 0.5);
    n.position.set(x0, top + 20);
    const lvTag = ink(t('levelOf', { n: lv, max }), 32, { fill: P.inkSoft });
    lvTag.anchor.set(0, 0.5);
    lvTag.position.set(x0 + n.width + 18, top + 24);
    const pips = new Graphics();
    const pw = Math.min(36, (room + 8) / max - 8);
    for (let k = 0; k < max; k++) {
      pips.roundRect(x0 + k * (pw + 8), top + 62, pw, 22, 8).fill(k < lv ? P.brass : LIGHT.inset).stroke({ width: 3, color: k < lv ? LIGHT.edge : LIGHT.insetEdge });
    }
    // nothing bought yet reads as such, not as "+0"
    const now = ink(t('shop.now', { text: lv > 0 ? effect(lv) : t('shop.none') }), 34, { fill: P.inkSoft });
    now.anchor.set(0, 0.5);
    now.position.set(x0, top + 124);
    fitText(now, room);
    r.addChild(icon, n, lvTag, pips, now);
    if (cost === null) {
      const done = ink(t('maxed'), 46, { fill: P.brassDark });
      done.x = bx;
      r.addChild(done);
    } else {
      const next = ink(t('shop.next', { text: effect(lv + 1) }), 34, { fill: P.greenInk, fontWeight: '900' });
      next.anchor.set(0, 0.5);
      next.position.set(x0, top + 170);
      fitText(next, room);
      const b = priced(new PillButton(String(cost), 250, 100, 'purple', () => act.workshop(id), 44, true), m.crystals >= cost);
      b.position.set(bx, -4);
      b.label = `buy_${id}`;
      r.addChild(next, b);
    }
    root.addChild(r);
  });
}

function shopIcon(id: WorkshopId): Container {
  if (id === 'wall') return wallIcon();
  if (id === 'startGold') return coinsIcon();
  if (id === 'lab') return flask(new Graphics(), 0, 40, 84, 0x8f5ce0, false);
  return gem(new Graphics(), 0, 0, 38);
}
