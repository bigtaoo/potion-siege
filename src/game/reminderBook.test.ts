// The iOS app's reminders between the home screen and the host's notifications
// (reminderBook.ts): when the card is offered, what an answer stores and asks, and what gets
// booked. The real game over a stand-in Pixi app and a scripted notifier (testNotifier.ts).
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { reminders } from '../sim/reminders';
import { BALANCE } from '../sim/types';
import { challengeOpen } from '../view/nudges';
import { REMINDERS_KEY } from './keys';
import { reminderBook, type ReminderBook } from './reminderBook';
import { Bell, bellWorld } from './testNotifier';
import { englishPage, veteran, world, type World } from './testWorld';

beforeAll(englishPage);

function setup(bell = new Bell(), save = veteran()): { w: World; book: ReminderBook; bell: Bell } {
  const w = bellWorld(save, bell);
  return { w, book: reminderBook(w.game)!, bell };
}

const stored = (w: World) => JSON.parse(w.host.storage.getItem(REMINDERS_KEY) ?? 'null') as unknown;

describe('the reminder book', () => {
  it('is there only where the host has notifications, one per game', () => {
    expect(reminderBook(world().game)).toBeNull();
    const a = bellWorld(veteran(), new Bell()).game;
    const b = bellWorld(veteran(), new Bell()).game;
    expect(reminderBook(a)).not.toBeNull();
    expect(reminderBook(a)).toBe(reminderBook(a));
    expect(reminderBook(a)).not.toBe(reminderBook(b));
  });
});

describe('the card offer', () => {
  it('comes after a battle played since launch, once per launch', () => {
    const { w, book } = setup();
    expect(book.offer(), 'not on the launch itself').toBe(false);
    w.game.save.runs++;
    expect(book.offer()).toBe(true);
    w.game.save.runs++;
    expect(book.offer(), 'once per launch').toBe(false);
  });

  it('waits until a few runs are in', () => {
    const save = veteran();
    save.runs = 1;
    const { w, book } = setup(new Bell(), save);
    for (let runs = 2; runs < BALANCE.reminders.askAfterRuns; runs++) {
      w.game.save.runs = runs;
      expect(book.offer(), `run ${runs}`).toBe(false);
    }
    w.game.save.runs = BALANCE.reminders.askAfterRuns;
    expect(book.offer()).toBe(true);
  });

  it('never comes back once answered', async () => {
    const { w, book } = setup();
    await book.answer(false);
    w.game.save.runs++;
    expect(book.offer()).toBe(false);
  });

  it.each(['on', 'off'] as const)('never comes when the system has said %s already', (now) => {
    const bell = new Bell();
    bell.now = now;
    const { w, book } = setup(bell);
    w.game.save.runs++;
    expect(book.offer()).toBe(false);
  });

  it('never comes under autoplay', () => {
    const w = bellWorld(veteran(), new Bell(), 'speed=200&autoplay');
    const book = reminderBook(w.game)!;
    w.game.save.runs++;
    expect(book.offer()).toBe(false);
  });
});

describe('the answer', () => {
  it('yes stores it, brings up the system sheet, and books what is due', async () => {
    const { w, book, bell } = setup();
    await book.answer(true);
    expect(stored(w)).toEqual({ on: true, asked: true });
    expect(bell.asks).toBe(1);
    expect([...bell.booked.keys()]).toEqual(['daily']);
    expect(book.state()).toBe('on');
  });

  it('yes books nothing when the sheet is refused, and the switch then reads blocked', async () => {
    const bell = new Bell();
    bell.answer = 'off';
    const { book } = setup(bell);
    await book.answer(true);
    expect(bell.booked.size).toBe(0);
    expect(book.state()).toBe('blocked');
  });

  it('no stores it without asking the system', async () => {
    const { w, book, bell } = setup();
    await book.answer(false);
    expect(stored(w)).toEqual({ on: false, asked: true });
    expect(bell.asks).toBe(0);
    expect(bell.booked.size).toBe(0);
  });
});

describe('the bookings', () => {
  const now = Date.UTC(2026, 9, 28, 9);

  it('book the welcome gift while the week runs, with its texts', () => {
    const save = veteran();
    save.welcome.gifts = 2;
    save.welcome.day = '2026-10-27';
    const bell = new Bell();
    bell.now = 'on';
    const { w, book } = setup(bell, save);
    book.sync(now);
    const due = reminders(w.game.save, challengeOpen(w.game.save), now, new Date(now).getTimezoneOffset());
    expect(due.map((r) => r.id)).toEqual(['gift']);
    expect([...bell.booked]).toEqual([['gift', { at: due[0].at, title: t('remind.giftTitle'), body: t('remind.giftBody') }]]);
  });

  it("book today's challenge after the week, with its texts", () => {
    const bell = new Bell();
    bell.now = 'on';
    const { w, book } = setup(bell);
    book.sync(now);
    const due = reminders(w.game.save, true, now, new Date(now).getTimezoneOffset());
    expect([...bell.booked]).toEqual([['daily', { at: due[0].at, title: t('remind.dailyTitle'), body: t('remind.dailyBody') }]]);
  });

  it('are cancelled once the switch goes off, and the system is not asked again', async () => {
    const bell = new Bell();
    bell.now = 'on';
    const { book } = setup(bell);
    book.sync();
    expect(bell.booked.size).toBe(1);
    await book.set(false);
    expect(bell.booked.size).toBe(0);
    expect(book.state()).toBe('off');
    expect(bell.asks).toBe(0);
  });

  it.each(['unknown', 'off'] as const)('are none while the system says %s', (now) => {
    const bell = new Bell();
    bell.now = now;
    const { book } = setup(bell);
    book.sync();
    expect(bell.booked.size).toBe(0);
  });

  it('are made again when the game goes to the background', () => {
    const page = document;
    const heard: Record<string, () => void> = {};
    const doc = { visibilityState: 'visible', addEventListener: (name: string, f: () => void) => (heard[name] = f) };
    (globalThis as { document?: unknown }).document = doc;
    try {
      const bell = new Bell();
      const { book } = setup(bell);
      bell.now = 'on';
      heard.visibilitychange();
      expect(bell.booked.size, 'nothing while it is still shown').toBe(0);
      doc.visibilityState = 'hidden';
      heard.visibilitychange();
      expect([...bell.booked.keys()]).toEqual(['daily']);
      expect(book.state()).toBe('on');
    } finally {
      (globalThis as { document?: unknown }).document = page;
    }
  });
});

describe('the settings switch', () => {
  it('reads blocked, on or off from the system and the stored answer', async () => {
    const { book, bell } = setup();
    expect(book.state(), 'never asked').toBe('off');
    bell.now = 'on';
    expect(book.state()).toBe('on');
    await book.set(false);
    expect(book.state()).toBe('off');
    bell.now = 'off';
    expect(book.state()).toBe('blocked');
  });

  it('asks the system only while it has not answered', async () => {
    const { book, bell } = setup();
    await book.set(true);
    expect(bell.asks).toBe(1);
    await book.set(false);
    await book.set(true);
    expect(bell.asks).toBe(1);
    expect(book.state()).toBe('on');
  });

  it.each(['{', 'null', '[1]'])('reads a stored %s as on and never answered', (raw) => {
    const bell = new Bell();
    const { w, book } = setup(bell);
    w.host.storage.setItem(REMINDERS_KEY, raw);
    w.game.save.runs++;
    expect(book.offer()).toBe(true);
    bell.now = 'on';
    expect(book.state()).toBe('on');
  });
});
