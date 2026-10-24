// The settings panel over the home screen: the sound, shake and vibration switches, the language, the play data switch
// with the player ID and the privacy buttons, with the icons its rows draw.

import { Container, Graphics } from 'pixi.js';
import { getLocale, localeName, t } from '../../i18n';
import type { MetaSave } from '../../sim/meta';
import { fit as fitText, ink, inkWrapped, lightTile, medal, P, PillButton, tappable, toggle } from '../kit';
import { soundSwitches, switchIcon, switchOn } from '../soundSwitches';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import { remindRow } from './remindPanel';
import type { HomeActions, PlayData, RemindState } from './types';

/** The player ID tile's height under the play data switch. */
const ID_H = 190;

/** The settings: the music, sound effects, screen shake and (where the device can) vibration
 *  switches, the language and the play data switch with
 *  the player ID, then a button each for Google's consent form again where it applies (iOS in
 *  the EEA/UK) and our privacy policy where the host allows a link out (App Review 5.1.1 wants
 *  it inside the app). */
export function settingsPanel(m: MetaSave, act: HomeActions, fit: MenuFit, privacy: boolean, policy: boolean, data: PlayData | null, vibrate: boolean, remind: RemindState | null = null): Container {
  const switches = soundSwitches(vibrate);
  const buttons: [string, () => void][] = [];
  if (privacy) buttons.push([t('sound.privacy'), act.adPrivacy]);
  if (policy) buttons.push([t('sound.policy'), act.privacyPolicy]);
  const extra = buttons.length ? 30 + buttons.length * 130 : 0;
  const rows = (data ? 190 + ID_H + 20 : 0) + (remind ? 190 : 0);
  const h = 750 + (switches.length - 2) * 190 + extra + rows;
  const { panel, box } = frame(act, t('sound.settings'), h, fit);
  const top = -h / 2 + 200 - (extra ? 10 : 0);
  buttons.forEach(([text, tap], i) => {
    const b = new PillButton(text, 600, 100, 'brass', tap, 40);
    b.y = h / 2 - 100 - (buttons.length - 1 - i) * 130;
    box.addChild(b);
  });
  switches.forEach((which, i) => {
    const on = switchOn(m, which);
    const r = tappable(new Container(), () => act.sound(which));
    r.position.set(0, top + i * 190);
    const icon = new Container();
    icon.position.set(-330, 0);
    icon.addChild(medal(56, on ? P.greenOn : P.wood), switchIcon(which, on));
    const name = ink(t(`sound.${which}`), 50);
    name.anchor.set(0, 0.5);
    name.position.set(-245, -4);
    fitText(name, 300);
    const sw = toggle(on);
    sw.position.set(255, -4);
    r.addChild(lightTile(860, 160), icon, name, sw);
    box.addChild(r);
  });
  // the language: its own name on a button that opens the picker
  const r = tappable(new Container(), () => act.panel('language'));
  r.position.set(0, top + switches.length * 190);
  const icon = new Container();
  icon.position.set(-330, 0);
  icon.addChild(medal(56, P.wood), globeIcon());
  const name = ink(t('sound.language'), 50);
  name.anchor.set(0, 0.5);
  name.position.set(-245, -4);
  fitText(name, 300);
  const pick = new PillButton(localeName(getLocale()), 300, 96, 'brass', () => act.panel('language'), 40);
  pick.position.set(255, -4);
  r.addChild(lightTile(860, 160), icon, name, pick);
  box.addChild(r);
  if (remind) remindRow(box, act, remind, top + (switches.length + 1) * 190, toggle);
  if (data) playDataRows(box, act, data, top + (switches.length + (remind ? 2 : 1)) * 190);
  return panel;
}

/** The play statistics switch at `y`, and under it the player ID with how to use it and, where
 *  the host has a clipboard, a button that copies it. */
function playDataRows(box: Container, act: HomeActions, data: PlayData, y: number): void {
  const r = tappable(new Container(), () => act.shareData(!data.sending));
  r.position.set(0, y);
  const icon = new Container();
  icon.position.set(-330, 0);
  icon.addChild(medal(56, data.sending ? P.greenOn : P.wood), chartIcon());
  const name = ink(t('privacy.setting'), 50);
  name.anchor.set(0, 0.5);
  name.position.set(-245, -4);
  fitText(name, 300);
  const sw = toggle(data.sending);
  sw.position.set(255, -4);
  r.addChild(lightTile(860, 160), icon, name, sw);
  box.addChild(r);

  const tile = new Container();
  tile.position.set(0, y + 80 + 20 + ID_H / 2);
  tile.addChild(lightTile(860, ID_H));
  const copy = data.id && data.copy;
  const textW = copy ? 560 : 800;
  if (!data.id) {
    // nothing sent yet: just say so, in the middle of the tile
    const none = inkWrapped(t('privacy.noId'), 32, 780);
    none.anchor.set(0.5);
    tile.addChild(none);
  } else {
    const id = ink(t('privacy.id', { id: data.id }), 32);
    id.anchor.set(0, 0.5);
    id.position.set(-400, -ID_H / 2 + 42);
    fitText(id, textW);
    tile.addChild(id);
    const help = inkWrapped(t('privacy.idHelp'), 30, textW, { fill: P.inkSoft, align: 'left' });
    help.anchor.set(0, 0);
    help.position.set(-400, -ID_H / 2 + 72);
    tile.addChild(help);
  }
  if (copy) {
    const done = data.note === 'copied';
    const caption = done ? t('privacy.copied') : data.note === 'failed' ? t('privacy.copyFailed') : t('privacy.copy');
    const b = new PillButton(caption, 230, 96, done ? 'green' : 'brass', act.copyId, 36);
    b.position.set(295, 0);
    tile.addChild(b);
  }
  box.addChild(tile);
}
/** Three rising bars: play statistics. */
function chartIcon(): Graphics {
  return new Graphics()
    .roundRect(-26, 2, 14, 22, 3)
    .roundRect(-7, -10, 14, 34, 3)
    .roundRect(12, -24, 14, 48, 3)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line });
}
/** A globe: the rim, the equator and two meridians. */
function globeIcon(): Graphics {
  return new Graphics()
    .circle(0, 0, 30)
    .fill(0x6fb7d8)
    .stroke({ width: 4, color: P.line })
    .ellipse(0, 0, 13, 30)
    .stroke({ width: 4, color: P.cream })
    .moveTo(-30, 0)
    .lineTo(30, 0)
    .moveTo(-26, -14)
    .lineTo(26, -14)
    .moveTo(-26, 14)
    .lineTo(26, 14)
    .stroke({ width: 4, color: P.cream })
    .circle(0, 0, 30)
    .stroke({ width: 4, color: P.line });
}
