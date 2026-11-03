// The home guide's mark on a button (game/homeGuide.ts): the tutorial's hand at it and a line on
// a cream card beside the hand, with a skip link. Nothing of it takes taps but the skip link, so
// the button under the hand is still the one tapped. Both go where they cover least (hintPlace.ts).

import { Container, Graphics, type Text } from 'pixi.js';
import { t } from '../../i18n';
import { balanced, fit as fitText, ink, LIGHT, lightPanel, lightTile, P, tappable } from '../kit';
import type { MenuFit } from '../viewport';
import { boxIn, cheapest, cost, obstacles, overlap, placeCard, type Obstacle } from './hintPlace';
import { RAIL } from './nav';
import { pointer } from './pointer';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the hand comes from: below a button high on the page, above one low on it, and from
 *  the right of the wide page's rail of tabs; `side`, level from the right, onto a wide card's
 *  right end. */
export type Side = 'below' | 'above' | 'right' | 'side' | 'inside';

export function handSide(r: Box, fit: MenuFit): Side {
  if (fit.wide && r.x + r.w <= RAIL + 10) return 'right';
  return r.y + r.h / 2 > fit.h * 0.55 ? 'above' : 'below';
}

/** The hand's fingertip and turn for a button at `r` (0 points up); `inside` a big one (a card)
 *  it rests on the card's own lower half, off what lies round it. */
export function handAt(r: Box, side: Side): { x: number; y: number; rotation: number } {
  const cx = r.x + r.w / 2;
  if (side === 'inside') return { x: cx + r.w * 0.1, y: r.y + r.h * 0.42, rotation: 0 };
  if (side === 'right') return { x: r.x + r.w * 0.7, y: r.y + r.h * 0.7, rotation: -0.6 };
  if (side === 'side') return { x: r.x + r.w - 40, y: r.y + r.h * 0.45, rotation: -Math.PI / 2 };
  if (side === 'above') return { x: cx + 8, y: r.y + 10, rotation: Math.PI + 0.15 };
  return { x: cx + r.w * 0.15, y: r.y + r.h - 10, rotation: 0 };
}

/** The card's centre for a `cw` x `ch` card: past the hand, kept on the page. */
export function cardAt(r: Box, side: Side, cw: number, ch: number, fit: MenuFit): { x: number; y: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const reach = 200;
  let x = r.x + r.w / 2;
  let y: number;
  if (side === 'right' || side === 'side') {
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
  const r = boxIn(root, target);
  const obs = obstacles(root, target, fit);
  const side = handPick(r, fit, inPanel, obs);
  const mark = new Container();
  mark.label = 'guideMark';
  const hands = obs.filter((o) => o.weight >= 1000).map((o) => o.box);
  if (hand) {
    const at = handAt(r, side);
    const p = pointer(at.x, at.y, at.rotation, 0.8);
    const pb = p.getBounds();
    hands.push({ x: pb.x, y: pb.y, w: pb.width, h: pb.height });
    mark.addChild(glow(r), p);
  }
  if (text) mark.addChildAt(card(r, side, text, fit, onSkip, obs, hands), 0);
  root.addChild(mark);
}

/** The side the hand comes from: the usual one (below in a panel), unless another covers less
 *  of the buttons round the target or stays more on the page. */
function handPick(r: Box, fit: MenuFit, inPanel: boolean, obs: Obstacle[]): Side {
  const first = inPanel ? 'below' : handSide(r, fit);
  const sides: Side[] = [first, ...(['below', 'above', 'right'] as const).filter((s) => s !== first)];
  if (r.w >= 400) sides.push('side');
  if (r.h >= 300 && r.w >= 200) sides.push('inside');
  // a hand a few units past the edge is still whole on the screen; one further off is not seen at
  // all, which is worse than any button it could cover
  const page: Box = { x: -30, y: -30, w: fit.w + 60, h: fit.h + 60 };
  return cheapest(sides, (s) => {
    const at = handAt(r, s);
    const pb = pointer(at.x, at.y, at.rotation, 0.8).getBounds();
    const b: Box = { x: pb.x, y: pb.y, w: pb.width, h: pb.height };
    return cost(b, obs, []) + (b.w * b.h - overlap(b, page)) * OFF_PAGE;
  });
}

/** What each unit of hand off the page counts: more than a button it would cover whole (hintPlace
 *  counts those twice their area times their weight, at most 10). */
const OFF_PAGE = 100_000;

/** The line on its card: wide with the skip link beside it, or, where every wide spot covers some
 *  button (the wide codex's two rows of claims), narrow with the link under it, whichever covers
 *  least. */
function card(r: Box, side: Side, text: string, fit: MenuFit, onSkip: (() => void) | null, obs: Obstacle[], hands: Box[]): Container {
  const wide = Math.min(fit.wide ? 760 : 820, fit.w - 80);
  const ways = [lay(wide, false), ...(wide > NARROW ? [lay(NARROW, true)] : [])].map((l) => ({ ...l, at: placeCard(r, cardAt(r, side, l.cw, l.ch, fit), l.cw, l.ch, fit, obs, hands) }));
  const { cw, ch, body, stacked, at } = cheapest(ways, (w) => w.at.cost);
  for (const w of ways) if (w.body !== body) w.body.destroy();
  const c = new Container();
  c.label = 'guideCard';
  c.eventMode = 'passive';
  c.position.set(at.x, at.y);
  const panel = lightPanel(cw, ch);
  panel.eventMode = 'none';
  body.anchor.set(0, 0.5);
  body.position.set(-cw / 2 + 40, stacked && onSkip ? -SKIP_ROW / 2 : 0);
  c.addChild(panel, body);
  if (onSkip) {
    const skip = new Container();
    const word = fitText(ink(`${t('guide.skip')} ›`, 32, { fill: P.inkSoft }), 170);
    skip.addChild(lightTile(190, 64), word);
    skip.label = 'guideSkip';
    if (stacked) skip.position.set(cw / 2 - 30 - 95, ch / 2 - 30 - 32);
    else skip.position.set(cw / 2 - 30 - 95, 0);
    c.addChild(tappable(skip, onSkip));
  }
  return c;

  function lay(cw: number, stacked: boolean) {
    // left aligned like where it stands: label() centres lines, which set a short second line in
    const body: Text = balanced(text, 44, cw - (onSkip && !stacked ? 300 : 80), { fill: LIGHT.edge, lineHeight: 58, align: 'left' });
    const ch = Math.max(130, body.height + 60 + (stacked && onSkip ? SKIP_ROW : 0));
    return { cw, ch, body, stacked };
  }
}

/** The narrow card's width, and the row its skip link takes under the line. */
const NARROW = 520;
const SKIP_ROW = 80;

/** A thin glow round the pointed button, so the hand reads as "this one". */
export function glow(r: Box): Graphics {
  return new Graphics().roundRect(r.x - 8, r.y - 8, r.w + 16, r.h + 16, 30).stroke({ width: 8, color: P.brassLight, alpha: 0.7 });
}
