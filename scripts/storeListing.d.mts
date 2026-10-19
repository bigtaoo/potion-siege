// Types for storeListing.mjs, for the tests.

export type Field = 'name' | 'subtitle' | 'promotional_text' | 'description' | 'keywords' | 'short_description' | 'controls';
export const ROOT: string;
export const FIELDS: Record<Field, { dir: 'app-store' | 'crazygames'; max: number; oneLine: boolean }>;
export const ASC_LOCALE: Record<string, string>;
export function length(s: string): number;
export function readField(lang: string, field: Field, root?: string): string | null;
export function checkLang(lang: string, root?: string): string[];
export function storeLangs(root?: string): string[];
