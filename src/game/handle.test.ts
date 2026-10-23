// The hot-update prompt over the home screen (handle.ts, view/updatePrompt.ts) and the reports a
// host's entry sends through the handle.
import '../view/layout/measure';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { fakeUpdates, updatesSwitch } from '../platform/fakeUpdates';
import type { AppUpdates } from '../platform/types';
import { gameHandle, homeIdle } from './handle';
import { home } from './homeScreen';
import { englishPage, tap, texts, veteran, world } from './testWorld';

beforeAll(englishPage);

const settle = () => new Promise((r) => setTimeout(r, 0));

/** A veteran on the home screen with a handle whose ticks the test runs. */
function homeWith(updates?: AppUpdates) {
  const w = world(veteran());
  const g = w.game;
  g['menu'].visible = false;
  home(g);
  const ticks: (() => void)[] = [];
  (g.app as unknown as { ticker: unknown }).ticker = { add: (fn: () => void) => ticks.push(fn) };
  const handle = gameHandle(g, updates);
  const tick = () => ticks.forEach((fn) => fn());
  return { w, g, handle, tick };
}

describe('the update prompt', () => {
  it('asks on a free home screen, over everything, and Later puts it away', async () => {
    let checks = 0;
    const install = vi.fn(async () => {});
    const { w, g, tick } = homeWith({ check: async () => (checks++, { version: '1.0.18.2', install }) });
    expect(homeIdle(g)).toBe(true);
    tick();
    await settle();
    tick();
    expect(checks).toBe(1);
    expect(texts(w.stage)).toContain(t('update.version', { v: '1.0.18.2' }));
    expect(w.stage.children[w.stage.children.length - 1].children.length).toBe(1);
    tap(w.stage, t('update.later'));
    tick();
    expect(texts(w.stage)).not.toContain(t('update.title'));
    expect(install).not.toHaveBeenCalled();
  });

  it('waits while a panel is open', async () => {
    let checks = 0;
    const { g, tick } = homeWith({ check: async () => (checks++, null) });
    g.panel = 'settings' as typeof g.panel;
    expect(homeIdle(g)).toBe(false);
    tick();
    await settle();
    expect(checks).toBe(0);
  });

  it('shows the download, then a failure with Retry and Close', async () => {
    vi.useFakeTimers();
    try {
      const { w, tick } = homeWith(fakeUpdates(true, () => {}));
      tick();
      await vi.advanceTimersByTimeAsync(600);
      tick();
      tap(w.stage, t('update.now'));
      await vi.advanceTimersByTimeAsync(360);
      tick();
      expect(texts(w.stage)).toContain(t('update.downloading'));
      expect(texts(w.stage)).toContain(t('update.percent', { n: 12 }));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await vi.advanceTimersByTimeAsync(2000);
      warn.mockRestore();
      tick();
      expect(texts(w.stage)).toContain(t('update.failedTitle'));
      tap(w.stage, t('update.close'));
      tick();
      expect(texts(w.stage)).not.toContain(t('update.failedTitle'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('restarts after a whole download', async () => {
    vi.useFakeTimers();
    try {
      const reload = vi.fn();
      const { w, tick } = homeWith(fakeUpdates(false, reload));
      tick();
      await vi.advanceTimersByTimeAsync(600);
      tick();
      tap(w.stage, t('update.now'));
      await vi.advanceTimersByTimeAsync(3000);
      tick();
      expect(texts(w.stage)).toContain(t('update.restarting'));
      await vi.advanceTimersByTimeAsync(600);
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('is only there on ?ota=fake or fail', () => {
    expect(updatesSwitch(new URLSearchParams('ota=fake'))).toBeDefined();
    expect(updatesSwitch(new URLSearchParams('ota=fail'))).toBeDefined();
    expect(updatesSwitch(new URLSearchParams('ota=1'))).toBeUndefined();
    const { w, tick } = homeWith();
    tick();
    expect(texts(w.stage)).not.toContain(t('update.title'));
  });
});

describe('the handle', () => {
  it('sends a launch report as an anomaly where it happened', () => {
    const { w, handle } = homeWith();
    handle.report('boot_fail', { place: 'boot', stage: 'boot', bundle: '1.0.18.2' });
    handle.report('ota_fail', { place: 'boot', bundle: '1.0.18.3' });
    const sent = w.events('anomaly');
    expect(sent).toEqual([
      expect.objectContaining({ kind: 'boot_fail', place: 'boot', stage: 'boot', bundle: '1.0.18.2' }),
      expect.objectContaining({ kind: 'ota_fail', place: 'boot', bundle: '1.0.18.3' }),
    ]);
    expect(sent[0]).not.toHaveProperty('wave');
  });
});
