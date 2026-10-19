/** A canvas stand-in for tests: pixi measures text through `OffscreenCanvas.getContext('2d')`,
 *  which node does not have. This one answers `measureText` from glyphs.json - every character
 *  the 15 locales and the view's own symbols use, measured in Chromium on Windows 11 at 100px
 *  (the wider of weights 800 and 900) in the four families ui.ts picks: FONT (Segoe UI), the
 *  Japanese one (Yu Gothic UI), the Korean one (Malgun Gothic) and the Thai one (Leelawadee UI).
 *  Summing a string's characters matched the browser's own width of the whole string within
 *  0.1% on all 5048 strings of the tables. Han, kana and Hangul missing from a table are a full
 *  em. Other phones' fonts (iOS's Hiragino, Apple SD Gothic Neo, Thonburi) run a little
 *  different, so a test on this model catches the overflows that are real on Windows Chrome.
 *
 *  Import this before anything that builds text, and fail on `unknownChars()` so a new glyph in
 *  a translation gets measured instead of guessed. */
import table from './glyphs.json';

type Group = keyof typeof table;
const widths: Record<Group, Map<string, number>> = { default: new Map(), ja: new Map(), ko: new Map(), th: new Map() };
for (const g of Object.keys(table) as Group[]) {
  for (const [w, chars] of Object.entries(table[g] as Record<string, string>)) {
    for (const c of chars) widths[g].set(c, Number(w));
  }
}

const FULL = /[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]/;
const unknown = new Set<string>();

function group(font: string): Group {
  if (font.includes('Hiragino Sans')) return 'ja';
  if (font.includes('Apple SD Gothic')) return 'ko';
  if (font.includes('Leelawadee')) return 'th';
  return 'default';
}

/** The width of `text` at 100px in the family the font string names. */
export function width100(text: string, font: string): number {
  const map = widths[group(font)];
  let w = 0;
  for (const c of text) {
    const known = map.get(c);
    if (known !== undefined) w += known;
    else if (FULL.test(c)) w += 100;
    else if (c === '\n' || c === '​') continue;
    else {
      unknown.add(c);
      w += 100;
    }
  }
  return w;
}

/** Characters measured with no entry in the table (charged a full em). */
export function unknownChars(): string[] {
  return [...unknown];
}

class Ctx {
  font = '10px sans-serif';
  letterSpacing = '0px';
  textBaseline = 'alphabetic';
  lineWidth = 1;
  lineJoin = 'miter';
  miterLimit = 10;
  measureText(text: string) {
    const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? '10');
    return {
      width: (width100(text, this.font) * px) / 100,
      // pixi's line height is the ink of |ÉqÅM: 0.93 em up, 0.24-0.25 down in all four families
      actualBoundingBoxAscent: px * 0.93,
      actualBoundingBoxDescent: px * 0.25,
    };
  }
  // the rest of a 2d context pixi may touch while measuring
  save() {}
  restore() {}
  fillText() {}
  strokeText() {}
  clearRect() {}
  fillRect() {}
  getImageData() {
    return { data: new Uint8ClampedArray(4) };
  }
}

const g = globalThis as Record<string, unknown>;
g.CanvasRenderingContext2D ??= Ctx;
g.OffscreenCanvas ??= class {
  width = 0;
  height = 0;
  getContext() {
    return new Ctx();
  }
};
