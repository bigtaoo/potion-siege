// The battle's pause: the HUD's button and a phone turned sideways open it, Resume closes it,
// Give up (a second tap within GIVE_UP_WAIT) leaves the battle for the home screen without
// booking it. The upright cover goes over everything while a phone is held sideways.

import { Container } from 'pixi.js';
import type { Game } from '../app';
import { isPhone, wantsUpright } from '../view/media';
import { pausePanel, uprightCover } from '../view/pausePanel';
import { flipSwitch } from '../view/soundSwitches';
import { fitMenu, type MenuFit } from '../view/viewport';
import { home } from './homeScreen';

/** Seconds Give up waits for its second tap. */
export const GIVE_UP_WAIT = 3;

/** The pause panel and the upright cover, over everything (the Game puts it on top). */
export class PauseLayer extends Container {
  /** The panel is up: the battle stands still. */
  open = false;
  /** Seconds left for Give up's second tap; 0 when it is not waiting. */
  confirm = 0;
  readonly panel = new Container();
  readonly cover = new Container();
  /** Only a phone is held upright; a tablet plays either way round. */
  readonly phone = isPhone();
  /** The screen size the panel and the cover were laid out for. */
  size = '';
  sideways = false;

  constructor() {
    super();
    this.addChild(this.panel, this.cover);
  }
}

/** A battle the player is in and could pause: a run, nothing over it, not over. */
function pausable(g: Game): boolean {
  const b = g.battle;
  return !!(g.run && b && !b.result && !g.ended && !g.menu.visible && !g.overlay.visible && !g.autoplay);
}

export function openPause(g: Game): void {
  if (g.pause.open || !pausable(g)) return;
  g.pause.open = true;
  g.pause.confirm = 0;
  g.platform.gameplayStop();
  draw(g);
}

function resume(g: Game): void {
  if (!g.pause.open) return;
  close(g);
  g.platform.gameplayStart();
}

function close(g: Game): void {
  g.pause.open = false;
  g.pause.confirm = 0;
  clear(g.pause.panel);
}

function giveUp(g: Game): void {
  if (g.pause.confirm <= 0) {
    g.pause.confirm = GIVE_UP_WAIT;
    draw(g);
    return;
  }
  // the run as a quit (analytics/runTracker), then home with nothing booked
  g.perf.quit();
  g.run?.close('giveup');
  close(g);
  g.store();
  home(g);
}

/** Each frame, on the menu's fit: the panel and the cover at the screen's size, the upright
 *  cover pausing a battle under it, and Give up's wait running out. */
export function pauseFrame(g: Game, dt: number, m: MenuFit): void {
  const p = g.pause;
  p.scale.set(m.scale);
  const sideways = wantsUpright(g.app.screen.width, g.app.screen.height, p.phone);
  const size = `${Math.round(m.w)}x${Math.round(m.h)}`;
  const resized = size !== p.size;
  p.size = size;
  if (sideways !== p.sideways || (sideways && resized)) {
    p.sideways = sideways;
    clear(p.cover);
    if (sideways) p.cover.addChild(uprightCover(m));
  }
  if (sideways) openPause(g);
  // a battle that ended or went away under the panel takes it with it
  if (p.open && !pausable(g)) close(g);
  if (!p.open) return;
  if (p.confirm > 0) {
    p.confirm = Math.max(0, p.confirm - dt);
    if (p.confirm === 0) draw(g);
  }
  if (resized) draw(g);
}

/** The panel again, as the save and Give up's wait now stand. */
function draw(g: Game): void {
  const p = g.pause;
  clear(p.panel);
  const m = fitMenu(g.app.screen.width, g.app.screen.height);
  // not in a new player's first battle, nor while the tutorial points
  const canGiveUp = g.save.runs > 0 && !g.tutorial;
  const actions = {
    resume: () => resume(g),
    flip: (which: Parameters<typeof flipSwitch>[1]) => {
      flipSwitch(g.save, which);
      g.audio.prefs(g.save.sound);
      g.store();
      draw(g);
    },
    giveUp: () => giveUp(g),
  };
  p.panel.addChild(pausePanel(g.save, actions, m, !!g.platform.vibrate, canGiveUp, p.confirm > 0));
}

function clear(c: Container): void {
  c.removeChildren().forEach((o) => o.destroy({ children: true }));
}
