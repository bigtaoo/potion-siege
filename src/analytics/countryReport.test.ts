import { describe, expect, it } from 'vitest';
import { countryRows, printCountries } from '../../scripts/countryReport.mjs';

const ev = (name: string, uid: string | undefined, ts: number, extra: Record<string, unknown> = {}) => ({ name, uid, sid: uid && `${uid}-s`, ts, ...extra });

describe('countryRows', () => {
  const events = [
    ev('beacon', undefined, 1, { step: 'loaded_desktop', country: 'US' }),
    ev('beacon', undefined, 2, { step: 'open_desktop', country: 'US' }),
    ev('beacon', undefined, 3, { step: 'loaded_touch', country: 'DE' }),
    // a: US, a new player past a minute who wins; later seen from DE but stays US
    ev('session_start', 'a', 10, { day: 0, country: 'US' }),
    ev('alive', 'a', 70, { props: { vis: 60 }, country: 'US' }),
    ev('first_win', 'a', 200, { country: 'DE' }),
    // b: US, back on a later day, left before a minute on screen though open longer
    ev('session_start', 'b', 20, { day: 3, country: 'US' }),
    ev('session_end', 'b', 400, { props: { secs: 380, vis: 40 }, country: 'US' }),
    // c: from before the collector stamped countries
    ev('session_start', 'c', 30, { day: 0 }),
  ];

  it('counts loads, players, new players, sessions, minute sessions and first wins by first country', () => {
    expect(countryRows(events)).toEqual([
      { country: 'US', loads: 1, players: 2, fresh: 1, sessions: 2, minute: 1, wins: 1 },
      { country: '?', loads: 0, players: 1, fresh: 1, sessions: 1, minute: 0, wins: 0 },
      { country: 'DE', loads: 1, players: 0, fresh: 0, sessions: 0, minute: 0, wins: 0 },
    ]);
  });

  it('prints a table, and nothing while no line has a country', () => {
    const out: string[] = [];
    printCountries(countryRows(events), (s: string) => out.push(s));
    expect(out[0]).toContain('Countries');
    expect(out.find((l) => l.startsWith('US'))).toMatch(/^US\s+1\s+2\s+1\s+2\s+50%\s+50%$/);
    expect(out.find((l) => l.startsWith('DE'))).toMatch(/\s-\s+-$/);

    const none: string[] = [];
    printCountries(countryRows([events[8]]), (s: string) => none.push(s));
    expect(none).toEqual([]);
  });
});
