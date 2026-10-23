// The iOS app's reminders on the home screen (game/reminderBook.ts): the card that offers them
// once after a battle, and their row in the settings.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { fit as fitText, ink, inkWrapped, lightTile, medal, P, PillButton, tappable } from '../kit';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import type { HomeActions, RemindState } from './types';

/** The card: what the reminders are, then remind me or no thanks. */
export function remindPanel(act: HomeActions, fit: MenuFit): Container {
  const h = 620;
  const { panel, box } = frame(act, t('remind.setting'), h, fit);
  const bell = new Container();
  bell.position.set(0, -h / 2 + 170);
  bell.addChild(medal(70, P.brass), bellIcon(1.3));
  const ask = inkWrapped(t('remind.offer'), 40, 800);
  ask.anchor.set(0.5);
  ask.position.set(0, 10);
  const yes = new PillButton(t('remind.yes'), 380, 130, 'green', () => act.remind(true), 46);
  const no = new PillButton(t('remind.no'), 340, 130, 'brass', () => act.remind(false), 46);
  yes.position.set(-200, h / 2 - 110);
  no.position.set(200, h / 2 - 110);
  box.addChild(bell, ask, yes, no);
  return panel;
}

/** The settings row at `y`: the switch, or a note that only the phone's settings can turn them
 *  back on once they were refused there. `toggle` draws the settings' switch. */
export function remindRow(box: Container, act: HomeActions, state: RemindState, y: number, toggle: (on: boolean) => Container): void {
  const on = state === 'on';
  const r = state === 'blocked' ? new Container() : tappable(new Container(), () => act.remind(!on));
  r.position.set(0, y);
  const icon = new Container();
  icon.position.set(-330, 0);
  icon.addChild(medal(56, on ? P.greenOn : P.wood), bellIcon(1));
  const name = ink(t('remind.setting'), 50);
  name.anchor.set(0, 0.5);
  name.position.set(-245, -4);
  fitText(name, 300);
  r.addChild(lightTile(860, 160), icon, name);
  if (state === 'blocked') {
    const note = inkWrapped(t('remind.blocked'), 28, 300, { fill: P.inkSoft });
    note.anchor.set(0.5);
    note.position.set(255, -4);
    r.addChild(note);
  } else {
    const sw = toggle(on);
    sw.position.set(255, -4);
    r.addChild(sw);
  }
  box.addChild(r);
}

/** A bell: the dome, its lip and the clapper. */
function bellIcon(s: number): Graphics {
  return new Graphics()
    .moveTo(-24 * s, 16 * s)
    .quadraticCurveTo(-22 * s, -26 * s, 0, -28 * s)
    .quadraticCurveTo(22 * s, -26 * s, 24 * s, 16 * s)
    .lineTo(30 * s, 22 * s)
    .lineTo(-30 * s, 22 * s)
    .closePath()
    .fill(P.cream)
    .stroke({ width: 4, color: P.line, join: 'round' })
    .circle(0, 28 * s, 7 * s)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line })
    .circle(0, -31 * s, 5 * s)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line });
}
