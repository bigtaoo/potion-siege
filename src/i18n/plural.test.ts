import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { en } from './en';
import { formatAmount, loadLocale, LOCALES, pluralCategory, setLocale, t, type TextKey } from './index';

/** Every dotted key of a table. */
function keys(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : keys(v as object, `${prefix}${k}.`)));
}

beforeAll(async () => {
  for (const l of LOCALES) await loadLocale(l);
});

afterEach(() => {
  setLocale('en');
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('plural category', () => {
  it('reads one and other in English', () => {
    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(0, 'en')).toBe('other');
    expect(pluralCategory(2, 'en')).toBe('other');
  });

  it('reads one, few, many and other in Russian', () => {
    expect([1, 21, 101].map((n) => pluralCategory(n, 'ru'))).toEqual(['one', 'one', 'one']);
    expect([2, 4, 22].map((n) => pluralCategory(n, 'ru'))).toEqual(['few', 'few', 'few']);
    expect([0, 5, 11, 12, 25].map((n) => pluralCategory(n, 'ru'))).toEqual(['many', 'many', 'many', 'many', 'many']);
    expect(pluralCategory(1.5, 'ru')).toBe('other');
  });

  it('reads one, few, many and other in Polish', () => {
    expect(pluralCategory(1, 'pl')).toBe('one');
    expect([2, 3, 22].map((n) => pluralCategory(n, 'pl'))).toEqual(['few', 'few', 'few']);
    // unlike Russian, 21 is many in Polish
    expect([0, 5, 12, 21].map((n) => pluralCategory(n, 'pl'))).toEqual(['many', 'many', 'many', 'many']);
    expect(pluralCategory(2.5, 'pl')).toBe('other');
  });

  it('counts 0 as one in French and has no plural in Chinese', () => {
    expect(pluralCategory(0, 'fr')).toBe('one');
    expect(pluralCategory(2, 'fr')).toBe('other');
    expect(pluralCategory(1, 'zh')).toBe('other');
  });

  it("falls back on English's rule without Intl.PluralRules", async () => {
    vi.stubGlobal('Intl', { ...Intl, PluralRules: undefined });
    vi.resetModules();
    const fresh = await import('./index');
    expect(fresh.pluralCategory(1, 'ru')).toBe('one');
    expect(fresh.pluralCategory(5, 'ru')).toBe('other');
  });
});

describe('t with plurals', () => {
  it('says 1 battle and 2 battles in English', () => {
    expect(t('task.win', { n: 1 })).toBe('Win 1 battle');
    expect(t('task.win', { n: 3 })).toBe('Win 3 battles');
    expect(t('task.ultimate', { n: 1 })).toBe('Brew 1 ultimate potion');
    expect(t('task.ultimate', { n: 2 })).toBe('Brew 2 ultimate potions');
    expect(t('side.bossIn', { n: 2 })).toBe('Boss in 2 waves');
  });

  it('picks each Russian form', () => {
    setLocale('ru');
    expect(t('challenge.streak', { n: 1 })).toBe('1 день подряд');
    expect(t('challenge.streak', { n: 21 })).toBe('21 день подряд');
    expect(t('challenge.streak', { n: 3 })).toBe('3 дня подряд');
    expect(t('challenge.streak', { n: 5 })).toBe('5 дней подряд');
    expect(t('challenge.streak', { n: 1.5 })).toBe('1.5 дня подряд');
  });

  it('picks each Polish form', () => {
    setLocale('pl');
    expect(t('task.play', { n: 1 })).toBe('Ukończ 1 walkę');
    expect(t('task.play', { n: 3 })).toBe('Ukończ 3 walki');
    expect(t('task.play', { n: 5 })).toBe('Ukończ 5 walk');
    expect(t('task.play', { n: 22 })).toBe('Ukończ 22 walki');
    expect(t('task.play', { n: 0.5 })).toBe('Ukończ 0.5 walki');
  });

  it('picks one for 0 and 1 in French, other above', () => {
    setLocale('fr');
    expect(t('task.win', { n: 1 })).toBe('Gagne 1 combat');
    expect(t('task.win', { n: 0 })).toBe('Gagne 0 combat');
    expect(t('task.win', { n: 2 })).toBe('Gagne 2 combats');
  });

  it('reads other for a form a string leaves out, or a count that is not a number', () => {
    setLocale('ru');
    expect(t('task.play', { n: '1,2K' })).toBe('Заверши 1,2K боя');
  });

  it('leaves a plural pick whose count is missing as it is, like a plain placeholder', () => {
    expect(t('task.win')).toBe('Win {n} {n|one:battle|other:battles}');
    expect(t('stats', { wave: 3 })).toBe('Wave 3   Kills {kills}   Time {time}');
  });

  it('writes every plural form a language needs', () => {
    for (const l of LOCALES) {
      setLocale(l);
      // fr/es/it/pt's `many` is for millions only; their `other` serves
      const needs = new Intl.PluralRules(l).resolvedOptions().pluralCategories.filter((c) => c !== 'other' && (c !== 'many' || l === 'pl' || l === 'ru'));
      for (const key of keys(en)) {
        for (const m of t(key as TextKey).matchAll(/\{\w+\|([^{}]+)\}/g)) {
          const forms = m[1]!.split('|').map((f) => f.split(':')[0]);
          expect(forms, `${l} ${key}`).toContain('other');
          for (const c of needs) expect(forms, `${l} ${key} ${c}`).toContain(c);
        }
      }
    }
  });
});

describe('formatAmount', () => {
  it('is exact below a thousand', () => {
    expect(formatAmount(950, 'en')).toBe('950');
    expect(formatAmount(999.9, 'de')).toBe('999');
  });

  it('shortens in each language its own way', () => {
    expect(formatAmount(1234, 'en')).toBe('1.2K');
    expect(formatAmount(12345, 'en')).toBe('12K');
    expect(formatAmount(4_560_000, 'en')).toBe('4.5M');
    expect(formatAmount(12345, 'zh')).toBe('1.2万');
    expect(formatAmount(340_000_000, 'zh')).toBe('3.4亿');
    expect(formatAmount(12345, 'ja')).toBe('1.2万');
    expect(formatAmount(12345, 'ko')).toBe('1.2만');
    expect(formatAmount(4_560_000, 'de').replace(/\s/g, ' ')).toBe('4,5 Mio.');
    expect(formatAmount(1234, 'fr').replace(/\s/g, ' ')).toBe('1,2 k');
  });

  it('falls back on k and M, and 万/亿, without compact notation', async () => {
    // an engine that ignores `notation` prints the whole number
    const Real = Intl.NumberFormat;
    const Plain = function (locale?: string) {
      return new Real(locale);
    } as unknown as typeof Intl.NumberFormat;
    vi.stubGlobal('Intl', { ...Intl, NumberFormat: Plain });
    vi.resetModules();
    const fresh = await import('./index');
    expect(fresh.formatAmount(1234, 'en')).toBe('1.2k');
    expect(fresh.formatAmount(12345, 'en')).toBe('12k');
    expect(fresh.formatAmount(4_560_000, 'de')).toBe('4.5M');
    expect(fresh.formatAmount(9999, 'zh')).toBe('9999');
    expect(fresh.formatAmount(12345, 'zh')).toBe('1.2万');
    expect(fresh.formatAmount(340_000_000, 'ja')).toBe('3.4億');
  });
});
