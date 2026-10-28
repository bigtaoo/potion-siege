// The app-flow tests' game (appFlow.test.ts): the real Game as testWorld.ts
// builds it, but over a stand-in Pixi app whose ticker keeps its listeners, so a test can run
// whole frames through it, and whose screen can change size under it.

import { Container, type Application } from 'pixi.js';
import { Game } from '../app';
import { Analytics } from '../analytics/analytics';
import { MemorySink } from '../analytics/sinks';
import { PrivacyChoice } from '../analytics/privacy';
import type { MetaSave } from '../sim/meta';
import { Host, veteran, type World } from './testWorld';

type Listener = (t: { deltaMS: number }) => void;

export interface LiveWorld extends World {
  screen: { width: number; height: number };
  /** Runs one frame `ms` long through the ticker's listeners, as Pixi would. */
  frame(ms?: number): void;
  /** Whatever the host's mute callback was handed. */
  hostMute: ((muted: boolean) => void) | null;
}

export function liveWorld(save: MetaSave = veteran(), switches = 'speed=200', size = { width: 1080, height: 1920 }, setup: (h: Host) => void = () => {}): LiveWorld {
  const host = new Host();
  const out = { hostMute: null } as { hostMute: LiveWorld['hostMute'] };
  Object.assign(host, { onHostMute: (fn: (muted: boolean) => void) => void (out.hostMute = fn) });
  setup(host);
  host.storage.setItem('mb.save', JSON.stringify(save));
  const stage = new Container();
  const listeners: Listener[] = [];
  const screen = { ...size };
  const app = { stage, ticker: { add: (fn: Listener) => listeners.push(fn) }, screen, renderer: {} } as unknown as Application;
  const sink = new MemorySink();
  const analytics = new Analytics(host.storage, [sink], 'test', host.name);
  const game = new Game(app, host, new URLSearchParams(switches), analytics, new PrivacyChoice(host.storage, 'notice'));
  game.start();
  return {
    game,
    host,
    stage,
    sink,
    analytics,
    screen,
    get hostMute() {
      return out.hostMute;
    },
    frame: (ms = 16) => {
      for (const fn of listeners) fn({ deltaMS: ms });
    },
    save: () => JSON.parse(host.storage.getItem('mb.save')!) as MetaSave,
    events: (name) => {
      analytics.flush();
      return sink.events.filter((e) => e.name === name).map((e) => e.props);
    },
  };
}

/** Sets the page's visibility on the tests' stand-in document. */
export function pageVisible(on: boolean): void {
  (globalThis.document as { visibilityState: string }).visibilityState = on ? 'visible' : 'hidden';
}
