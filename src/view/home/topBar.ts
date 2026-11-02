// The home screen's top bar: the daily login, the daily tasks, the settings, (in the first week)
// the welcome gifts and (where the host has them) the leaderboards as medals, and the crystals
// top right.

import { Container, Graphics } from 'pixi.js';
import { formatAmount, t } from '../../i18n';
import type { MetaSave } from '../../sim/meta';
import { welcomeOn } from '../../sim/welcome';
import { calendarIcon, chestIcon, gearIcon, ink, LIGHT, medal, redDot, scrollIcon, tappable } from '../kit';
import { gem } from '../ui';
import { trophyIcon } from './boardPanel';
import { caption } from './shared';
import type { HomeActions } from './types';

/** How far apart the medals are, and how much bigger they are on a wide page. */
export const BAR_STEP = 156;
export const BAR_WIDE = 1.15;
/** How far past `left` the bar's last medal and its caption reach. */
export function barEnd(m: MetaSave, wide: boolean, board: boolean): number {
  const n = 3 + (welcomeOn(m) ? 1 : 0) + (board ? 1 : 0);
  return (90 + (n - 1) * BAR_STEP + 76) * (wide ? BAR_WIDE : 1);
}

/** `dots`: the welcome gifts', the login's and the tasks' red dots (view/homeDots.ts); `board`:
 *  the leaderboards' medal. */
export function topBar(root: Container, m: MetaSave, act: HomeActions, left: number, w: number, wide: boolean, dots: { welcome: boolean; login: boolean; tasks: boolean }, board = false): void {
  // a wide page has the room for bigger medals
  const k = wide ? BAR_WIDE : 1;
  const y = 72 * k;
  let slot = 0;
  const button = (id: string, icon: Container, text: string, dot: boolean, onTap: () => void) => {
    const c = tappable(new Container(), onTap);
    c.label = `top_${id}`;
    c.position.set(left + (90 + slot++ * BAR_STEP) * k, y);
    c.scale.set(k);
    icon.scale.set(0.72);
    // the caption sits on its own cream plate over the medal's foot
    const cap = caption(text);
    const plate = new Graphics()
      .roundRect(-cap.width / 2 - 12, -cap.height / 2 - 4, cap.width + 24, cap.height + 8, 18)
      .fill(LIGHT.face)
      .stroke({ width: 3, color: LIGHT.edge });
    plate.y = cap.y = 58 + Math.max(0, cap.height - 38) / 2;
    c.addChild(medal(56), icon, plate, cap);
    if (dot) redDot(c, 42, -42);
    root.addChild(c);
  };
  button('login', calendarIcon(), t('top.login'), dots.login, () => act.panel('login'));
  button('tasks', scrollIcon(), t('top.tasks'), dots.tasks, () => act.panel('tasks'));
  button('settings', gearIcon(40), t('top.settings'), false, () => act.panel('settings'));
  // the welcome week's gifts, while there are any left
  if (welcomeOn(m)) button('welcome', chestIcon(), t('welcome.button'), dots.welcome, () => act.panel('welcome'));
  if (board) button('board', trophyIcon(), t('board.button'), false, () => act.panel('board'));

  // the crystals in a dark inset, top right
  const count = ink(formatAmount(m.crystals), 50, { fill: LIGHT.crystal });
  const pw = Math.max(240, count.width + 120);
  const purse = new Container();
  // found by the claim animation, which flies crystals into it
  purse.label = 'purse';
  count.label = 'purseCount';
  purse.position.set(w - 40 - (pw / 2) * k, y);
  purse.scale.set(k);
  purse.addChild(
    new Graphics().roundRect(-pw / 2, -40, pw, 80, 40).fill(LIGHT.inset).stroke({ width: 4, color: LIGHT.edge }),
    gem(new Graphics(), -pw / 2 + 40, 0, 34),
  );
  count.x = 22;
  purse.addChild(count);
  root.addChild(purse);
}
