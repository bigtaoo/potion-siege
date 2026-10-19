// The one-time pointer the home screen shows on the potions tab and on a potion's upgrade.

import { Container } from 'pixi.js';
import { pointingHand } from '../Tutorial';

/** The one-time pointer: the tutorial's hand, its fingertip at `x, y` turned by `rotation`
 *  (0 points up); the game nudges its child back and forth (label hintHand). */
export function pointer(x: number, y: number, rotation: number, scale = 1): Container {
  const c = new Container();
  c.label = 'hintHand';
  c.eventMode = 'none';
  c.position.set(x, y);
  c.rotation = rotation;
  c.scale.set(scale);
  c.addChild(pointingHand());
  return c;
}
