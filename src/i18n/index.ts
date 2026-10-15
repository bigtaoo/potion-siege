import { en, type Table } from './en';
import { zh } from './zh';

const TABLES: Record<string, Table> = { en, zh };
let table: Table = en;

/** Picks the first supported language from the candidates (e.g. 'zh-CN'), else English. */
export function setLocale(candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    const base = c?.toLowerCase().split(/[-_]/)[0];
    if (base && TABLES[base]) {
      table = TABLES[base];
      return base;
    }
  }
  table = en;
  return 'en';
}

type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
export type TextKey = Paths<Table>;

/** The string for a dotted key, with {name} placeholders filled in. */
export function t(key: TextKey, params: Record<string, string | number> = {}): string {
  let v: unknown = table;
  for (const part of key.split('.')) v = (v as Record<string, unknown>)[part];
  return String(v).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
