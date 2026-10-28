import { describe, expect, it, vi } from 'vitest';

// A stand-in German table whose one string has a broken plural spec: a form with no category
// and a list without `other`.
vi.mock('./more', () => ({
  MORE: { de: async () => ({ lang: { name: 'Deutsch' }, hud: { wave: '{n|tag|one:ein Tag}' } }) },
  MORE_NAMES: {},
}));

const { loadLocale, localeName, setLocale, t } = await import('./index');

describe('i18n edges', () => {
  it('names a language it knows nothing about by its code', () => {
    expect(localeName('xx' as never)).toBe('xx');
  });

  it('skips a form with no category, and reads nothing when other is missing too', async () => {
    expect(await loadLocale('de')).toBe(true);
    setLocale('de');
    expect(t('hud.wave' as never, { n: 1 })).toBe('ein Tag');
    expect(t('hud.wave' as never, { n: 5 })).toBe('');
    setLocale('en');
  });
});
