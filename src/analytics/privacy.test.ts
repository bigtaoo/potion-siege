import { describe, expect, it } from 'vitest';
import { SafeStore } from '../platform/types';
import { Analytics } from './analytics';
import { PRIVACY_KEY, PrivacyChoice, privacyRegion, sharingOf } from './privacy';
import { MemorySink } from './sinks';

describe('privacyRegion', () => {
  it('goes by the host country when there is one', () => {
    expect(privacyRegion('DE', 'America/New_York')).toBe('consent');
    expect(privacyRegion('gb', null)).toBe('consent');
    expect(privacyRegion('CH', null)).toBe('consent');
    expect(privacyRegion('US', 'Europe/Berlin')).toBe('notice');
  });

  it('else by the time zone, and asks when it knows neither', () => {
    expect(privacyRegion(null, 'Europe/Paris')).toBe('consent');
    expect(privacyRegion(null, 'Atlantic/Canary')).toBe('consent');
    expect(privacyRegion(null, 'Asia/Shanghai')).toBe('notice');
    expect(privacyRegion(null, 'America/Sao_Paulo')).toBe('notice');
    expect(privacyRegion(null, null)).toBe('consent');
  });
});

describe('PrivacyChoice', () => {
  it('holds in the consent region until the player answers, sends elsewhere', () => {
    expect(sharingOf('consent', 'ask')).toBe('hold');
    expect(sharingOf('notice', 'ask')).toBe('send');
    expect(sharingOf('notice', 'no')).toBe('off');
    expect(sharingOf('consent', 'yes')).toBe('send');
  });

  it('keeps the answer beside the save', () => {
    const store = new SafeStore(null);
    const asked = new PrivacyChoice(store, 'consent');
    expect(asked.asking()).toBe(true);
    asked.set(false);
    expect(store.getItem(PRIVACY_KEY)).toBe('no');
    const again = new PrivacyChoice(store, 'consent');
    expect(again.asking()).toBe(false);
    expect(again.sharing()).toBe('off');
    expect(new PrivacyChoice(new SafeStore(null), 'notice').asking()).toBe(false);
  });
});

describe('Analytics consent gate', () => {
  it('sends nothing and stores no id while it holds, then sends what waited with the new id', () => {
    const store = new SafeStore(null);
    const sink = new MemorySink();
    const a = new Analytics(store, [sink], '1', 'web', undefined, undefined, 'hold');
    a.track('session_start');
    a.track('run_start');
    expect(sink.events).toHaveLength(0);
    expect(a.playerId).toBeNull();
    expect(a.sending).toBe(false);
    expect(JSON.parse(store.getItem('mb.player')!).id).toBe('');

    a.setSharing('send');
    expect(a.playerId).toMatch(/\S/);
    expect(sink.events.map((e) => e.name)).toEqual(['session_start', 'run_start']);
    expect(sink.events.every((e) => e.uid === a.playerId)).toBe(true);
    expect(JSON.parse(store.getItem('mb.player')!).id).toBe(a.playerId);
    // the next session sends straight away with the same id
    const next = new Analytics(store, [sink], '1', 'web', undefined, undefined, 'send');
    next.track('session_start');
    expect(sink.events[2].uid).toBe(a.playerId);
  });

  it('drops what waited on a no, and keeps an id already stored for a deletion request', () => {
    const sink = new MemorySink();
    const held = new Analytics(new SafeStore(null), [sink], '1', 'web', undefined, undefined, 'hold');
    held.track('session_start');
    held.setSharing('off');
    held.setSharing('send');
    expect(sink.events).toHaveLength(0);

    const store = new SafeStore(null);
    const sent = new Analytics(store, [sink], '1', 'web');
    const id = sent.playerId;
    sent.setSharing('off');
    sent.track('x');
    expect(sink.events).toHaveLength(0);
    expect(new Analytics(store, [sink], '1', 'web', undefined, undefined, 'off').playerId).toBe(id);
  });
});
