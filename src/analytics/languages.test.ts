import { describe, expect, it } from 'vitest';
import { languageProps } from './languages';

describe('languageProps', () => {
  it('lists the host and browser languages, at most four each and no repeats', () => {
    const host = { languages: () => ['en-US'] };
    expect(languageProps(host, ['vi-VN', 'vi', 'en-US', 'vi', 'en', 'fr'])).toEqual({ langs: 'en-US', navLangs: 'vi-VN,vi,en-US,en' });
  });

  it('leaves a list empty where there is none', () => {
    expect(languageProps({ languages: () => [] }, undefined)).toEqual({ langs: '', navLangs: '' });
    expect(languageProps({ languages: () => { throw new Error('no navigator'); } }, ['de'])).toEqual({ langs: '', navLangs: 'de' });
  });
});
