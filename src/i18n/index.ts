import { en, type Table } from './en';
import { MORE, MORE_NAMES } from './more';

// English is the source: every other table is typed as Table, so a missing or extra key is a
// compile error. English ships in the main bundle; the other languages are their own chunks
// (more.ts), fetched while the game starts up when the player's language is one of them.

export type Locale = 'en' | 'zh' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'pl' | 'ru' | 'ja' | 'ko' | 'vi' | 'tr' | 'th' | 'id';
/** Every language, in the picker's order. */
export const LOCALES: readonly Locale[] = ['en', 'zh', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'ru', 'ja', 'ko', 'vi', 'tr', 'th', 'id'];

/** The tables in hand: en always, the others once loadLocale fetched them. */
const TABLES: Partial<Record<Locale, Table>> = { en };
let current: Locale = 'en';
let table: Table = en;

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

/** The first supported language among the candidates ('zh-CN', 'pt_BR'); only the base subtag
 *  counts, and 'in', Indonesian's old code, reads as 'id'. English when nothing matches. */
export function detectLocale(candidates: readonly (string | null | undefined)[]): Locale {
  for (const c of candidates) {
    const raw = c?.toLowerCase().split(/[-_]/)[0];
    const base = raw === 'in' ? 'id' : raw;
    if (isLocale(base)) return base;
  }
  return 'en';
}

/** Fetches `locale`'s table if it is not in hand yet; false when the fetch failed (offline), and
 *  the caller stays in the language it had. */
export async function loadLocale(locale: Locale): Promise<boolean> {
  if (TABLES[locale]) return true;
  const load = MORE[locale];
  if (!load) return false;
  try {
    TABLES[locale] = await load();
    return true;
  } catch {
    return false;
  }
}

/** Switches to `locale`, if its table is in hand (loadLocale first); English otherwise. */
export function setLocale(locale: Locale): Locale {
  current = TABLES[locale] ? locale : 'en';
  table = TABLES[current] ?? en;
  return current;
}

export function getLocale(): Locale {
  return current;
}

/** A language's own name for itself, for the picker. */
export function localeName(locale: Locale): string {
  return TABLES[locale]?.lang.name ?? MORE_NAMES[locale] ?? locale;
}

type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
export type TextKey = Paths<Table>;

/**
 * The string for a dotted key, with {name} placeholders filled in; {n|one:day|other:days} picks
 * the word for the count `n` by the language's plural rules (few and many too, for Polish or
 * Russian; a missing form reads `other`).
 */
export function t(key: TextKey, params: Record<string, string | number> = {}): string {
  let v: unknown = table;
  for (const part of key.split('.')) v = (v as Record<string, unknown>)[part];
  return String(v)
    .replace(/\{(\w+)\|([^{}]+)\}/g, (whole, name: string, forms: string) => (name in params ? pluralForm(forms, Number(params[name]), current) : whole))
    .replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

const RULES: Partial<Record<Locale, Intl.PluralRules | null>> = {};

/** `n`'s plural category in `locale`; English's rule where Intl.PluralRules is missing (old webviews). */
export function pluralCategory(n: number, locale: Locale): string {
  if (RULES[locale] === undefined) {
    try {
      RULES[locale] = typeof Intl !== 'undefined' && Intl.PluralRules ? new Intl.PluralRules(locale) : null;
    } catch {
      RULES[locale] = null;
    }
  }
  return RULES[locale]?.select(n) ?? (n === 1 ? 'one' : 'other');
}

/** The form for `n` out of "one:day|other:days". */
function pluralForm(forms: string, n: number, locale: Locale): string {
  const found = new Map<string, string>();
  for (const part of forms.split('|')) {
    const at = part.indexOf(':');
    if (at > 0) found.set(part.slice(0, at), part.slice(at + 1));
  }
  return found.get(pluralCategory(n, locale)) ?? found.get('other') ?? '';
}

/**
 * A compact amount in the language's own style (12.3K, 1,2 k, 4,5 Mio., 1.2万), from
 * Intl.NumberFormat; one decimal below ten of a unit, none above. Where Intl has no compact
 * notation (old webviews) English's k and M, and 万/亿 in Chinese, Japanese (万, 億) and Korean
 * (만, 억). Below the first step the number is exact.
 */
const STEPS: Partial<Record<Locale, [number, string][]>> = {
  zh: [[1e8, '亿'], [1e4, '万']],
  ja: [[1e8, '億'], [1e4, '万']],
  ko: [[1e8, '억'], [1e4, '만']],
};

const COMPACT: Partial<Record<Locale, [Intl.NumberFormat, Intl.NumberFormat] | null>> = {};

function compact(locale: Locale): [Intl.NumberFormat, Intl.NumberFormat] | null {
  if (COMPACT[locale] === undefined) {
    try {
      const make = (digits: number) =>
        new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: digits, roundingMode: 'trunc' } as Intl.NumberFormatOptions);
      const pair: [Intl.NumberFormat, Intl.NumberFormat] = [make(1), make(0)];
      // an engine that ignores `notation` prints the whole number: treat it as having none
      COMPACT[locale] = /[^\d\s.,]/.test(pair[0].format(12345e3)) ? pair : null;
    } catch {
      COMPACT[locale] = null;
    }
  }
  return COMPACT[locale] ?? null;
}

export function formatAmount(n: number, locale: Locale = current): string {
  const v = Math.floor(n);
  const f = v >= 1000 ? compact(locale) : null;
  if (f) {
    const integer = f[0].formatToParts(v).filter((p) => p.type === 'integer').map((p) => p.value).join('');
    return (integer.length >= 2 ? f[1] : f[0]).format(v);
  }
  const steps = STEPS[locale] ?? [[1e6, 'M'], [1e3, 'k']];
  for (const [size, suffix] of steps) {
    if (v >= size * 10) return `${Math.floor(v / size)}${suffix}`;
    if (v >= size) return `${Math.floor((v / size) * 10) / 10}${suffix}`;
  }
  return String(v);
}
