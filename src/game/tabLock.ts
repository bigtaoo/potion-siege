// Two tabs of the game each keep their own save in memory and write it over the other's. The
// newest tab plays: each one says hello as it starts, and a tab that hears a newer one stops
// writing its save, stops, and says so over the board, with a button that takes the game back
// (a reload, which makes it the newest). BroadcastChannel where there is one, else the
// `storage` event (Safari before 15.4); neither: no lock, as before.

import { t } from '../i18n';

const NAME = 'mb.tab';

/** A way to hear the other tabs: `say` reaches every other tab of this origin, never this one. */
export interface TabLink {
  say(id: string): void;
  hear(listener: (id: string) => void): void;
}

export class TabLock {
  /** A newer tab took over: this one no longer writes its save. */
  stale = false;

  constructor(
    link: TabLink | null,
    private readonly onStale: () => void,
    readonly id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  ) {
    link?.hear((other) => {
      if (other === this.id || this.stale) return;
      this.stale = true;
      this.onStale();
    });
    link?.say(this.id);
  }
}

/** The page's link to its other tabs, or null where it has none. */
export function pageLink(w: Window & typeof globalThis = window): TabLink | null {
  try {
    if (typeof w.BroadcastChannel === 'function') {
      const channel = new w.BroadcastChannel(NAME);
      return {
        say: (id) => channel.postMessage(id),
        hear: (listener) => channel.addEventListener('message', (e: MessageEvent) => typeof e.data === 'string' && listener(e.data)),
      };
    }
    const store = w.localStorage;
    if (!store) return null;
    return {
      say: (id) => store.setItem(NAME, id),
      hear: (listener) => w.addEventListener('storage', (e) => e.key === NAME && typeof e.newValue === 'string' && listener(e.newValue)),
    };
  } catch {
    return null;
  }
}

/** The notice over a stale tab, in plain DOM so it needs nothing from the stopped game. */
export function staleNotice(parent: HTMLElement, reload: () => void = () => location.reload()): HTMLElement {
  const doc = parent.ownerDocument;
  const box = doc.createElement('div');
  box.style.cssText =
    'position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;' +
    'padding:24px;background:rgba(20,14,10,.92);color:#f4e6c8;font:600 20px/1.4 system-ui,sans-serif;text-align:center';
  const text = doc.createElement('p');
  text.textContent = t('tab.elsewhere');
  const button = doc.createElement('button');
  button.textContent = t('tab.playHere');
  button.style.cssText = 'font:inherit;padding:12px 28px;border:0;border-radius:24px;background:#8a5cc8;color:#fff;cursor:pointer';
  button.addEventListener('click', reload);
  box.append(text, button);
  parent.appendChild(box);
  return box;
}
