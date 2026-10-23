// The battle's pause panel and the "turn your phone upright" cover, both laid out on the whole
// screen like the menus, over the battle.

import { Container, Graphics } from 'pixi.js';
import { t } from '../i18n';
import type { MetaSave } from '../sim/meta';
import { fit as fitText, ink, lightPanel, lightTile, medal, P, PillButton, plate, tappable, toggle } from './kit';
import { soundSwitches, switchIcon, switchOn, type SoundSwitch } from './soundSwitches';
import { label } from './ui';
import type { MenuFit } from './viewport';

export interface PauseActions {
  resume(): void;
  flip(which: SoundSwitch): void;
  /** Give up's first tap asks again; the second, within the wait, leaves the battle. */
  giveUp(): void;
}

const ROW = 170;

/** Paused: Resume on top, the switches (vibration where the device can), and Give up, red with
 *  "tap again" while it waits for the second tap; none in a new player's first battle. */
export function pausePanel(m: MetaSave, act: PauseActions, fit: MenuFit, vibrate: boolean, canGiveUp: boolean, confirming: boolean): Container {
  const p = new Container();
  const shade = new Graphics().rect(0, 0, fit.w, fit.h).fill({ color: 0x1a120a, alpha: 0.6 });
  shade.eventMode = 'static'; // the battle under it takes no taps
  const switches = soundSwitches(vibrate);
  const h = 330 + switches.length * ROW + (canGiveUp ? 150 : 0);
  const box = new Container();
  box.position.set(fit.w / 2, fit.h / 2);
  box.scale.set(Math.min(1, (fit.h - 80) / (h + 60), (fit.w - 40) / 960));
  const bg = lightPanel(940, h);
  bg.eventMode = 'static';
  const head = plate(t('pause.title'), 54, 420, 'brass', 760);
  head.y = -h / 2 + 6;
  box.addChild(bg, head);
  const top = -h / 2 + 100;
  const resume = new PillButton(t('pause.resume'), 600, 130, 'green', act.resume, 60);
  resume.label = 'resume';
  resume.y = top + 65;
  box.addChild(resume);
  switches.forEach((which, i) => {
    const on = switchOn(m, which);
    const r = tappable(new Container(), () => act.flip(which));
    r.label = `switch-${which}`;
    r.y = top + 160 + ROW / 2 + i * ROW;
    const icon = new Container();
    icon.position.set(-330, 0);
    icon.addChild(medal(52, on ? P.greenOn : P.wood), switchIcon(which, on));
    const name = ink(t(`sound.${which}`), 46);
    name.anchor.set(0, 0.5);
    name.position.set(-250, -4);
    fitText(name, 310);
    const sw = toggle(on);
    sw.position.set(255, -4);
    r.addChild(lightTile(860, ROW - 20), icon, name, sw);
    box.addChild(r);
  });
  if (canGiveUp) {
    const give = new PillButton(t(confirming ? 'pause.confirm' : 'pause.giveUp'), confirming ? 640 : 420, 110, confirming ? 'red' : 'brass', act.giveUp, 44);
    give.label = 'giveUp';
    give.y = h / 2 - 95;
    box.addChild(give);
  }
  p.addChild(shade, box);
  return p;
}

/** The whole screen dark with a phone turning upright and the words under it; takes every tap. */
export function uprightCover(fit: MenuFit): Container {
  const c = new Container();
  const shade = new Graphics().rect(0, 0, fit.w, fit.h).fill(0x1a120a);
  shade.eventMode = 'static';
  const phone = new Graphics()
    .roundRect(-60, -105, 120, 210, 18)
    .fill(P.cream)
    .stroke({ width: 8, color: P.line })
    .roundRect(-44, -82, 88, 150, 6)
    .fill(0x6fb7d8)
    .circle(0, 88, 8)
    .fill(P.line);
  phone.position.set(fit.w / 2, fit.h / 2 - 90);
  // a turn arrow round it: from lying down to standing up
  const arrow = new Graphics()
    .arc(fit.w / 2, fit.h / 2 - 90, 150, -2.6, -0.5)
    .stroke({ width: 10, color: P.brassLight, cap: 'round' });
  const head = new Graphics()
    .poly([-16, -16, 22, 0, -16, 16])
    .fill(P.brassLight);
  head.position.set(fit.w / 2 + 150 * Math.cos(-0.5), fit.h / 2 - 90 + 150 * Math.sin(-0.5));
  head.rotation = -0.5 + Math.PI / 2;
  const words = label(t('rotate'), 56, { stroke: { color: P.line, width: 8 } });
  words.position.set(fit.w / 2, fit.h / 2 + 130);
  fitText(words, fit.w - 80);
  c.addChild(shade, arrow, head, phone, words);
  return c;
}
