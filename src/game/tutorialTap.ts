// The first battle's summon step takes more than the summon button: while it points, a tap
// anywhere on the battlefield or the space bar summons too. A newcomer on a desktop who clicks
// the field or reaches for the keyboard still gets their first potion. Nowhere else, and never
// after that step.

import type { FederatedPointerEvent } from 'pixi.js';
import type { Game } from '../app';
import { WALL_BOTTOM } from '../view/battleView/wall';
import { Button } from '../view/ui';
import { DESIGN_W } from '../view/viewport';

/** Whether the summon step points right now, with nothing over the battle. */
export function summonStep(g: Game): boolean {
  const b = g.battle;
  return !!b && !!g.tutorial && g.root.visible && !g.overlay.visible && !g.pause.open && g.tutorial.showing(b) === 'summon';
}

/** A point in the battle view's own units is on the field: the ground and the wall, down to the
 *  wall's foot (the buttons and the commander below it keep their own taps). */
export function onField(x: number, y: number): boolean {
  return x >= 0 && x <= DESIGN_W && y >= 0 && y <= WALL_BOTTOM;
}

/** Listens for the summon step's taps and key for the rest of the session. */
export function tapToSummon(g: Game): void {
  const stage = g.app.stage;
  stage.eventMode = 'static';
  stage.hitArea = g.app.screen;
  stage.on('pointerdown', (e: FederatedPointerEvent) => {
    if (!summonStep(g) || onControl(g, e)) return;
    const p = g.view.toLocal(e.global);
    if (onField(p.x, p.y)) g.battle?.summon();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || !summonStep(g)) return;
    e.preventDefault();
    g.battle?.summon();
  });
}

/** The tap was on a button or on the tutorial's card (its skip), which do their own thing. */
function onControl(g: Game, e: FederatedPointerEvent): boolean {
  for (let o = e.target as unknown as { parent: unknown } | null; o; o = o.parent as typeof o) {
    if (o instanceof Button || o === g.lessons) return true;
  }
  return false;
}
