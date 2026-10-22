// One tab plays (tabLock.ts): a tab that hears a newer one goes stale and stops writing its save.
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { pageLink, TabLock, type TabLink } from './tabLock';
import { englishPage, world } from './testWorld';

beforeAll(englishPage);

/** Tabs of one origin: what one says, every other one hears. */
function hub() {
  const ears: { owner: number; listener: (id: string) => void }[] = [];
  let next = 0;
  return (): TabLink => {
    const owner = next++;
    return {
      say: (id) => ears.filter((e) => e.owner !== owner).forEach((e) => e.listener(id)),
      hear: (listener) => void ears.push({ owner, listener }),
    };
  };
}

describe('TabLock', () => {
  it('stops the older tab, once, and leaves the newest playing', () => {
    const link = hub();
    let staleCalls = 0;
    const first = new TabLock(link(), () => staleCalls++, 'a');
    const second = new TabLock(link(), () => undefined, 'b');
    expect([first.stale, second.stale, staleCalls]).toEqual([true, false, 1]);
    // a third tab: the second goes stale too, the first is not told again
    const third = new TabLock(link(), () => undefined, 'c');
    expect([second.stale, third.stale, staleCalls]).toEqual([true, false, 1]);
  });

  it('locks nothing without a link', () => {
    expect(new TabLock(null, () => undefined).stale).toBe(false);
  });
});

describe('pageLink', () => {
  it('uses a BroadcastChannel where there is one', () => {
    const channels: { name: string; posted: unknown[]; listeners: ((e: { data: unknown }) => void)[] }[] = [];
    class FakeChannel {
      readonly posted: unknown[] = [];
      readonly listeners: ((e: { data: unknown }) => void)[] = [];
      constructor(readonly name: string) {
        channels.push(this);
      }
      postMessage(m: unknown) {
        this.posted.push(m);
      }
      addEventListener(_type: string, l: (e: { data: unknown }) => void) {
        this.listeners.push(l);
      }
    }
    const link = pageLink({ BroadcastChannel: FakeChannel } as unknown as Window & typeof globalThis)!;
    const heard: string[] = [];
    link.hear((id) => heard.push(id));
    link.say('me');
    channels[0].listeners.forEach((l) => (l({ data: 'other' }), l({ data: 42 })));
    expect([channels[0].name, channels[0].posted, heard]).toEqual(['mb.tab', ['me'], ['other']]);
  });

  it('falls back to the storage event, and to no lock when storage is shut', () => {
    const items: Record<string, string> = {};
    let listener: ((e: { key: string | null; newValue: string | null }) => void) | undefined;
    const w = {
      localStorage: { setItem: (k: string, v: string) => (items[k] = v) },
      addEventListener: (_t: string, l: typeof listener) => (listener = l),
    } as unknown as Window & typeof globalThis;
    const link = pageLink(w)!;
    const heard: string[] = [];
    link.hear((id) => heard.push(id));
    link.say('me');
    listener?.({ key: 'mb.tab', newValue: 'other' });
    listener?.({ key: 'mb.save', newValue: '{}' });
    expect([items['mb.tab'], heard]).toEqual(['me', ['other']]);
    const shut = Object.defineProperty({}, 'localStorage', {
      get() {
        throw new Error('SecurityError');
      },
    }) as Window & typeof globalThis;
    expect(pageLink(shut)).toBeNull();
  });
});

describe('a stale tab', () => {
  it('no longer writes its save', () => {
    const w = world();
    const before = w.host.storage.getItem('mb.save');
    const link = hub();
    w.game.tabs = new TabLock(link(), () => undefined, 'old');
    new TabLock(link(), () => undefined, 'new');
    w.game.save.crystals += 1000;
    w.game.store();
    expect(w.host.storage.getItem('mb.save')).toBe(before);
  });
});
