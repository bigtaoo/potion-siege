// The settings panel as the player meets it on the home screen (settingsPanel.ts, the actions in
// game/homeScreen.ts): the real game over a stand-in host, each switch and button tapped by its
// English caption, and the save, the host and the redrawn panel read back.
import '../layout/measure';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Container } from 'pixi.js';
import { localeName, setLocale, t } from '../../i18n';
import { LANG_KEY, REMINDERS_KEY } from '../../game/keys';
import { home } from '../../game/homeScreen';
import { buttons, englishPage, flush, tap, texts, veteran, world, type Host, type World } from '../../game/testWorld';
import type { Notifier } from '../../platform/types';
import { switchOn, type SoundSwitch } from '../soundSwitches';

beforeAll(englishPage);
afterEach(() => void setLocale('en'));

/** A host with what `extra` adds (vibration, links, a clipboard, notifications). */
function settings(extra: Partial<Record<'vibrate' | 'openUrl' | 'adPrivacy' | 'copyText' | 'notify', unknown>> = {}): World {
  const w = world(veteran(), (h: Host) => Object.assign(h, extra));
  w.game['tab'] = 'battle';
  home(w.game);
  tap(w.stage, t('sound.settings'));
  expect(w.game['panel']).toBe('settings');
  return w;
}

/** The one tappable row reading `caption`. */
function row(w: World, caption: string): Container {
  const found = buttons(w.stage, caption);
  expect(found).toHaveLength(1);
  return found[0];
}

/** The texts on screen, wrapped lines joined again. */
const words = (w: World) => texts(w.stage).map((s) => s.replace(/\n/g, ' '));

/** What the row's switch reads: ON or OFF. */
const reads = (w: World, caption: string) => texts(row(w, caption)).find((s) => s === t('sound.on') || s === t('sound.off'));

/** A notifier whose permission is `status` and whose sheet answers `answer`. */
function notifier(status: ReturnType<Notifier['status']>, answer: 'on' | 'off' = 'on') {
  return {
    current: status,
    asked: 0,
    status() {
      return this.current;
    },
    async ask() {
      this.asked++;
      this.current = answer;
      return answer;
    },
    schedule: vi.fn(),
    cancel: vi.fn(),
  };
}

