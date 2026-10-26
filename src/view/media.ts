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

/** A phone or tablet with no mouse. */
export function touchOnly(): boolean {
  return query('(hover: none) and (pointer: coarse)');
}

/** The shorter side, in CSS pixels, below which a touch screen is a phone: the largest iPhone is
 *  430 wide, the smallest iPad 744 and Android tablets 600 up. */
export const PHONE_SHORT_SIDE = 600;

/** A phone: a touch-only device whose whole screen (not the page, which a portal's iframe makes
 *  any size) is narrow on its shorter side. Tablets and desktops play either way round. */
export function isPhone(touch: boolean = touchOnly(), screenW: number = globalThis.screen?.width ?? 0, screenH: number = globalThis.screen?.height ?? 0): boolean {
  const short = Math.min(screenW, screenH);
  return touch && short > 0 && short < PHONE_SHORT_SIDE;
}

/** The game is portrait only on a phone: held sideways it asks to be turned upright rather than
 *  playing in a narrow strip. Tablets and desktops keep their wide layout. */
export function wantsUpright(screenW: number, screenH: number, phone: boolean): boolean {
  return phone && screenW > screenH;
}

/** Whether the screen shakes: the player's setting, or else not when the system asks for
 *  reduced motion. */
export function shakeOn(setting: boolean | null, reduced: boolean = reducedMotion()): boolean {
  return setting ?? !reduced;
}
