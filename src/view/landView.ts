// The battle field turned on its side for a wide screen. Only the view turns: the sim keeps its
// upright field, a sim point (x, y) lands on the screen at (DESIGN_H - y, x), so the enemies come
// in from the right and the wall stands up on the left. The figures and the words on the field
// are turned back upright where they stand, and what sits above, below or beside a figure on the
// screen (its feet, its bar, a note floating up) is put there through `aside`.

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { DESIGN_H } from './viewport';

const TURN = Math.PI / 2;

/** Whether the battle view lies on its side now (there is one battle view). */
let lying = false;

/** Turns `view` on its side, or back upright. */
export function turnView(view: Container, land: boolean): void {
  lying = land;
  view.rotation = land ? TURN : 0;
  view.pivot.set(0, land ? DESIGN_H : 0);
}

/** Whether the battle view lies on its side. */
export function isLand(): boolean {
  return lying;
}

/** One point handed back by `aside`, reused: read it before the next call. */
const at = { x: 0, y: 0 };

/** The view point `dx` right of and `dy` below view point (x, y) on the screen: the same offset
 *  on an upright view, turned with the field on one lying on its side. */
export function aside(x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  at.x = lying ? x + dy : x + dx;
  at.y = lying ? y - dx : y + dy;
  return at;
}

/** Draws into `g` upright on the screen about view point (x, y): `draw` draws about the origin
 *  it is given, (x, y) itself on an upright view (nothing turned) and (0, 0) on a lying one. */
export function drawUpright(g: Graphics, x: number, y: number, draw: (ox: number, oy: number) => void): void {
  if (!lying) return draw(x, y);
  // each transform here goes on after the ones before it: turn first, then move into place
  g.save().rotateTransform(-TURN).translateTransform(x, y);
  draw(0, 0);
  g.restore();
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