describe('the settings panel', () => {
  it('opens from the gear with the three switches, the language and the play statistics', () => {
    const w = settings();
    const shown = texts(w.stage);
    for (const s of ['music', 'sfx', 'shake', 'language'] as const) expect(shown).toContain(t(`sound.${s}`));
    expect(shown).toContain(t('privacy.setting'));
    expect(shown).toContain(localeName('en'));
  });

  it.each(['music', 'sfx', 'shake'] as const)('flips %s in the save, keeps the panel open and redraws the switch', (which: SoundSwitch) => {
    const w = settings();
    const was = switchOn(w.game.save, which);
    const caption = t(`sound.${which}`);
    expect(reads(w, caption)).toBe(t(was ? 'sound.on' : 'sound.off'));
    tap(w.stage, caption);
    expect(switchOn(w.save(), which)).toBe(!was);
    expect(w.game['panel']).toBe('settings');
    expect(reads(w, caption)).toBe(t(was ? 'sound.off' : 'sound.on'));
    tap(w.stage, caption);
    expect(switchOn(w.save(), which)).toBe(was);
  });

  it('shows the vibration switch only where the device can vibrate', () => {
    expect(texts(settings().stage)).not.toContain(t('sound.haptics'));
    const w = settings({ vibrate: () => {} });
    const was = w.game.save.sound.haptics;
    tap(w.stage, t('sound.haptics'));
    expect(w.save().sound.haptics).toBe(!was);
    expect(reads(w, t('sound.haptics'))).toBe(t(was ? 'sound.off' : 'sound.on'));
  });

  it('opens the language picker, and a pick switches the game and comes back to the settings', async () => {
    // what showLocale sets on the page
    Object.assign(document, { documentElement: {}, title: '' });
    const w = settings();
    tap(w.stage, t('sound.language'));
    expect(w.game['panel']).toBe('language');
    tap(w.stage, localeName('de'));
    await vi.waitFor(() => expect(w.host.storage.getItem(LANG_KEY)).toBe('de'));
    expect(w.game['panel']).toBe('settings');
    expect(texts(w.stage)).toContain(t('sound.settings'));
    expect(t('sound.settings')).not.toBe('Settings');
    expect(w.events('language')).toEqual([{ lang: 'de', from: 'en' }]);
  });

  it('keeps the language when the one in use is picked', async () => {
    const w = settings();
    tap(w.stage, t('sound.language'));
    tap(w.stage, localeName('en'));
    await flush();
    expect(w.game['panel']).toBe('settings');
    expect(w.host.storage.getItem(LANG_KEY)).toBeNull();
    expect(w.events('language')).toEqual([]);
  });

  it('offers the ad privacy form and the policy only where the host has them', () => {
    const plain = texts(settings().stage);
    expect(plain).not.toContain(t('sound.privacy'));
    expect(plain).not.toContain(t('sound.policy'));
    const open = vi.fn();
    const openUrl = vi.fn();
    const w = settings({ adPrivacy: { offered: () => true, open }, openUrl });
    tap(w.stage, t('sound.privacy'));
    expect(open).toHaveBeenCalledOnce();
    tap(w.stage, t('sound.policy'));
    expect(openUrl).toHaveBeenCalledWith(t('sound.policyPage'));
  });

  it('leaves the ad privacy form out where the host says it does not apply', () => {
    const w = settings({ adPrivacy: { offered: () => false, open: vi.fn() } });
    expect(texts(w.stage)).not.toContain(t('sound.privacy'));
  });

  it('turns the play statistics off and on, and says so where they go', () => {
    const w = settings();
    expect(w.analytics.sending).toBe(true);
    tap(w.stage, t('privacy.setting'));
    expect(w.analytics.sending).toBe(false);
    expect(w.game['privacy'].choice()).toBe('no');
    expect(w.game['panel']).toBe('settings');
    expect(reads(w, t('privacy.setting'))).toBe(t('sound.off'));
    tap(w.stage, t('privacy.setting'));
    expect(w.analytics.sending).toBe(true);
    expect(reads(w, t('privacy.setting'))).toBe(t('sound.on'));
    expect(w.events('privacy')).toEqual([{ on: true, from: 'settings', run: 8 }]);
  });

  it('shows the player ID, and copies it where the host has a clipboard', async () => {
    const copied: string[] = [];
    const w = settings({ copyText: async (s: string) => (copied.push(s), true) });
    const id = w.analytics.playerId!;
    expect(id).toBeTruthy();
    expect(texts(w.stage)).toContain(t('privacy.id', { id }));
    tap(w.stage, t('privacy.copy'));
    await flush();
    expect(copied).toEqual([id]);
    expect(texts(w.stage)).toContain(t('privacy.copied'));
    // the note goes with the panel
    tap(w.stage, '✕');
    tap(w.stage, t('sound.settings'));
    expect(texts(w.stage)).toContain(t('privacy.copy'));
  });

  it('says when the copy failed', async () => {
    const w = settings({ copyText: async () => false });
    tap(w.stage, t('privacy.copy'));
    await flush();
    expect(texts(w.stage)).toContain(t('privacy.copyFailed'));
  });

  it('has no copy button without a clipboard, and says when no ID was stored', () => {
    expect(buttons(settings().stage, t('privacy.copy'))).toHaveLength(0);
    const w = world(veteran(), (h) => Object.assign(h, { copyText: async () => true }));
    w.game['analytics']['player'].id = '';
    home(w.game, 'settings');
    expect(words(w)).toContain(t('privacy.noId'));
    expect(buttons(w.stage, t('privacy.copy'))).toHaveLength(0);
  });

  it('has a reminders switch only where the host has notifications', async () => {
    expect(texts(settings().stage)).not.toContain(t('remind.setting'));
    const notify = notifier('on');
    const w = settings({ notify });
    expect(reads(w, t('remind.setting'))).toBe(t('sound.on'));
    tap(w.stage, t('remind.setting'));
    await flush();
    expect(JSON.parse(w.host.storage.getItem(REMINDERS_KEY)!)).toEqual({ on: false, asked: true });
    expect(w.game['panel']).toBe('settings');
    expect(reads(w, t('remind.setting'))).toBe(t('sound.off'));
    expect(w.events('dialog')).toContainEqual({ id: 'remind', action: 'no', from: 'settings', run: 8 });
  });

  it('asks the system before turning reminders on the first time', async () => {
    const notify = notifier('unknown');
    const w = settings({ notify });
    expect(reads(w, t('remind.setting'))).toBe(t('sound.off'));
    tap(w.stage, t('remind.setting'));
    await flush();
    expect(notify.asked).toBe(1);
    expect(reads(w, t('remind.setting'))).toBe(t('sound.on'));
  });

  it('only says where to turn reminders back on once the phone refused them', () => {
    const w = settings({ notify: notifier('off') });
    expect(words(w)).toContain(t('remind.blocked'));
    expect(buttons(w.stage, t('remind.setting'))).toHaveLength(0);
  });

  it('closes with the cross, the switches kept', () => {
    const w = settings();
    tap(w.stage, t('sound.music'));
    tap(w.stage, '✕');
    expect(w.game['panel']).toBeNull();
    expect(texts(w.stage)).not.toContain(t('sound.music'));
    expect(w.save().sound.music).toBe(false);
  });
});
