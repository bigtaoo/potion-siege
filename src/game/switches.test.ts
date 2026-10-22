import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { urlSwitches } from './switches';
import { englishPage, playToEnd, veteran, world } from './testWorld';

describe('urlSwitches', () => {
  const search = '?autoplay&speed=50&ads=fake&track&quality=low&lang=de&native=1&src=cg';

  it('reads every switch in a dev build', () => {
    const p = urlSwitches(search, true);
    expect([p.has('autoplay'), p.get('speed'), p.get('ads'), p.has('track'), p.get('lang')]).toEqual([true, '50', 'fake', true, 'de']);
  });

  it('reads only the language in a release build', () => {
    expect([...urlSwitches(search, false).keys()]).toEqual(['lang']);
  });
});

describe('?autoplay', () => {
  beforeAll(englishPage);

  it('plays battles on the save in memory without ever writing it', () => {
    const w = world(veteran(), () => {}, 'autoplay&speed=200');
    const before = w.host.storage.getItem('mb.save');
    playToEnd(w);
    expect(w.game['save'].runs).toBe(veteran().runs + 1);
    expect(w.host.storage.getItem('mb.save')).toBe(before);
  });
});
