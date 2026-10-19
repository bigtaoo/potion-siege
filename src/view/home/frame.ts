// The frame every panel over the home screen sits in: a shade, the board, its title and the close button.

import { Container, Graphics } from 'pixi.js';
import { lightPanel, medal, P, plate, tappable } from '../kit';
import { label } from '../ui';
import type { MenuFit } from '../viewport';
import type { HomeActions } from './types';

/** A framed panel in the middle of the page, shrunk to fit a short one; tapping outside it
 *  closes it. */
export function frame(act: HomeActions, title: string, h: number, fit: MenuFit): { panel: Container; box: Container } {
  const p = new Container();
  const shade = new Graphics().rect(0, 0, fit.w, fit.h).fill({ color: 0x3a2614, alpha: 0.45 });
  shade.eventMode = 'static';
  shade.on('pointertap', () => act.panel(null));
  const box = new Container();
  box.position.set(fit.w / 2, fit.h / 2 + 20);
  box.scale.set(Math.min(1, (fit.h - 80) / (h + 60)));
  const bg = lightPanel(940, h);
  bg.eventMode = 'static'; // taps on the panel itself do not close it
  const head = plate(title, 54, 420, 'brass', 760);
  head.y = -h / 2 + 6;
  const close = tappable(new Container(), () => act.panel(null));
  close.position.set(440, -h / 2 + 10);
  close.addChild(medal(46, P.red), label('✕', 40, { stroke: { color: P.line, width: 6 } }));
  box.addChild(bg, head, close);
  p.addChild(shade, box);
  return { panel: p, box };
}
