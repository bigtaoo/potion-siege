// How each of the commander's spells looks wherever it shows: its colour and its sign on the
// charge badge, the aim ring and the floating word as it is cast.

import type { Graphics } from 'pixi.js';
import type { CommanderSkill } from '../../sim/types';

export const BOMB_COLOR = 0xff8a3d;
export const FROST_COLOR = 0x7fd8ff;
export const ACID_COLOR = 0x9be03c;

export const SPELL_COLOR: Readonly<Record<CommanderSkill, number>> = { bomb: BOMB_COLOR, frost: FROST_COLOR, acid: ACID_COLOR };

/** The word floated over the wall as each one is cast (i18n keys). */
export const SPELL_WORD = { bomb: 'castBomb', frost: 'castFrost', acid: 'castAcid' } as const;

/** The spell's sign centred on (x, y), `k` times its size on a badge of radius 34: a round flask
 *  with a fuse for the bomb, a snowflake for the frost, a dripping flask for the acid. */
export function spellSign(g: Graphics, skill: CommanderSkill, x: number, y: number, k: number, ink: number): void {
  if (skill === 'bomb') {
    g.circle(x, y + 5 * k, 13 * k).fill(ink);
    g.rect(x - 4 * k, y - 15 * k, 8 * k, 10 * k).fill(ink);
    g.moveTo(x, y - 15 * k).quadraticCurveTo(x + 8 * k, y - 24 * k, x + 13 * k, y - 18 * k).stroke({ width: 3 * k, color: 0xffe08a });
  } else if (skill === 'frost') {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      const dx = Math.cos(a) * 17 * k;
      const dy = Math.sin(a) * 17 * k;
      g.moveTo(x - dx, y - dy).lineTo(x + dx, y + dy);
    }
    g.stroke({ width: 4 * k, color: ink, cap: 'round' });
    g.circle(x, y, 5 * k).fill(ink);
  } else {
    g.roundRect(x - 10 * k, y - 12 * k, 20 * k, 22 * k, 8 * k).fill(ink);
    g.rect(x - 4 * k, y - 19 * k, 8 * k, 8 * k).fill(ink);
    g.circle(x - 5 * k, y + 16 * k, 3.5 * k).fill(ink);
    g.circle(x + 6 * k, y + 19 * k, 2.5 * k).fill(ink);
  }
}
