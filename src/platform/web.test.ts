import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStorage, WebPlatform } from './web';

/** A localStorage look-alike; `full` makes every write fail like a quota error. */
function memoryStorage(full = false) {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full) throw new DOMException('quota', 'QuotaExceededError');
      map.set(k, v);
    },
  };
}

/** A page at `search` whose window has `win`, and a navigator with `nav`. */
function page(search = '', win: object = { localStorage: memoryStorage() }, nav: object = {}) {
  vi.stubGlobal('location', { search });
  vi.stubGlobal('window', win);
  vi.stubGlobal('navigator', { languages: ['de-DE', 'de'], language: 'en', maxTouchPoints: 0, ...nav });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('browserStorage', () => {
  it("hands back the page's localStorage", () => {
    const storage = memoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    expect(browserStorage()).toBe(storage);
  });

  it('says null where reading localStorage throws, as in a sandboxed iframe', () => {
    vi.stubGlobal('window', {
      get localStorage(): never {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    expect(browserStorage()).toBeNull();
  });
});

describe('WebPlatform storage', () => {
  it('keeps values in localStorage', () => {
    const storage = memoryStorage();
    page('', { localStorage: storage });
    const p = new WebPlatform();
    p.storage.setItem('mb.save', '{"a":1}');
    expect(p.storage.getItem('mb.save')).toBe('{"a":1}');
    expect(storage.map.get('mb.save')).toBe('{"a":1}');
  });

  it('still keeps the session going in memory when localStorage is denied or full', () => {
    const denied = {
      get localStorage(): never {
        throw new Error('denied');
      },
    };
    for (const win of [denied, { localStorage: memoryStorage(true) }]) {
      page('', win);
      const p = new WebPlatform();
      p.storage.setItem('mb.save', 'x');
      expect(p.storage.getItem('mb.save')).toBe('x');
      expect(p.storage.getItem('mb.other')).toBeNull();
    }
  });
});

describe('WebPlatform ads', () => {
  it('has no ads on a plain page', async () => {
    page();
    const p = new WebPlatform();
    const onStart = vi.fn();
    expect(p.rewardedAvailable()).toBe(false);
    expect(await p.rewarded(onStart)).toBe(false);
    await p.midgame(onStart);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('plays a pretend ad of a second with ?ads=fake', async () => {
    vi.useFakeTimers();
    page('?ads=fake');
    const p = new WebPlatform();
    expect(p.rewardedAvailable()).toBe(true);
    const onStart = vi.fn();
    let paid: boolean | undefined;
    void p.rewarded(onStart).then((ok) => (paid = ok));
    expect(onStart).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(paid).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(paid).toBe(true);
    let over = false;
    void p.midgame(onStart).then(() => (over = true));
    expect(onStart).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(over).toBe(true);
  });
});

describe('WebPlatform', () => {
  it('stands in for hot updates and reminders only when the URL asks', () => {
    page();
    const plain = new WebPlatform();
    expect([plain.updates, plain.notify]).toEqual([undefined, null]);
    page('?ota=fake&notify=fake');
    const dev = new WebPlatform();
    expect(dev.updates?.check).toBeTypeOf('function');
    expect(dev.notify?.status()).toBe('unknown');
  });

  it('names itself web and takes the gameplay hooks without a portal to tell', () => {
    page();
    const p = new WebPlatform();
    expect(p.name).toBe('web');
    expect(() => {
      p.loaded();
      p.gameplayStart();
      p.gameplayStop();
      p.celebrate();
      p.onHostMute(() => {});
    }).not.toThrow();
  });

  it("lists the browser's languages, then its main one", () => {
    page();
    expect(new WebPlatform().languages()).toEqual(['de-DE', 'de', 'en']);
    vi.stubGlobal('navigator', { language: 'fr', maxTouchPoints: 0 });
    expect(new WebPlatform().languages()).toEqual(['fr']);
  });

  it('opens links in a new tab without handing it the game', () => {
    const open = vi.fn();
    page('', { localStorage: memoryStorage(), open });
    new WebPlatform().openUrl?.('https://example.com/privacy');
    expect(open).toHaveBeenCalledWith('https://example.com/privacy', '_blank', 'noopener');
  });

  it("buzzes a phone, short or strong, but not a desktop's browser", () => {
    const vibrate = vi.fn();
    page('', undefined, { vibrate, maxTouchPoints: 5 });
    const phone = new WebPlatform();
    phone.vibrate?.(false);
    phone.vibrate?.(true);
    expect(vibrate.mock.calls).toEqual([[15], [40]]);
    page('', undefined, { vibrate, maxTouchPoints: 0 });
    expect(new WebPlatform().vibrate).toBeUndefined();
    page('', undefined, { maxTouchPoints: 5 });
    expect(new WebPlatform().vibrate).toBeUndefined();
  });
});

describe('WebPlatform.copyText', () => {
  /** A document whose execCommand('copy') does `copy`, keeping the text boxes it was given. */
  function documentWith(copy: () => boolean) {
    const boxes: { value: string; removed: boolean }[] = [];
    vi.stubGlobal('document', {
      createElement: () => {
        const box = { value: '', readOnly: false, style: { cssText: '' }, removed: false, select() {}, setSelectionRange() {}, remove: () => void (box.removed = true) };
        boxes.push(box);
        return box;
      },
      body: { appendChild: () => {} },
      execCommand: copy,
    });
    return boxes;
  }

  it('copies with the Clipboard API', async () => {
    const writeText = vi.fn(async () => {});
    page('', undefined, { clipboard: { writeText } });
    expect(await new WebPlatform().copyText('PS-1234')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('PS-1234');
  });

  it('falls back to a hidden text box when the clipboard is withheld, and cleans it up', async () => {
    page('', undefined, { clipboard: { writeText: async () => Promise.reject(new Error('NotAllowed')) } });
    const boxes = documentWith(() => true);
    expect(await new WebPlatform().copyText('PS-1234')).toBe(true);
    expect(boxes).toEqual([expect.objectContaining({ value: 'PS-1234', readOnly: true, removed: true })]);
  });

  it('says false when the old way fails too', async () => {
    page('', undefined, {});
    const boxes = documentWith(() => {
      throw new Error('no execCommand');
    });
    expect(await new WebPlatform().copyText('PS-1234')).toBe(false);
    expect(boxes[0].removed).toBe(true);
  });
});
