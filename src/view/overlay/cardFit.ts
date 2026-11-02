// How the skill cards on offer share one look (skillCard.ts draws them): every name in a row at
// one size, every description at one size, the biggest that all of them fit. A description that
// runs long wraps onto more lines under a smaller picture instead of shrinking to a crumb.

import type { Text } from 'pixi.js';
import { t } from '../../i18n';
import { skillHeroes, type SkillId } from '../../sim/skills';
import { balanced, P } from '../kit';
import { label } from '../ui';

export const CARD_W = 320;
export const CARD_H = 640;
/** The name band's height, and the room inside it for the words. */
export const BAND = 130;
/** The words' width inside the card's 10-wide margins. */
const INNER = CARD_W - 20;
/** The description's sizes, biggest first; the last is the floor. */
export const DESC_SIZES = [34, 31, 28, 25] as const;
/** The biggest a name is drawn. */
const TITLE_MAX = 50;

/** The picture: big, or small to give a long description more lines. */
export interface Picture {
  /** Its centre's y, the circle's radius and the icon's scale. */
  y: number;
  r: number;
  scale: number;
}

/** The size every card in a row draws its name and description at, and its picture. */
export interface CardLook {
  title: number;
  desc: number;
  small: boolean;
}

/** The picture's place: under the band, big or small. */
export function picture(small: boolean): Picture {
  const top = -CARD_H / 2 + BAND;
  return small ? { y: top + 92, r: 70, scale: 0.72 } : { y: top + 150, r: 118, scale: 1.25 };
}

/** Where a description starts, and the room it has above the pips. */
export function descRoom(small: boolean, recipe: boolean): { y: number; room: number } {
  const p = picture(small);
  const y = p.y + p.r + (recipe ? 42 : 22);
  return { y, room: CARD_H / 2 - 62 - 14 - y };
}

/** A name at `size`, wrapped only at spaces. */
export function titleText(title: string, size: number): Text {
  return label(title, size, { wordWrap: true, breakWords: false, wordWrapWidth: INNER - 30, stroke: { color: P.line, width: 6 } });
}

/** A description at `size`, wrapped to the card. */
export function descText(text: string, size: number): Text {
  return balanced(text, size, INNER - 36, { align: 'center', lineHeight: Math.round(size * 1.28) });
}

/** The size a name shows at on its own: small enough that its longest word fits the band whole,
 *  and its lines the band's height. */
function titleSize(title: string): number {
  const longest = Math.max(
    ...title.split(' ').map((word) => {
      const probe = label(word, TITLE_MAX, { stroke: { color: P.line, width: 6 } });
      const pw = probe.width;
      probe.destroy();
      return pw;
    }),
  );
  const size = Math.min(TITLE_MAX, Math.floor((TITLE_MAX * (INNER - 30)) / longest));
  const probe = titleText(title, size);
  const h = probe.height;
  probe.destroy();
  return h > BAND - 16 ? Math.floor((size * (BAND - 16)) / h) : size;
}

/** The biggest description size that fits whole in `room`, or 0 when not even the floor does. */
function descSize(text: string, room: number): number {
  for (const size of DESC_SIZES) {
    const probe = descText(text, size);
    const fits = probe.height <= room && probe.width <= INNER - 12;
    probe.destroy();
    if (fits) return size;
  }
  return 0;
}

/** One look for a row of cards: the names at the smallest size any of them needs, the
 *  descriptions at the biggest size they all fit, under big pictures while that is no smaller
 *  than under small ones. */
export function cardLook(ids: readonly SkillId[]): CardLook {
  const title = Math.min(TITLE_MAX, ...ids.map((id) => titleSize(t(`skill.${id}.name`))));
  const best = (small: boolean) => Math.min(...ids.map((id) => descSize(t(`skill.${id}.desc`), descRoom(small, !!skillHeroes(id).with).room)));
  const big = best(false);
  if (big >= DESC_SIZES[DESC_SIZES.length - 2]) return { title, desc: big, small: false };
  const small = best(true);
  return small > big ? { title, desc: small, small: true } : { title, desc: Math.max(big, DESC_SIZES[DESC_SIZES.length - 1]), small: false };
}
