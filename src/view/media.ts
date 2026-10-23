// What the system says about the player and the device, from CSS media queries; hosts without
// them answer no to both.

const query = (q: string): boolean => typeof matchMedia === 'function' && matchMedia(q).matches;
/** Kept, as the battle asks every frame. */
const reduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** The player's "reduce motion" wish: no screen shake unless they turn it on, and softer
 *  white flashes. */
export function reducedMotion(): boolean {
  return reduce?.matches ?? false;
}

/** A phone or tablet with no mouse: held sideways it gets the "turn upright" cover. */
export function touchOnly(): boolean {
  return query('(hover: none) and (pointer: coarse)');
}

/** The game is portrait only on a touch device: held sideways it asks to be turned upright
 *  rather than playing in a narrow strip. Desktops, wide as they are, keep their layout. */
export function wantsUpright(screenW: number, screenH: number, touch: boolean): boolean {
  return touch && screenW > screenH;
}

/** Whether the screen shakes: the player's setting, or else not when the system asks for
 *  reduced motion. */
export function shakeOn(setting: boolean | null, reduced: boolean = reducedMotion()): boolean {
  return setting ?? !reduced;
}
