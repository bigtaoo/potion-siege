// The battle field turned on its side for a wide screen (?wide=land, a prototype). Only the view
// turns: the sim keeps its upright field, a sim point (x, y) lands on the screen at
// (DESIGN_H - y, x), so the enemies come in from the right and the wall stands up on the left.
// The figures and the words on the field are turned back upright where they stand.

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { DESIGN_H } from './viewport';

const TURN = Math.PI / 2;

/** Turns `view` on its side, or back upright. */
export function turnView(view: Container, land: boolean): void {
  view.rotation = land ? TURN : 0;
  view.pivot.set(0, land ? DESIGN_H : 0);
}

/** The rotation each figure was last left at here and the turn back it was given, to tell a
 *  figure the view set again from one it left alone since. */
const given = new WeakMap<Container, { at: number; back: number }>();
/** Whether any view was turned yet: until then there is nothing to stand up or undo. */
let turned = false;

/** Stands the figures of a turned view back up, or lets them lie with it again once the view is
 *  upright: the sprites and words among the view's children from `first` on (the field art under
 *  it stays turned), and the figures in its layers, each about its own anchor; the drawn ones (the
 *  wall, the grid, the bars) turn with the field. Run after the view has drawn its frame. */
export function keepUpright(view: Container, first: Container): void {
  turned ||= view.rotation !== 0;
  if (!turned) return;
  const back = -view.rotation;
  for (const layer of view.children.slice(view.children.indexOf(first))) {
    if (layer instanceof Graphics) continue;
    if (layer instanceof Sprite || layer instanceof Text) upright(layer, back);
    else for (const c of layer.children) if (!(c instanceof Graphics)) upright(c, back);
  }
}

function upright(c: Container, back: number): void {
  const was = given.get(c);
  const left = was?.at === c.rotation;
  if (left && was.back === back) return;
  c.rotation = (left ? c.rotation - was.back : c.rotation) + back;
  given.set(c, { at: c.rotation, back });
}
