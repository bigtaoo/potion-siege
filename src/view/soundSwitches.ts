// The switches the settings panel and the pause panel share: music, sound effects, screen shake
// and, where the device can, vibration, each with its icon.

import { Graphics } from 'pixi.js';
import type { MetaSave } from '../sim/meta';
import { P } from './kit';
import { shakeOn } from './media';

export type SoundSwitch = 'music' | 'sfx' | 'shake' | 'haptics';

/** The switches in their order: vibration only where the device has it. */
export function soundSwitches(vibrate: boolean): SoundSwitch[] {
  return vibrate ? ['music', 'sfx', 'shake', 'haptics'] : ['music', 'sfx', 'shake'];
}

/** What a switch shows: screen shake follows the system's reduced motion until it is set. */
export function switchOn(m: MetaSave, which: SoundSwitch): boolean {
  return which === 'shake' ? shakeOn(m.sound.shake) : m.sound[which];
}

/** Flips a switch in the save; screen shake from what it showed. */
export function flipSwitch(m: MetaSave, which: SoundSwitch): void {
  if (which === 'shake') m.sound.shake = !shakeOn(m.sound.shake);
  else m.sound[which] = !m.sound[which];
}

/** A switch's icon, drawn on a medal 56 across. */
export function switchIcon(which: SoundSwitch, on: boolean): Graphics {
  if (which === 'music') return noteIcon();
  if (which === 'sfx') return speakerIcon(on);
  if (which === 'shake') return shakeIcon();
  return phoneIcon();
}

/** Two beamed eighth notes. */
function noteIcon(): Graphics {
  return new Graphics()
    .poly([-16, -26, 22, -36, 22, -24, -16, -14])
    .fill(P.cream)
    .stroke({ width: 4, color: P.line, join: 'round' })
    .rect(-18, -20, 7, 44)
    .fill(P.cream)
    .rect(16, -30, 7, 44)
    .fill(P.cream)
    .ellipse(-22, 24, 12, 9)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line })
    .ellipse(12, 14, 12, 9)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line });
}

/** A speaker with sound waves, or with a cross when off. */
function speakerIcon(on: boolean): Graphics {
  const g = new Graphics()
    .poly([-30, -10, -16, -10, 2, -26, 2, 26, -16, 10, -30, 10])
    .fill(P.cream)
    .stroke({ width: 4, color: P.line, join: 'round' });
  if (on) {
    g.arc(4, 0, 14, -0.9, 0.9).stroke({ width: 6, color: P.cream, cap: 'round' });
    g.arc(4, 0, 26, -0.9, 0.9).stroke({ width: 6, color: P.cream, cap: 'round' });
  } else {
    g.moveTo(12, -12).lineTo(32, 12).moveTo(32, -12).lineTo(12, 12).stroke({ width: 7, color: P.cream, cap: 'round' });
  }
  return g;
}

/** A tilted frame with motion strokes either side: the screen shaking. */
function shakeIcon(): Graphics {
  const g = new Graphics();
  g.roundRect(-16, -20, 32, 40, 5).fill(P.cream).stroke({ width: 4, color: P.line });
  g.rotation = -0.18;
  g.moveTo(-26, -14).lineTo(-26, 14).moveTo(-34, -8).lineTo(-34, 8);
  g.moveTo(26, -14).lineTo(26, 14).moveTo(34, -8).lineTo(34, 8);
  g.stroke({ width: 5, color: P.cream, cap: 'round' });
  return g;
}

/** A phone with buzz zigzags either side: vibration. */
function phoneIcon(): Graphics {
  return new Graphics()
    .roundRect(-13, -26, 26, 52, 6)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line })
    .circle(0, 18, 3)
    .fill(P.line)
    .moveTo(-22, -16).lineTo(-28, -8).lineTo(-22, 0).lineTo(-28, 8).lineTo(-22, 16)
    .moveTo(22, -16).lineTo(28, -8).lineTo(22, 0).lineTo(28, 8).lineTo(22, 16)
    .stroke({ width: 4, color: P.cream, cap: 'round', join: 'round' });
}
