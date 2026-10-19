// The home screen's top bar: the daily login, the daily tasks and the settings as medals, and
// the crystals top right.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { canClaimLogin, tasksClaimable } from '../../sim/daily';
import type { MetaSave } from '../../sim/meta';
import { calendarIcon, fit as fitText, gearIcon, ink, LIGHT, medal, redDot, scrollIcon, tappable } from '../kit';
import { gem } from '../ui';
import type { HomeActions } from './types';

export function topBar(root: Container, m: MetaSave, act: HomeActions, today: string, left: number, w: number, wide: boolean): void {
  const y = wide ? 70 : 80;
  const button = (x: number, icon: Container, text: string, dot: boolean, onTap: () => void) => {
    const c = tappable(new Container(), onTap);
    c.position.set(x, y);
    icon.scale.set(0.72);
    // the caption sits on its own cream plate below the medal, clear of the brass rim
    const cap = fitText(ink(text, 24), 112);
    const plate = new Graphics()
      .roundRect(-cap.width / 2 - 12, -17, cap.width + 24, 34, 17)
      .fill(LIGHT.face)
      .stroke({ width: 3, color: LIGHT.edge });
    plate.y = cap.y = 74;
    c.addChild(medal(56), icon, plate, cap);
    if (dot) redDot(c, 42, -42);
    root.addChild(c);
  };
  button(left + 90, calendarIcon(), t('login'), canClaimLogin(m, today), () => act.panel('login'));
  button(left + 240, scrollIcon(), t('tasks'), tasksClaimable(m), () => act.panel('tasks'));
  button(left + 390, gearIcon(40), t('sound.settings'), false, () => act.panel('settings'));

  // the crystals in a dark inset, top right
  const count = ink(String(m.crystals), 50, { fill: LIGHT.crystal });
  const pw = Math.max(240, count.width + 120);
  const purse = new Container();
  // found by the claim animation, which flies crystals into it
  purse.label = 'purse';
  count.label = 'purseCount';
  purse.position.set(w - 40 - pw / 2, y);
  purse.addChild(
    new Graphics().roundRect(-pw / 2, -40, pw, 80, 40).fill(LIGHT.inset).stroke({ width: 4, color: LIGHT.edge }),
    gem(new Graphics(), -pw / 2 + 40, 0, 34),
  );
  count.x = 22;
  purse.addChild(count);
  root.addChild(purse);
}
