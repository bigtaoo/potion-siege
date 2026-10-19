import { describe, expect, it } from 'vitest';
import { ASC_LOCALE, checkLang, readField, storeLangs } from '../../scripts/storeListing.mjs';
import { LOCALES, loadLocale, t, setLocale } from './index';

// The store listing (store/<lang>/) covers every game language, fits each field's limit, and uses
// the game's own words: the store name is the title, and the controls name the real buttons.
describe('store listing', () => {
  it('has a folder for every game language and no other', () => {
    expect(storeLangs()).toEqual([...LOCALES].sort());
    expect(Object.keys(ASC_LOCALE).sort()).toEqual([...LOCALES].sort());
  });

  it.each([...LOCALES])('%s is complete and within limits', (lang) => {
    expect(checkLang(lang)).toEqual([]);
  });

  it.each([...LOCALES])('%s uses the game\'s title and button names', async (lang) => {
    await loadLocale(lang);
    setLocale(lang);
    expect(readField(lang, 'name')).toBe(t('title'));
    const controls = readField(lang, 'controls')!;
    expect(controls).toContain(t('summon'));
    expect(controls).toContain(t('upgrade'));
    setLocale('en');
  });
});
