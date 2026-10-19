// The home screen's five tabs, along the bottom or down the left side, and the sizes of the
// bars the page is laid out around.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { bookIcon, bottle, chestIcon, fit as fitText, gearIcon, ink, LIGHT, medal, P, redDot, swordsIcon, tappable } from '../kit';
import type { MenuFit } from '../viewport';
import { pointer } from './pointer';
import { HOME_TABS, type HomeActions, type HomeTab } from './types';

/** Bottom bar height on a portrait page, side rail width on a landscape one, top bar height. */
export const NAV = 210;
export const RAIL = 230;
export const TOP = 150;
/** The five tabs: along the bottom of a portrait page, down the left of a landscape one; the
 *  battle tab in the middle is a big raised medallion. */
export function nav(root: Container, act: HomeActions, tab: HomeTab, fit: MenuFit, dots: Partial<Record<HomeTab, boolean>>, point = false): void {
  const { w, h, wide } = fit;
  const bar = new Graphics();
  if (wide) {
    bar.rect(0, 0, RAIL, h).fill(LIGHT.bar).rect(RAIL - 14, 0, 14, h).fill(P.brass).rect(RAIL - 14, 0, 4, h).fill(P.brassLight);
    bar.rect(RAIL, 0, 4, h).fill(LIGHT.edge);
  } else {
    bar.rect(0, h - NAV, w, NAV).fill(LIGHT.bar).rect(0, h - NAV, w, 14).fill(P.brass).rect(0, h - NAV + 2, w, 4).fill(P.brassLight);
    bar.rect(0, h - NAV - 4, w, 4).fill(LIGHT.edge);
  }
  root.addChild(bar);
  HOME_TABS.forEach((id, i) => {
    const slot = tappable(new Container(), () => act.tab(id));
    const span = wide ? h / HOME_TABS.length : w / HOME_TABS.length;
    if (wide) slot.position.set(RAIL / 2 - 6, span * (i + 0.5));
    else slot.position.set(span * (i + 0.5), h - NAV / 2 + 8);
    const on = id === tab;
    const big = id === 'battle';
    if (on && !big) {
      slot.addChild(
        new Graphics()
          .roundRect(-span / 2 + 14, -NAV / 2 + 18, span - 28, NAV - 40, 26)
          .fill({ color: P.brass, alpha: 0.25 })
          .stroke({ width: 4, color: P.brass, alpha: 0.8 }),
      );
    }
    const icon = navIcon(id);
    if (big) {
      // clear of its caption below, and in portrait of the challenge card above
      const lift = wide ? -12 : -26;
      const md = medal(92, on ? 0x3c9a4a : P.wood);
      md.y = lift - 14;
      icon.y = lift - 14;
      icon.scale.set(0.95);
      slot.addChild(md);
    } else {
      icon.y = -22;
      icon.scale.set(on ? 0.95 : 0.8);
    }
    // inside the lit tab's plate (span - 28 wide), and in the rail inside the rail
    const cap = fitText(ink(t(`tabs.${id}`), 34, { fill: on ? P.brassDark : P.ink }), Math.min(span, RAIL) - 40);
    cap.y = big ? (wide ? 108 : 74) : 58;
    slot.addChild(icon, cap);
    if (dots[id]) redDot(slot, big ? 70 : 46, big ? (wide ? -96 : -110) : -62);
    if (!on) slot.alpha = big ? 1 : 0.85;
    root.addChild(slot);
    // the pointer comes down onto the potions tab from above right, or up into its rail slot from below
    if (point && id === 'potions') {
      root.addChild(wide ? pointer(slot.x + 40, slot.y + 64, -0.6, 0.8) : pointer(slot.x + 22, slot.y - NAV / 2 + 6, Math.PI + 0.5));
    }
  });
}
function navIcon(id: HomeTab): Container {
  if (id === 'potions') return bottle('fire', 110);
  if (id === 'workshop') return gearIcon();
  if (id === 'battle') return swordsIcon();
  if (id === 'codex') return bookIcon();
  return chestIcon();
}
