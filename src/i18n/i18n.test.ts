import { beforeAll, describe, expect, it } from 'vitest';
import { en } from './en';
import { detectLocale, getLocale, loadLocale, LOCALES, localeName, setLocale, t, type Locale } from './index';
import { MORE, MORE_NAMES } from './more';

/** Every string in a table by its dotted key. */
function flatten(o: object, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(o)) {
    const key = prefix + k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [kk, vv] of flatten(v as object, key + '.')) out.set(kk, vv);
  }
  return out;
}

/** The names a string fills, plural picks ({n|one:…|other:…}) included, each once. */
const placeholders = (s: string) => [...new Set([...s.matchAll(/\{(\w+)(?=[}|])/g)].map((m) => m[1]))].sort();

/** A string with its placeholders and plural picks taken out. */
const bare = (s: string) => s.replace(/\{\w+\|[^{}]+\}/g, '').replace(/\{\w+\}/g, '');

/** Strings any language may leave as in English: names, links and game words everyone uses. */
const SAME = new Set(['title', 'mvp', 'sound.policyPage', 'codex.hp', 'maxed', 'side.fresh', 'level', 'levelOf', 'bossTag']);

/** The languages not written in Latin letters. */
const OWN_SCRIPT = new Set<Locale>(['zh', 'ru', 'ja', 'ko', 'th']);

const E = flatten(en);
const OTHERS = LOCALES.filter((l) => l !== 'en');
const tables = new Map<Locale, Map<string, string>>();

beforeAll(async () => {
  for (const l of OTHERS) tables.set(l, flatten(await MORE[l]!()));
});

describe.each(OTHERS)('%s', (l) => {
  const T = () => tables.get(l)!;

  it('has the same keys as English', () => {
    expect([...T().keys()].sort()).toEqual([...E.keys()].sort());
  });

  it('fills the same placeholders', () => {
    const bad = [...E].filter(([k, v]) => placeholders(v).join() !== placeholders(T().get(k) ?? '').join());
    expect(bad.map(([k, v]) => `${k}: ${v} | ${T().get(k)}`)).toEqual([]);
  });

  it('keeps the hard line breaks of fixed-layout labels', () => {
    // a translation may break wrapped text where it reads best (full.hint), but a label that
    // English splits on purpose (a button's two lines) needs the same lines
    const lines = (s: string) => s.split('\n').length;
    const bad = [...E].filter(([k, v]) => lines(v) > 1 && lines(v) !== lines(T().get(k) ?? ''));
    expect(bad.map(([k, v]) => `${k}: ${JSON.stringify(v)} | ${JSON.stringify(T().get(k))}`)).toEqual([]);
  });

  it('has no empty or untranslated strings', () => {
    // a string that is only placeholders, numbers and symbols needs no translation; in another
    // script any English left is a miss, in a Latin one a few words are the same (Plasma, Finale)
    const words = /[A-Za-z]{2,}/;
    const same = [...T()].filter(([k, v]) => !SAME.has(k) && words.test(bare(v)) && v === E.get(k));
    expect([...T()].filter(([, v]) => !v.trim())).toEqual([]);
    if (OWN_SCRIPT.has(l)) expect(same.map(([k, v]) => `${k}: ${v}`)).toEqual([]);
    else expect(same.length).toBeLessThan(15);
  });

  it('names itself as the picker does', () => {
    expect(T().get('lang.name')).toBe(MORE_NAMES[l]);
  });

  it('leaves no stray braces', () => {
    const stray = (s: string) => /[{}]/.test(bare(s));
    const bad = [...T()].filter(([, v]) => stray(v));
    expect(bad.map(([k, v]) => `${k}: ${v}`)).toEqual([]);
  });
});

describe.each(['zh', 'ja'] as const)('%s punctuation', (l) => {
  it('is full-width next to Chinese characters and kana', () => {
    const cjk = '\\u3040-\\u30ff\\u4e00-\\u9fff';
    const half = new RegExp(`[${cjk}][!:;?,()]|[!:;?,()][${cjk}]`);
    const bad = [...tables.get(l)!].filter(([, v]) => half.test(v));
    expect(bad.map(([k, v]) => `${k}: ${v}`)).toEqual([]);
  });
});

describe('locale', () => {
  it('reads the base subtag of the first language it has', () => {
    expect(detectLocale(['xx', 'pt-BR', 'en'])).toBe('pt');
    expect(detectLocale(['zh_CN'])).toBe('zh');
    expect(detectLocale(['in-ID'])).toBe('id');
    expect(detectLocale([null, undefined, 'tlh'])).toBe('en');
  });

  it('stays in English until a table is fetched, then switches', async () => {
    expect(setLocale('de')).toBe('en');
    expect(await loadLocale('de')).toBe(true);
    expect(setLocale('de')).toBe('de');
    expect(getLocale()).toBe('de');
    expect(t('lang.name')).toBe('Deutsch');
    setLocale('en');
  });

  it('names every language in the picker by its own name', () => {
    for (const l of LOCALES) expect(localeName(l)).not.toBe(l);
  });

  it('leaves no stray braces in English', () => {
    const bad = [...E].filter(([, v]) => /[{}]/.test(bare(v)));
    expect(bad).toEqual([]);
  });
});
