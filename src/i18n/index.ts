import { en, type Table } from './en';
import { MORE, MORE_NAMES } from './more';
import { zh } from './zh';

// English is the source: every other table is typed as Table, so a missing or extra key is a
// compile error. English and Chinese ship in the main bundle; the other languages are their own
// chunks (more.ts), fetched before the first screen when the player's language is one of them.

export type Locale = 'en' | 'zh' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'pl' | 'ru' | 'ja' | 'ko' | 'vi' | 'tr' | 'th' | 'id';
/** Every language, in the picker's order. */
export const LOCALES: readonly Locale[] = ['en', 'zh', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'ru', 'ja', 'ko', 'vi', 'tr', 'th', 'id'];

/** The tables in hand: en and zh always, the others once loadLocale fetched them. */
const TABLES: Partial<Record<Locale, Table>> = { en, zh };
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

/** The string for a dotted key, with {name} placeholders filled in. */
export function t(key: TextKey, params: Record<string, string | number> = {}): string {
  let v: unknown = table;
  for (const part of key.split('.')) v = (v as Record<string, unknown>)[part];
  return String(v).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
