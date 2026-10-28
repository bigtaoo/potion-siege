import { beforeAll, describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../../game/keys';
import { PlaygamaBridge } from './bridge';
import { KEYS, PlaygamaPlatform } from './PlaygamaPlatform';
import { fakeBridge, type FakeBridge } from './testBridge';

beforeAll(() => {
  (globalThis as { location?: unknown }).location ??= { search: '' };
});

/** Stand-ins for the page's document and window that keep their listeners. */
function page() {
  const on = new Map<string, () => void>();
  const doc = { visibilityState: 'visible', addEventListener: (e: string, fn: () => void) => void on.set(`doc:${e}`, fn) };
  const win = { addEventListener: (e: string, fn: () => void) => void on.set(`win:${e}`, fn) };
  return { doc, win, fire: (e: string) => on.get(e)?.() };
}

async function platform(f: FakeBridge | null, p = page()) {
  const bridge = new PlaygamaBridge(f?.global ?? {}, () => new Promise<void>(() => {}));
  return PlaygamaPlatform.create(bridge, p.doc as unknown as Document, p.win as unknown as Window);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('PlaygamaPlatform', () => {
  it('counts only the portal as Playgama: a preview and the QA tool stay web', async () => {
    expect((await platform(fakeBridge())).name).toBe('playgama');
    for (const id of ['mock', 'qa_tool']) {
      const p = await platform(fakeBridge({ id }));
      expect([p.name, p.hostSink]).toEqual(['web', undefined]);
    }
    expect((await platform(null)).name).toBe('web');
  });

  it('keeps our collector out of the sandbox only', async () => {
    expect((await platform(fakeBridge({ id: 'playgama_sandbox' }))).collectorBlocked).toBe(true);
    expect((await platform(fakeBridge())).collectorBlocked).toBe(false);
  });

  it('reads every kept key through Bridge at boot and saves back through it', async () => {
    const f = fakeBridge({ stored: { [SAVE_KEY]: '{"v":1}' } });
    const p = await platform(f);
    expect(p.storage.getItem(SAVE_KEY)).toBe('{"v":1}');
    p.storage.setItem(SAVE_KEY, '{"v":2}');
    await tick();
    expect(f.saved).toEqual([[[SAVE_KEY], ['{"v":2}']]]);
    expect(KEYS).toContain(SAVE_KEY);
  });

  it('sends a waiting save when the page hides or the platform pauses', async () => {
    const f = fakeBridge();
    const pg = page();
    const p = await platform(f, pg);
    p.storage.setItem('a', '1');
    pg.fire('win:pagehide');
    p.storage.setItem('b', '2');
    f.emit('pause_state_changed', true);
    expect(f.saved.map(([k]) => k)).toEqual([['a'], ['b']]);
  });

  it('sends game_ready once, and no gameplay_started before it', async () => {
    const f = fakeBridge();
    const p = await platform(f);
    p.gameplayStart();
    expect(f.messages).toEqual([]);
    p.loaded();
    p.loaded();
    p.gameplayStart();
    p.gameplayStop();
    p.gameplayStop();
    expect(f.messages).toEqual(['game_ready', 'gameplay_started', 'gameplay_stopped']);
  });

  it('is silent while either the sound switch is off or the platform pauses', async () => {
    const f = fakeBridge();
    const p = await platform(f);
    const muted: boolean[] = [];
    p.onHostMute((m) => muted.push(m));
    f.emit('pause_state_changed', true);
    f.emit('audio_state_changed', false);
    f.emit('pause_state_changed', false);
    f.emit('audio_state_changed', true);
    expect(muted).toEqual([false, true, true, true, false]);
  });

  it("opens the game's pause on each platform pause, not on its end", async () => {
    const f = fakeBridge();
    const p = await platform(f);
    let opened = 0;
    p.onHostPause(() => opened++);
    f.emit('pause_state_changed', true);
    f.emit('pause_state_changed', false);
    f.emit('pause_state_changed', true);
    expect(opened).toBe(2);
  });

  it('offers no rewarded ad under an adblocker', async () => {
    const p = await platform(fakeBridge({ adblock: true }));
    expect([p.rewardedAvailable(), p.adBlocked()]).toEqual([false, true]);
    const clean = await platform(fakeBridge());
    expect([clean.rewardedAvailable(), clean.adBlocked()]).toEqual([true, false]);
  });

  it("puts the platform's language first", async () => {
    expect((await platform(fakeBridge({ language: 'tr' }))).languages()[0]).toBe('tr');
  });
});
