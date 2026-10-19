// The settings panel over the home screen: the sound toggles, the language, the play data switch
// with the player ID and the privacy buttons, with the icons and the switch its rows draw.

import { Container, Graphics } from 'pixi.js';
import { getLocale, localeName, t } from '../../i18n';
import type { MetaSave } from '../../sim/meta';
import { fit as fitText, ink, inkWrapped, LIGHT, lightTile, medal, P, PillButton, tappable } from '../kit';
import { label } from '../ui';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import type { HomeActions, PlayData } from './types';

/** The player ID tile's height under the play data switch. */
const ID_H = 190;

/** The settings: the music and sound effects toggles, the language and the play data switch with
 *  the player ID, then a button each for Google's consent form again where it applies (iOS in
 *  the EEA/UK) and our privacy policy where the host allows a link out (App Review 5.1.1 wants
 *  it inside the app). */
export function settingsPanel(m: MetaSave, act: HomeActions, fit: MenuFit, privacy: boolean, policy: boolean, data: PlayData | null): Container {
  const buttons: [string, () => void][] = [];
  if (privacy) buttons.push([t('sound.privacy'), act.adPrivacy]);
  if (policy) buttons.push([t('sound.policy'), act.privacyPolicy]);
  const extra = buttons.length ? 30 + buttons.length * 130 : 0;
  const rows = data ? 190 + ID_H + 20 : 0;
  const h = 750 + extra + rows;
  const { panel, box } = frame(act, t('sound.settings'), h, fit);
  const top = -h / 2 + 200 - (extra ? 10 : 0);
  buttons.forEach(([text, tap], i) => {
    const b = new PillButton(text, 600, 100, 'brass', tap, 40);
    b.y = h / 2 - 100 - (buttons.length - 1 - i) * 130;
    box.addChild(b);
  });
  (['music', 'sfx'] as const).forEach((which, i) => {
    const on = m.sound[which];
    const r = tappable(new Container(), () => act.sound(which));
    r.position.set(0, top + i * 190);
    const icon = new Container();
    icon.position.set(-330, 0);
    icon.addChild(medal(56, on ? 0x3c9a4a : P.wood), which === 'music' ? noteIcon() : speakerIcon(on));
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
  r.position.set(0, top + 2 * 190);
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
  if (data) playDataRows(box, act, data, top + 3 * 190);
  return panel;
}

/** The play statistics switch at `y`, and under it the player ID with how to use it and, where
 *  the host has a clipboard, a button that copies it. */
function playDataRows(box: Container, act: HomeActions, data: PlayData, y: number): void {
  const r = tappable(new Container(), () => act.shareData(!data.sending));
  r.position.set(0, y);
  const icon = new Container();
  icon.position.set(-330, 0);
  icon.addChild(medal(56, data.sending ? 0x3c9a4a : P.wood), chartIcon());
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
    const help = inkWrapped(t('privacy.idHelp'), 26, textW, { fill: P.inkSoft, align: 'left' });
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

/** An on/off switch: a green track with the knob on the right, or a grey one with it on the left. */
function toggle(on: boolean): Container {
  const c = new Container();
  const w = 220;
  const h = 96;
  const track = new Graphics()
    .roundRect(-w / 2, -h / 2 + 6, w, h, h / 2)
    .fill({ color: P.line, alpha: 0.3 })
    .roundRect(-w / 2, -h / 2, w, h, h / 2)
    .fill(on ? 0x3c9a4a : LIGHT.inset)
    .stroke({ width: 5, color: on ? P.line : LIGHT.edge });
  const kx = on ? w / 2 - h / 2 : -w / 2 + h / 2;
  const knob = new Graphics()
    .circle(kx, 4, h / 2 - 8)
    .fill({ color: P.line, alpha: 0.3 })
    .circle(kx, 0, h / 2 - 8)
    .fill(on ? P.brassLight : LIGHT.face)
    .stroke({ width: 5, color: P.line });
  const word = label(t(on ? 'sound.on' : 'sound.off'), 34, { stroke: { color: P.line, width: 6 } });
  word.position.set(on ? -h / 2 + 18 : h / 2 - 18, -3);
  fitText(word, w - h - 16);
  c.addChild(track, knob, word);
  return c;
}

/** Two beamed eighth notes. */
function noteIcon(): Graphics {
  return new Graphics()
    .poly([-16, -26, 22, -36, 22, -24, -16, -14])
    .fill(P.cream)
    .stroke({ width: 4, color: P.line, join: 'round' })
    .rect(-18, -20, 7, 44)
    .fill(P.cream)
    .rect(16, -30, 7, 44)
    .fill(P.cream)
    .ellipse(-22, 24, 12, 9)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line })
    .ellipse(12, 14, 12, 9)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line });
}

/** A speaker with sound waves, or with a cross when off. */
function speakerIcon(on: boolean): Graphics {
  const g = new Graphics()
    .poly([-30, -10, -16, -10, 2, -26, 2, 26, -16, 10, -30, 10])
    .fill(P.cream)
    .stroke({ width: 4, color: P.line, join: 'round' });
  if (on) {
    g.arc(4, 0, 14, -0.9, 0.9).stroke({ width: 6, color: P.cream, cap: 'round' });
    g.arc(4, 0, 26, -0.9, 0.9).stroke({ width: 6, color: P.cream, cap: 'round' });
  } else {
    g.moveTo(12, -12).lineTo(32, 12).moveTo(32, -12).lineTo(12, 12).stroke({ width: 7, color: P.cream, cap: 'round' });
  }
  return g;
}
