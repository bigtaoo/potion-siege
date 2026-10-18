import { describe, expect, it } from 'vitest';
import { openBeacon } from '../../scripts/openBeacon.mjs';
import { SafeStore } from '../platform/types';
import { Analytics } from './analytics';
import { MemorySink } from './sinks';
import { cleanSource, sourceOf } from './source';

const OWN = 'p.gamestao.com';

/** [search, referrer, build default, expected] */
const CASES: [string, string, string, string][] = [
  ['?src=reddit', 'https://www.reddit.com/r/WebGames/comments/x', '', 'reddit'],
  ['?src=QQ%20Group!', '', '', 'qqgroup'],
  ['?utm_source=Discord&utm_medium=x', '', '', 'discord'],
  ['?src=itch', '', 'newgrounds', 'itch'],
  ['', 'https://html-classic.itch.zone/html/123/index.html', 'itch', 'itch'],
  ['', 'https://www.reddit.com/r/WebGames/comments/abc?utm=1', '', 'reddit.com'],
  ['', 'https://p.gamestao.com/?src=x', '', 'direct'],
  ['', '', '', 'direct'],
  ['', 'not a url', '', 'direct'],
  ['?src=', '', '', 'direct'],
  ['?src=' + 'a'.repeat(60), '', '', 'a'.repeat(40)],
];

describe('sourceOf', () => {
  it.each(CASES)('%s from %s (default %s) is %s', (search, referrer, fallback, expected) => {
    expect(sourceOf(search, referrer, OWN, fallback)).toBe(expected);
  });

  it('keeps nothing of the referrer but its host', () => {
    expect(sourceOf('', 'https://user:pw@forum.example.org/thread/42?email=a@b.c', OWN)).toBe('forum.example.org');
    expect(cleanSource('a b/c?d=e')).toBe('abcde');
  });
});

/** Runs the inline open beacon in a pretend page and returns the URL it fetched, or null. */
function runBeacon(script: string, page: { search: string; referrer: string; host?: string; protocol?: string; player?: string | null; coarse?: boolean }): string | null {
  const body = script.replace(/^<script>/, '').replace(/<\/script>$/, '');
  let fetched: string | null = null;
  const env = {
    location: { hostname: page.host ?? OWN, protocol: page.protocol ?? 'https:', search: page.search },
    document: { referrer: page.referrer },
    localStorage: { getItem: (k: string) => (k === 'mb.player' ? (page.player ?? null) : null) },
    matchMedia: () => ({ matches: !!page.coarse }),
    fetch: (url: string) => {
      fetched = url;
      return Promise.resolve();
    },
  };
  new Function(...Object.keys(env), body)(...Object.values(env));
  return fetched;
}

describe('the inline open beacon', () => {
  it('tags a new launch with the same source as the game', () => {
    for (const [search, referrer, fallback, expected] of CASES) {
      const url = runBeacon(openBeacon('https://c.example', '0.0.1+abc', 'web', fallback), { search, referrer });
      const q = new URL(url!).searchParams;
      expect(q.get('r'), `${search} ${referrer}`).toBe(expected);
      expect(q.get('n')).toBe('1');
      expect(q.get('h')).toBe('web');
      expect(q.get('s')).toBe('open_desktop');
    }
  });

  it('gives a returning player the source in the record, unknown for an old one', () => {
    const script = openBeacon('https://c.example', 'b', 'web');
    const back = runBeacon(script, { search: '?src=other', referrer: '', coarse: true, player: JSON.stringify({ id: 'x', firstDay: 1, src: 'reddit' }) });
    expect(Object.fromEntries(new URL(back!).searchParams)).toMatchObject({ n: '0', r: 'reddit', s: 'open_touch' });
    const old = runBeacon(script, { search: '?src=other', referrer: '', player: JSON.stringify({ id: 'x', firstDay: 1 }) });
    expect(new URL(old!).searchParams.get('r')).toBe('unknown');
  });

  it('counts nothing on a local preview', () => {
    expect(runBeacon(openBeacon('https://c.example', 'b'), { search: '', referrer: '', host: 'localhost' })).toBeNull();
    expect(runBeacon(openBeacon('https://c.example', 'b'), { search: '', referrer: '', host: '127.0.0.1' })).toBeNull();
    // the iOS app's page is capacitor://localhost, and counts
    expect(new URL(runBeacon(openBeacon('https://c.example', 'b', 'ios'), { search: '', referrer: '', host: 'localhost', protocol: 'capacitor:' })!).searchParams.get('h')).toBe('ios');
  });
});

describe('the player record', () => {
  it('keeps the first visit source and reads an old record as unknown', () => {
    const store = new SafeStore(null);
    const sink = new MemorySink();
    new Analytics(store, [sink], '1', 'web', undefined, () => 'reddit').track('session_start');
    new Analytics(store, [sink], '1', 'web', undefined, () => 'other').track('session_start');
    expect(sink.events.map((e) => e.src)).toEqual(['reddit', 'reddit']);

    const old = new SafeStore(null);
    old.setItem('mb.player', JSON.stringify({ id: 'abc', firstDay: 1, sessions: 3, firsts: [] }));
    const a = new Analytics(old, [sink], '1', 'web', undefined, () => 'reddit');
    expect(a.source).toBe('unknown');
    expect(JSON.parse(old.getItem('mb.player')!).src).toBe('unknown');
  });
});
