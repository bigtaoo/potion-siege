import { describe, expect, it } from 'vitest';
import type { PSNative, NotifyState } from './bridge';
import { nativeNotifier } from './notify';

function shell(v = 2, status: NotifyState['status'] | null = 'unknown') {
  let cb: ((s: NotifyState) => void) | null = null;
  const posted: unknown[][] = [];
  const native: Partial<PSNative> = {
    v,
    notify: () => (status ? { status } : null),
    onNotify: (f) => (cb = f),
    notifyAsk: () => posted.push(['ask']),
    notifySchedule: (...a) => posted.push(['schedule', ...a]),
    notifyCancel: (id) => posted.push(['cancel', id]),
  };
  return { native, posted, push: (s: NotifyState) => cb?.(s) };
}

describe('native notifier', () => {
  it('exists only on a shell of bridge v2 with every call', () => {
    expect(nativeNotifier(null)).toBeNull();
    expect(nativeNotifier(shell(1).native)).toBeNull();
    const { native } = shell();
    expect(nativeNotifier({ ...native, notifyCancel: undefined })).toBeNull();
    expect(nativeNotifier(native)).not.toBeNull();
  });

  it('asks once and resolves with the answer the shell pushes', async () => {
    const s = shell();
    const n = nativeNotifier(s.native)!;
    const answer = n.ask();
    expect(s.posted).toEqual([['ask']]);
    s.push({ status: 'on' });
    await expect(answer).resolves.toBe('on');
    // asked already: the answer stands without the sheet
    await expect(n.ask()).resolves.toBe('on');
    expect(s.posted).toHaveLength(1);
  });

  it('books only while on, and cancels by id', () => {
    const s = shell(2, 'off');
    const n = nativeNotifier(s.native)!;
    n.schedule('daily', 1000, 'a', 'b');
    expect(s.posted).toEqual([]);
    s.push({ status: 'on' });
    n.schedule('daily', 1000, 'a', 'b');
    n.cancel('gift');
    expect(s.posted).toEqual([['schedule', 'daily', 1000, 'a', 'b'], ['cancel', 'gift']]);
  });

  it('starts unknown when the shell reports garbage, and ignores a malformed push', () => {
    for (const bad of [null, 'on', { status: 'maybe' }]) {
      const s = shell();
      s.native.notify = () => bad as unknown as NotifyState;
      const n = nativeNotifier(s.native)!;
      let changes = 0;
      n.onChange = () => changes++;
      expect(n.status()).toBe('unknown');
      s.push(bad as unknown as NotifyState);
      expect([n.status(), changes]).toEqual(['unknown', 0]);
    }
  });

  it('takes a sheet the system never showed as a no, and a second ask meanwhile as a no', async () => {
    const s = shell();
    const n = nativeNotifier(s.native)!;
    let changes = 0;
    n.onChange = () => changes++;
    const answer = n.ask();
    await expect(n.ask()).resolves.toBe('off');
    expect(s.posted).toEqual([['ask']]);
    // the same status again: the ask ends, but nothing changed for the settings
    s.push({ status: 'unknown' });
    await expect(answer).resolves.toBe('off');
    expect([n.status(), changes]).toEqual(['unknown', 0]);
    s.push({ status: 'off' });
    expect([n.status(), changes]).toEqual(['off', 1]);
  });
});
