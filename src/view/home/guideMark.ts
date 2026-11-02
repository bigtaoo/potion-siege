// The home guide's mark on a button (game/homeGuide.ts): the tutorial's hand at it and a line on
// a cream card beside the hand, with a skip link. Nothing of it takes taps but the skip link, so
// the button under the hand is still the one tapped.

import { Container, Graphics, type Text } from 'pixi.js';
import { t } from '../../i18n';
import { balanced, fit as fitText, ink, LIGHT, lightPanel, lightTile, P, tappable } from '../kit';
import type { MenuFit } from '../viewport';
import { RAIL } from './nav';
import { pointer } from './pointer';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the hand comes from: below a button high on the page, above one low on it, and from
 *  the right of the wide page's rail of tabs. */
export function handSide(r: Box, fit: MenuFit): 'below' | 'above' | 'right' {
  if (fit.wide && r.x + r.w <= RAIL + 10) return 'right';
  return r.y + r.h / 2 > fit.h * 0.55 ? 'above' : 'below';
}

/** The hand's fingertip and turn for a button at `r` (0 points up). */
export function handAt(r: Box, side: 'below' | 'above' | 'right'): { x: number; y: number; rotation: number } {
  const cx = r.x + r.w / 2;
  if (side === 'right') return { x: r.x + r.w * 0.7, y: r.y + r.h * 0.7, rotation: -0.6 };
  if (side === 'above') return { x: cx + 8, y: r.y + 10, rotation: Math.PI + 0.15 };
  return { x: cx + r.w * 0.15, y: r.y + r.h - 10, rotation: 0 };
}

/** The card's centre for a `cw` x `ch` card: past the hand, kept on the page. */
export function cardAt(r: Box, side: 'below' | 'above' | 'right', cw: number, ch: number, fit: MenuFit): { x: number; y: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const reach = 200;
  let x = r.x + r.w / 2;
  let y: number;
  if (side === 'right') {
    x = r.x + r.w + reach + cw / 2;
    y = r.y + r.h / 2;
  } else y = side === 'above' ? r.y - reach - ch / 2 : r.y + r.h + reach + ch / 2;
  return { x: clamp(x, cw / 2 + 20, fit.w - cw / 2 - 20), y: clamp(y, ch / 2 + 20, fit.h - ch / 2 - 20) };
}

/** Puts the mark for `target` on `root`: the hand (unless the screen draws its own) and, when
 *  there is one, the line with the skip link (none when `onSkip` is null). A button in a panel
 *  (`inPanel`) has both from below, so the line sits past the panel's foot, not over what the
 *  panel shows. */
export function guideMark(root: Container, target: Container, text: string | null, hand: boolean, fit: MenuFit, onSkip: (() => void) | null, inPanel = false): void {
  const b = target.getBounds();
  const a = root.toLocal({ x: b.x, y: b.y });
  const z = root.toLocal({ x: b.x + b.width, y: b.y + b.height });
  const r: Box = { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
  const side = inPanel ? 'below' : handSide(r, fit);
  const mark = new Container();
  mark.label = 'guideMark';
  if (text) mark.addChild(card(r, side, text, fit, onSkip));
  if (hand) {
    const at = handAt(r, side);
    mark.addChild(glow(r), pointer(at.x, at.y, at.rotation, 0.8));
  }
  root.addChild(mark);
}

function card(r: Box, side: 'below' | 'above' | 'right', text: string, fit: MenuFit, onSkip: (() => void) | null): Container {
  const cw = Math.min(fit.wide ? 640 : 820, fit.w - 80);
  const body: Text = balanced(text, 44, cw - (onSkip ? 300 : 80), { fill: LIGHT.edge, lineHeight: 58 });
  const ch = Math.max(130, body.height + 60);
  const c = new Container();
  c.label = 'guideCard';
  c.eventMode = 'passive';
  const at = cardAt(r, side, cw, ch, fit);
  c.position.set(at.x, at.y);
  const panel = lightPanel(cw, ch);
  panel.eventMode = 'none';
  body.anchor.set(0, 0.5);
  body.position.set(-cw / 2 + 40, 0);
  c.addChild(panel, body);
  if (onSkip) {
    const skip = new Container();
    const word = fitText(ink(`${t('guide.skip')} ›`, 32, { fill: P.inkSoft }), 170);
    skip.addChild(lightTile(190, 64), word);
    skip.label = 'guideSkip';
    skip.position.set(cw / 2 - 30 - 95, 0);
    c.addChild(tappable(skip, onSkip));
  }
  return c;
}

/** A thin glow round the pointed button, so the hand reads as "this one". */
export function glow(r: Box): Graphics {
  return new Graphics().roundRect(r.x - 8, r.y - 8, r.w + 16, r.h + 16, 30).stroke({ width: 8, color: P.brassLight, alpha: 0.7 });
}
