// Text in the workshop menus: dark ink on parchment, shrinking a text to fit, and wrapping it
// so words, numbers and short bracketed parts stay whole in every language.

import { CanvasTextMetrics, type Text, type TextStyleOptions } from 'pixi.js';
import { label } from '../ui';
import { getLocale, type Locale } from '../../i18n';
import { P } from './palette';

/** Dark ink on parchment, without the outline the labels on wood need. */
export function ink(text: string, size: number, style: TextStyleOptions = {}): Text {
  return label(text, size, { fill: P.ink, stroke: { color: P.ink, width: 0 }, ...style });
}

/** Closing punctuation stays at the end of a line instead of starting the next one. */
const NO_START = /^[，。、；：！？）」』%,.;:!?)]/;

/** The browser's word breaker where there is one (not in the ES2020 typings), one per language:
 *  Chinese, Japanese and Thai write words without spaces between them. */
type WordSegmenter = { segment(text: string): Iterable<{ segment: string }> };
const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, o: { granularity: 'word' }) => WordSegmenter }).Segmenter;
const segmenters = new Map<Locale, WordSegmenter>();
function words(): WordSegmenter | null {
  if (!Segmenter) return null;
  const l = getLocale();
  let s = segmenters.get(l);
  if (!s) segmenters.set(l, (s = new Segmenter(l, { granularity: 'word' })));
  return s;
}
/** A word or number that stays whole, in any script that puts spaces between its words (not
 *  Thai: its words come from the word breaker, and gluing them would make a clause unbreakable). */
const WORD = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Hangul}\p{M}0-9+%.×'’-]+$/u;
const CLOSE = /^[»›"”“)\]!?:;,.…，。！？：；、]+$/u;
const OPEN = /^[«‹„"“(\[¿¡]+$/u;

/** The pieces a line may break between: words and numbers whole (+12% too), Chinese and
 *  Japanese words whole where the browser can tell them (双倍, 攻速), and a short bracketed part
 *  such as （需冰霜药剂在场） or 「奥术印记」 as one piece. */
function wrapTokens(text: string): string[] {
  const seg = words();
  const raw = seg
    ? [...seg.segment(text)].map((s) => s.segment)
    : (text.match(/[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Hangul}\p{Script=Thai}\p{M}0-9+%.×'’-]+|\s+|./gu) ?? []);
  const out: string[] = [];
  let group: string | null = null;
  for (const tok of raw) {
    if (group !== null) {
      group += tok;
      if (/[）」]/.test(tok) || group.length > 12) {
        out.push(group);
        group = null;
      }
      continue;
    }
    if (/^[（「]/.test(tok) && !/[）」]/.test(tok)) {
      group = tok;
      continue;
    }
    const last = out[out.length - 1];
    // a quote or stop never starts a line nor an opening quote ends one («Цепной взрыв», „Kette“, ¡Hola!)
    if (last !== undefined && !/\s$/.test(last) && CLOSE.test(tok)) {
      out[out.length - 1] = last + tok;
      continue;
    }
    if (last !== undefined && OPEN.test(last) && !/^\s/.test(tok)) {
      out[out.length - 1] = last + tok;
      continue;
    }
    // a number keeps its unit (3 秒) and a word its one-character suffix (魔法弹)
    const glue = last !== undefined && ((/^[秒次颗层倍波关级瓶个]$/.test(tok) && /\d\s?$/.test(last)) || (/^[弹剂]$/.test(tok) && /\p{Script=Han}$/u.test(last)));
    if (last !== undefined && ((WORD.test(tok) && WORD.test(last)) || glue)) out[out.length - 1] = last + tok;
    else out.push(tok);
  }
  if (group !== null) out.push(group);
  return out;
}

/** Ink text wrapped to `width`: words and numbers stay whole, Chinese breaks between
 *  words (or characters, without a word breaker) but never before closing punctuation, which
 *  Pixi's own wrap does. */
export function inkWrapped(text: string, size: number, width: number, style: TextStyleOptions = {}): Text {
  const out = ink(text, size, style);
  const tokens = wrapTokens(text);
  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    const next = line + tok;
    if (line.trim() && !NO_START.test(tok) && CanvasTextMetrics.measureText(next, out.style).width > width) {
      lines.push(line.trimEnd());
      line = tok.trimStart();
    } else {
      line = next;
    }
  }
  lines.push(line);
  out.text = lines.join('\n');
  return out;
}

/** Wrapped text whose lines come out even: the narrowest width that still needs no more lines,
 *  so no single character is left alone on the last line. */
export function balanced(text: string, size: number, width: number, style: TextStyleOptions): Text {
  const lines = (w: number) => inkWrapped(text, size, w, style);
  let best = lines(width);
  const count = best.text.split('\n').length;
  if (count < 2) return best;
  let lo = width / 2;
  let hi = width;
  while (hi - lo > 8) {
    const mid = (lo + hi) / 2;
    const tryText = lines(mid);
    if (tryText.text.split('\n').length <= count) {
      best.destroy();
      best = tryText;
      hi = mid;
    } else {
      tryText.destroy();
      lo = mid;
    }
  }
  return best;
}

/** Shrinks a text to fit `w` across. */
export function fit<T extends Text>(text: T, w: number): T {
  if (text.width > w) text.scale.set(w / text.width);
  return text;
}
