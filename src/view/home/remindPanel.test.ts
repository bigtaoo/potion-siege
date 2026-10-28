// The reminders' card over the home screen (remindPanel.ts, game/returnHooks.ts remindAnswer): the
// real game over a host with a stand-in notifier, the card answered by its English buttons.
import '../layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { REMINDERS_KEY } from '../../game/keys';
import { home } from '../../game/homeScreen';
import { englishPage, flush, tap, texts, veteran, world } from '../../game/testWorld';
import type { Notifier } from '../../platform/types';

beforeAll(englishPage);

/** A notifier not asked yet, whose system sheet answers `answer`. */
function notifier(answer: 'on' | 'off' = 'on') {
  const n = {
    current: 'unknown' as ReturnType<Notifier['status']>,
    asks: 0,
    booked: [] as string[],
    status: () => n.current,
    async ask() {
      n.asks++;
      n.current = answer;
      return answer;
    },
    schedule: (id: string) => void n.booked.push(id),
    cancel() {},
  };
  return n;
}

/** A veteran back on the home screen after a battle, the card up by itself. */
function card(answer: 'on' | 'off' = 'on') {
  const notify = notifier(answer);
  const w = world(veteran(), (h) => Object.assign(h, { notify }));
  const g = w.game;
  g.save.runs++;
  g['menu'].visible = false;
  home(g);
  expect(g['panel']).toBe('remind');
  return { w, notify };
}

const kept = (w: ReturnType<typeof world>) => JSON.parse(w.host.storage.getItem(REMINDERS_KEY) ?? 'null');

describe('the reminders card', () => {
  it('comes up once after a battle, never on the launch', () => {
    const { w } = card();
    expect(texts(w.stage).map((s) => s.replace(/\n/g, ' '))).toContain(t('remind.offer'));
    w.game['menu'].visible = false;
    home(w.game);
    expect(w.game['panel']).toBeNull();
  });

  it('stays away where the host has no notifications', () => {
    const w = world();
    w.game.save.runs++;
    w.game['menu'].visible = false;
    home(w.game);
    expect(w.game['panel']).toBeNull();
  });

  it('asks the system on yes, keeps the answer and closes', async () => {
    const { w, notify } = card();
    tap(w.stage, t('remind.yes'));
    expect(w.game['panel']).toBeNull();
    expect(texts(w.stage)).not.toContain(t('remind.yes'));
    await flush();
    expect(notify.asks).toBe(1);
    expect(kept(w)).toEqual({ on: true, asked: true });
    expect(notify.booked.length).toBeGreaterThan(0);
    expect(w.events('dialog')).toContainEqual({ id: 'remind', action: 'yes', from: 'card', run: 9 });
  });

  it('asks nothing on no, keeps the answer and closes', async () => {
    const { w, notify } = card();
    tap(w.stage, t('remind.no'));
    expect(w.game['panel']).toBeNull();
    await flush();
    expect(notify.asks).toBe(0);
    expect(kept(w)).toEqual({ on: false, asked: true });
    expect(notify.booked).toEqual([]);
    expect(w.events('dialog')).toContainEqual({ id: 'remind', action: 'no', from: 'card', run: 9 });
  });

  it('is not offered again once answered', async () => {
    const { w } = card();
    tap(w.stage, t('remind.no'));
    await flush();
    const again = world(w.game.save, (h) => Object.assign(h, { notify: notifier(), storage: w.host.storage }));
    again.game.save.runs++;
    again.game['menu'].visible = false;
    home(again.game);
    expect(again.game['panel']).toBeNull();
  });

  it('closes with the cross, answering nothing', () => {
    const { w, notify } = card();
    tap(w.stage, '✕');
    expect(w.game['panel']).toBeNull();
    expect(notify.asks).toBe(0);
    expect(kept(w)).toBeNull();
  });
});
